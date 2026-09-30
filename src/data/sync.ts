/**
 * Sync engine: pushes the outbox through the active adapter and pulls remote changes.
 *
 * - Outbox: oldest first, **in order per entity**. A failing op blocks later ops for the same
 *   entity; a transport failure (offline, broken link, wrong passphrase) stops the whole pass.
 *   Retries use exponential backoff with jitter. Ops are idempotent server-side (LWW on updated_at).
 * - Live updates: poll `changes` every 20 s while the page is visible, on focus/visibility/online,
 *   and right after our own writes. Paused while hidden (Page Visibility API).
 * - Watermark: the server's `serverTime`, re-requested with an overlap window so clock skew and
 *   in-flight writes can't slip past. LWW makes the overlap harmless.
 * - Broken link: repeated `not_apps_script` (or repeated network failures while online) surfaces
 *   `error: 'unreachable'`, which drives the "Can't reach our Sheet" banner. Nothing local is lost.
 *
 * Public API (stable): startSync, stopSync, syncNow, flush, pull, kick, onRemoteChange,
 * backoffDelay, activeAdapter. Additions: onArrival, useRecentArrivals, POLL_INTERVAL_MS.
 */
import { useSyncExternalStore } from 'react';
import { AdapterError, isAdapterError, type ApplyResult, type DataAdapter } from './adapters/types';
import { getDevice, setDevice } from './device';
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
/** Poll `changes` this often while the page is visible (SPEC §7.3). */
export const POLL_INTERVAL_MS = 20_000;
/** Re-request this much before the watermark (clock skew, writes landing mid-read). */
export const SINCE_OVERLAP_MS = 2 * 60 * 1000;
/** Consecutive link-level failures before we call the link broken. */
export const BROKEN_LINK_AFTER = 2;
export const UNREACHABLE_AFTER = 3;

/** Delay before retry `attempt` (1-based): 1s, 2s, 4s… capped at 5 min, ±20% jitter. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const raw = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1));
  return Math.round(raw * (0.8 + random() * 0.4));
}

/** `since` minus the overlap window (ISO in, ISO out; invalid input passes through). */
export function withOverlap(since: string, overlapMs = SINCE_OVERLAP_MS): string {
  const t = Date.parse(since);
  return Number.isNaN(t) ? since : new Date(Math.max(0, t - overlapMs)).toISOString();
}

/** Which entity an op writes to, for per-entity ordering. */
export function opEntity(op: OutboxOp): string {
  switch (op.action) {
    case 'upsertHotel':
      return `hotel:${op.payload.hotel_id}`;
    case 'upsertVisit':
    case 'deleteVisit':
      return `visit:${op.payload.visit_id}`;
    case 'uploadPhoto':
      return `photo:${op.payload.photo.photo_id}`;
    case 'upsertWish':
      return `wish:${op.payload.wish_id}`;
    case 'markLetterRead':
    case 'upsertLetter':
      return `letter:${op.payload.letter_id}`;
    case 'updateSettings':
      return 'settings';
  }
}

// ───────────────────────────── events ─────────────────────────────

type RemoteListener = (change: RemoteChange) => void;
const remoteListeners = new Set<RemoteListener>();

/** Subscribe to remote changes (new stays from the other phone, echoes). Returns unsubscribe. */
export function onRemoteChange(cb: RemoteListener): () => void {
  remoteListeners.add(cb);
  return () => remoteListeners.delete(cb);
}

/** A stay the other person added, as seen by this phone's pull. */
export interface Arrival {
  visitId: string;
  hotelId: string;
  addedBy: Visit['added_by'];
  at: number;
}

type ArrivalListener = (a: Arrival) => void;
const arrivalListeners = new Set<ArrivalListener>();
let arrivals: readonly Arrival[] = [];
const arrivalSubs = new Set<() => void>();
/** How long an arrival stays "recent" (for animating the new card in). */
export const ARRIVAL_TTL_MS = 30_000;

/** Fires once per stay the other phone added (pulled, not our own echo). */
export function onArrival(cb: ArrivalListener): () => void {
  arrivalListeners.add(cb);
  return () => arrivalListeners.delete(cb);
}

function setArrivals(next: readonly Arrival[]) {
  arrivals = next;
  arrivalSubs.forEach((l) => l());
}

function pruneArrivals() {
  const cutoff = Date.now() - ARRIVAL_TTL_MS;
  if (arrivals.some((a) => a.at < cutoff)) setArrivals(arrivals.filter((a) => a.at >= cutoff));
}

/**
 * Stays the other person added in the last 30 s (newest first). The stays screen uses it to
 * animate the new card in; `acknowledge(visitId)` drops one once it has animated.
 */
export function useRecentArrivals(): readonly Arrival[] {
  return useSyncExternalStore(
    (l) => {
      arrivalSubs.add(l);
      const t = setInterval(pruneArrivals, 5000);
      return () => {
        arrivalSubs.delete(l);
        clearInterval(t);
      };
    },
    () => arrivals,
    () => arrivals,
  );
}

export function acknowledgeArrival(visitId: string): void {
  if (arrivals.some((a) => a.visitId === visitId)) setArrivals(arrivals.filter((a) => a.visitId !== visitId));
}

function emitRemote(change: RemoteChange) {
  const any =
    change.hotels.length || change.visits.length || change.photos.length || change.wishes.length || change.letters.length || change.settings;
  if (!any) return;
  remoteListeners.forEach((l) => l(change));
  if (change.source !== 'pull' || !change.newVisits.length) return;
  const me = getDevice('me');
  const now = Date.now();
  const fresh = change.newVisits
    .filter((v) => !v.deleted && v.added_by && v.added_by !== me)
    .map<Arrival>((v) => ({ visitId: v.visit_id, hotelId: v.hotel_id, addedBy: v.added_by, at: now }));
  if (!fresh.length) return;
  setArrivals([...fresh, ...arrivals.filter((a) => !fresh.some((f) => f.visitId === a.visitId))].slice(0, 20));
  fresh.forEach((a) => arrivalListeners.forEach((l) => l(a)));
}

// ───────────────────────────── engine state ─────────────────────────────

let ctx: SyncContext | null = null;
let flushing: Promise<void> | null = null;
let pulling: Promise<RemoteChange | null> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let kickTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let linkFailures = 0;
let removeListeners: (() => void) | null = null;

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);
const isVisible = () => (typeof document === 'undefined' ? true : document.visibilityState !== 'hidden');

/** Transport-level failures stop the whole flush (nothing else would get through either). */
function isTransportError(e: unknown): boolean {
  if (!isAdapterError(e)) return true;
  return e.code === 'network' || e.code === 'not_apps_script' || e.code === 'unauthorized' || e.code === 'not_configured';
}

function errorState(e: unknown): Pick<SyncState, 'error' | 'errorMessage'> {
  const code = isAdapterError(e) ? e.code : 'network';
  const message = e instanceof Error ? e.message : String(e);
  if (code === 'unauthorized') return { error: 'unauthorized', errorMessage: message };
  if (code === 'server' || code === 'conflict') return { error: 'server', errorMessage: message };
  if (!isOnline()) return { error: null, errorMessage: message };
  // Broken link (a new deployment, a deleted script) vs a passing blip.
  linkFailures++;
  const threshold = code === 'not_apps_script' || code === 'not_configured' ? BROKEN_LINK_AFTER : UNREACHABLE_AFTER;
  return linkFailures >= threshold ? { error: 'unreachable', errorMessage: message } : { error: null, errorMessage: message };
}

function markHealthy(c: SyncContext) {
  linkFailures = 0;
  c.setSyncState({ error: null, errorMessage: null });
}

async function refreshPending() {
  if (!ctx) return;
  const c = ctx;
  const n = (await c.listOutbox()).length;
  if (ctx === c) c.setSyncState({ pending: n });
}

function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  failures++;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void syncNow();
  }, backoffDelay(failures));
}

const byCreated = (a: OutboxOp, b: OutboxOp) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.op_id < b.op_id ? -1 : 1);

/**
 * Push every queued op, oldest first, in order per entity. A per-op server error blocks only that
 * entity; a transport error stops the pass. Either schedules a backoff retry.
 */
export function flush(): Promise<void> {
  if (!ctx) return Promise.resolve();
  if (flushing) return flushing;
  const c = ctx;
  flushing = (async () => {
    let pushed = 0;
    try {
      const ops = (await c.listOutbox()).sort(byCreated);
      const blocked = new Set<string>();
      let failed: unknown = null;
      for (const op of ops) {
        if (ctx !== c) return;
        const entity = opEntity(op);
        if (blocked.has(entity)) continue;
        try {
          const result = await c.adapter.apply(op);
          // Remove first so the echo isn't skipped as "still pending" for this entity.
          await c.removeOp(op.op_id);
          await c.onApplied?.(op, result);
          if (result.applied) emitRemote(await c.applyRemote(result.applied, 'echo'));
          pushed++;
        } catch (e) {
          if (isAdapterError(e) && e.code === 'conflict') {
            // The server holds a newer row (or the target is gone): drop ours; a pull brings the winner.
            await c.removeOp(op.op_id);
            continue;
          }
          await c.updateOp({ ...op, attempts: op.attempts + 1, last_error: e instanceof Error ? e.message : String(e) } as OutboxOp);
          failed = e;
          if (isTransportError(e)) break;
          blocked.add(entity);
        }
      }
      if (ctx !== c) return;
      if (failed) {
        c.setSyncState(errorState(failed));
        if (!isAdapterError(failed) || failed.retryable || failed.code === 'not_apps_script') scheduleRetry();
      } else if (ops.length) {
        failures = 0;
        markHealthy(c);
      }
    } finally {
      flushing = null;
      await refreshPending();
      // Right after our own writes: look for the other phone's changes too.
      if (pushed > 0 && ctx === c) schedulePoll(250);
    }
  })();
  return flushing;
}

/** Fetch remote changes since the watermark (minus overlap), or a full bootstrap the first time. */
export function pull(): Promise<RemoteChange | null> {
  if (!ctx) return Promise.resolve(null);
  if (pulling) return pulling;
  const c = ctx;
  pulling = (async () => {
    const since = await c.getSince();
    const snap = since ? await c.adapter.changes(withOverlap(since)) : await c.adapter.bootstrap();
    if (ctx !== c) return null;
    const change = await c.applyRemote(snap, 'pull');
    // Never move the watermark backwards (an overlapping answer can carry an older serverTime).
    if (!since || snap.serverTime > since) await c.setSince(snap.serverTime);
    emitRemote(change);
    return change;
  })().finally(() => {
    pulling = null;
  });
  return pulling;
}

function recordSuccess(c: SyncContext) {
  const now = new Date().toISOString();
  c.setSyncState({ lastSyncAt: now });
  if (c.adapter.kind === 'sheets') {
    const conn = getDevice('connection');
    if (conn) setDevice('connection', { ...conn, lastSyncAt: now, connectedAt: conn.connectedAt ?? now });
  }
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
    if (ctx !== c) return;
    recordSuccess(c);
    if ((await c.listOutbox()).length === 0) markHealthy(c);
    else linkFailures = 0;
  } catch (e) {
    if (ctx === c) {
      c.setSyncState(errorState(e));
      if (!isAdapterError(e) || e.retryable || e.code === 'not_apps_script') scheduleRetry();
    }
  } finally {
    if (ctx === c) c.setSyncState({ syncing: false });
    schedulePoll();
  }
}

/** Next poll in `delay` ms (default: the 20 s cadence). Only while visible and online. */
function schedulePoll(delay = POLL_INTERVAL_MS) {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  if (!ctx || !isVisible()) return;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    if (!ctx || !isVisible()) return;
    if (!isOnline()) {
      schedulePoll();
      return;
    }
    void syncNow();
  }, delay);
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
  linkFailures = 0;
  const lastSyncAt = context.adapter.kind === 'sheets' ? getDevice('connection')?.lastSyncAt ?? null : null;
  context.setSyncState({ online: isOnline(), ...(lastSyncAt ? { lastSyncAt } : {}) });
  if (typeof window !== 'undefined') {
    const online = () => {
      context.setSyncState({ online: true });
      failures = 0;
      void syncNow();
    };
    const offline = () => {
      context.setSyncState({ online: false });
      if (context.adapter.kind === 'sheets') context.setSyncState({ error: null });
    };
    let lastFocusSync = 0;
    const wake = () => {
      if (!isVisible()) {
        if (pollTimer) clearTimeout(pollTimer);
        pollTimer = null;
        return;
      }
      // focus + visibilitychange often fire together: one sync is enough.
      const now = Date.now();
      if (now - lastFocusSync < 1000) return;
      lastFocusSync = now;
      void syncNow();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    removeListeners = () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }
  if (opts.initialSync ?? true) void syncNow();
  else {
    void refreshPending();
    schedulePoll();
  }
  return stopSync;
}

export function stopSync(): void {
  if (retryTimer) clearTimeout(retryTimer);
  if (kickTimer) clearTimeout(kickTimer);
  if (pollTimer) clearTimeout(pollTimer);
  retryTimer = kickTimer = pollTimer = null;
  removeListeners?.();
  removeListeners = null;
  ctx = null;
}

/** For tests/diagnostics. */
export function activeAdapter(): DataAdapter | null {
  return ctx?.adapter ?? null;
}

export { AdapterError };
