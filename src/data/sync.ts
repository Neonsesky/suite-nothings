/**
 * Minimal sync engine: flushes the outbox through the active adapter with exponential backoff,
 * pulls remote changes, and listens for online/offline. Works fully with the demo adapter.
 *
 * Owned by w1-backend after merge, who extends it (20s polling while visible, focus refresh,
 * Sheets specifics). Keep the exported API stable: startSync, stopSync, syncNow, flush, pull,
 * kick, onRemoteChange, backoffDelay.
 */
import { AdapterError, isAdapterError, type ApplyResult, type DataAdapter } from './adapters/types';
import type { Hotel, Letter, OutboxOp, Photo, SettingsMap, Snapshot, Visit, Wish } from './types';

export type SyncError = 'unreachable' | 'unauthorized' | 'server';

export interface SyncState {
  online: boolean;
  /** Outbox ops not yet confirmed by the adapter. */
  pending: number;
  syncing: boolean;
  lastSyncAt: string | null;
  error: SyncError | null;
  errorMessage: string | null;
}

/** What a pull (or a write's server echo) changed locally. Only rows that actually changed. */
export interface RemoteChange {
  hotels: Hotel[];
  visits: Visit[];
  /** Visits that did not exist locally before this change. */
  newVisits: Visit[];
  photos: Photo[];
  wishes: Wish[];
  letters: Letter[];
  settings: Partial<SettingsMap> | null;
  /** 'pull' = fetched from the server; 'echo' = server's copy after our own write. */
  source: 'pull' | 'echo';
}

/** Everything the engine needs from the store. The store builds this; tests can fake it. */
export interface SyncContext {
  adapter: DataAdapter;
  listOutbox(): Promise<OutboxOp[]>;
  removeOp(opId: string): Promise<void>;
  updateOp(op: OutboxOp): Promise<void>;
  /** Merge rows (LWW, skipping rows with pending local ops) and report what changed. */
  applyRemote(snap: Partial<Snapshot>, source: RemoteChange['source']): Promise<RemoteChange>;
  /** Called after a successful apply (e.g. to store server file ids for photos). */
  onApplied?(op: OutboxOp, result: ApplyResult): Promise<void>;
  getSince(): Promise<string | null>;
  setSince(iso: string): Promise<void>;
  setSyncState(patch: Partial<SyncState>): void;
}

export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 5 * 60 * 1000;

/** Delay before retry `attempt` (1-based): 1s, 2s, 4s… capped at 5 min, ±20% jitter. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const raw = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1));
  return Math.round(raw * (0.8 + random() * 0.4));
}

type RemoteListener = (change: RemoteChange) => void;
const remoteListeners = new Set<RemoteListener>();

/** Subscribe to remote changes (new stays from the other phone, echoes). Returns unsubscribe. */
export function onRemoteChange(cb: RemoteListener): () => void {
  remoteListeners.add(cb);
  return () => remoteListeners.delete(cb);
}

function emitRemote(change: RemoteChange) {
  const any =
    change.hotels.length || change.visits.length || change.photos.length || change.wishes.length || change.letters.length || change.settings;
  if (any) remoteListeners.forEach((l) => l(change));
}

let ctx: SyncContext | null = null;
let flushing: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let kickTimer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let removeListeners: (() => void) | null = null;

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

function errorState(e: unknown): Pick<SyncState, 'error' | 'errorMessage'> {
  const code = isAdapterError(e) ? e.code : 'network';
  const message = e instanceof Error ? e.message : String(e);
  if (code === 'unauthorized') return { error: 'unauthorized', errorMessage: message };
  if (code === 'server' || code === 'conflict') return { error: 'server', errorMessage: message };
  return { error: isOnline() ? 'unreachable' : null, errorMessage: message };
}

async function refreshPending() {
  if (!ctx) return;
  ctx.setSyncState({ pending: (await ctx.listOutbox()).length });
}

function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  failures++;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void syncNow();
  }, backoffDelay(failures));
}

/** Push every queued op, oldest first. Stops at the first failure and schedules a retry. */
export function flush(): Promise<void> {
  if (!ctx) return Promise.resolve();
  if (flushing) return flushing;
  const c = ctx;
  flushing = (async () => {
    try {
      const ops = (await c.listOutbox()).sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
      for (const op of ops) {
        if (ctx !== c) return;
        try {
          const result = await c.adapter.apply(op);
          if (result.applied) emitRemote(await c.applyRemote(result.applied, 'echo'));
          await c.onApplied?.(op, result);
          await c.removeOp(op.op_id);
        } catch (e) {
          if (isAdapterError(e) && e.code === 'conflict') {
            // Server holds a newer row: drop our op; the next pull brings the winner.
            await c.removeOp(op.op_id);
            continue;
          }
          await c.updateOp({ ...op, attempts: op.attempts + 1, last_error: e instanceof Error ? e.message : String(e) } as OutboxOp);
          c.setSyncState(errorState(e));
          if (!isAdapterError(e) || e.retryable) scheduleRetry();
          return;
        }
      }
      failures = 0;
      c.setSyncState({ error: null, errorMessage: null });
    } finally {
      flushing = null;
      await refreshPending();
    }
  })();
  return flushing;
}

/** Fetch remote changes since the last pull (or a full bootstrap the first time). */
export async function pull(): Promise<RemoteChange | null> {
  if (!ctx) return null;
  const c = ctx;
  const since = await c.getSince();
  const snap = since ? await c.adapter.changes(since) : await c.adapter.bootstrap();
  if (ctx !== c) return null;
  const change = await c.applyRemote(snap, 'pull');
  await c.setSince(snap.serverTime);
  emitRemote(change);
  return change;
}

/** Flush the outbox, then pull. Resolves when done; never rejects (errors land in SyncState). */
export async function syncNow(): Promise<void> {
  if (!ctx) return;
  const c = ctx;
  if (!isOnline()) {
    c.setSyncState({ online: false });
    await refreshPending();
    return;
  }
  c.setSyncState({ syncing: true, online: true });
  try {
    await flush();
    await pull();
    if (ctx === c) c.setSyncState({ lastSyncAt: new Date().toISOString() });
    if ((await c.listOutbox()).length === 0) c.setSyncState({ error: null, errorMessage: null });
  } catch (e) {
    c.setSyncState(errorState(e));
    if (!isAdapterError(e) || e.retryable) scheduleRetry();
  } finally {
    if (ctx === c) c.setSyncState({ syncing: false });
  }
}

/** Ask for a flush soon (debounced). The store calls this after every local write. */
export function kick(): void {
  if (!ctx) return;
  if (kickTimer) clearTimeout(kickTimer);
  kickTimer = setTimeout(() => {
    kickTimer = null;
    if (!isOnline()) {
      void refreshPending();
      return;
    }
    void flush().then(() => refreshPending());
  }, 30);
}

/** Start the engine for a context (replaces any previous one). Does an initial syncNow(). */
export function startSync(context: SyncContext, opts: { initialSync?: boolean } = {}): () => void {
  stopSync();
  ctx = context;
  failures = 0;
  context.setSyncState({ online: isOnline() });
  if (typeof window !== 'undefined') {
    const online = () => {
      context.setSyncState({ online: true });
      failures = 0;
      void syncNow();
    };
    const offline = () => context.setSyncState({ online: false });
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    removeListeners = () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }
  if (opts.initialSync ?? true) void syncNow();
  else void refreshPending();
  return stopSync;
}

export function stopSync(): void {
  if (retryTimer) clearTimeout(retryTimer);
  if (kickTimer) clearTimeout(kickTimer);
  retryTimer = kickTimer = null;
  removeListeners?.();
  removeListeners = null;
  ctx = null;
}

/** For tests/diagnostics. */
export function activeAdapter(): DataAdapter | null {
  return ctx?.adapter ?? null;
}

export { AdapterError };
