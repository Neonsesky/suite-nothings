/**
 * The Apps Script connection for this device: validate a pasted link, test it, save it, and
 * build invite links. The config lives in device prefs (localStorage) and is mirrored into its
 * own IndexedDB, so it survives service-worker cache clears, app updates and localStorage wipes.
 * `VITE_API_URL` is only a default; a pasted link always wins.
 */
import { openDB, type IDBPDatabase } from 'idb';
import { API_URL } from '@/config/env';
import type { PersonId } from '@/config/couple';
import { createSheetsAdapter, type SheetsAdapterOptions } from './adapters/sheets';
import { adapterErrorMessage, isAdapterError } from './adapters/types';
import { getDevice, onDeviceChange, setDevice } from './device';
import type { ConnectionConfig, Hotel, Visit } from './types';

// ───────────────────────────── validation ─────────────────────────────

/** Test builds only (`VITE_ALLOW_LOCAL_API=1`): accept a localhost mock. Production rejects it. */
export const ALLOW_LOCAL: boolean = import.meta.env.VITE_ALLOW_LOCAL_API === '1' || import.meta.env.VITE_ALLOW_LOCAL_API === 'true';

export type UrlCheck =
  | { ok: true; url: string }
  | { ok: false; reason: 'empty' | 'bad_url' | 'dev_url'; message: string };

export const URL_MESSAGES = {
  empty: 'Paste our Apps Script link first.',
  bad_url: "That's not an Apps Script web app link. It should end in /exec.",
  dev_url: 'This link ends in /dev, it only works for its owner. Ask for the /exec link.',
} as const;

const GOOGLE_EXEC = /^https:\/\/script\.google\.com\/(?:a\/macros\/[^/]+|macros)\/s\/[A-Za-z0-9_-]{10,}\/(exec|dev)$/;
const LOCAL_EXEC = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/macros\/s\/[A-Za-z0-9_-]+\/(exec|dev)$/;

/** Accept only `https://script.google.com/macros/s/…/exec` (trimmed; query/hash dropped). */
export function validateApiUrl(raw: string | null | undefined, opts: { allowLocal?: boolean } = {}): UrlCheck {
  const allowLocal = opts.allowLocal ?? ALLOW_LOCAL;
  const trimmed = (raw ?? '').trim().replace(/\s+/g, '');
  if (!trimmed) return { ok: false, reason: 'empty', message: URL_MESSAGES.empty };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'bad_url', message: URL_MESSAGES.bad_url };
  }
  const clean = `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
  const m = GOOGLE_EXEC.exec(clean) ?? (allowLocal ? LOCAL_EXEC.exec(clean) : null);
  if (!m) return { ok: false, reason: 'bad_url', message: URL_MESSAGES.bad_url };
  if (m[1] === 'dev') return { ok: false, reason: 'dev_url', message: URL_MESSAGES.dev_url };
  return { ok: true, url: clean };
}

/** `script.google.com/…/AKfy…xyz/exec` → `script.google.com/…xyz/exec` for display. */
export function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    const idIdx = parts.indexOf('s') + 1;
    const id = parts[idIdx] ?? '';
    const shortId = id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
    return `${u.host}/…/${shortId}/${parts[parts.length - 1]}`;
  } catch {
    return url;
  }
}

// ───────────────────────────── test connection ─────────────────────────────

export type TestOutcome = 'connected' | 'wrong_passphrase' | 'not_apps_script' | 'unreachable' | 'server' | 'bad_url';

export interface TestResult {
  outcome: TestOutcome;
  ok: boolean;
  message: string;
  stays?: number;
  version?: string;
}

export function staysSyncedMessage(n: number): string {
  return `Connected: ${n} ${n === 1 ? 'stay' : 'stays'} synced`;
}

/** SPEC §6: `ping`, then an authorised `bootstrap`; reports in plain words. */
export async function testConnection(rawUrl: string, key: string, opts: SheetsAdapterOptions & { allowLocal?: boolean } = {}): Promise<TestResult> {
  const check = validateApiUrl(rawUrl, opts);
  if (!check.ok) return { outcome: 'bad_url', ok: false, message: check.message };
  const adapter = createSheetsAdapter({ apiUrl: check.url, key: key.trim(), connectedAt: null, lastSyncAt: null }, { timeoutMs: 15_000, ...opts });
  let version: string | undefined;
  try {
    version = (await adapter.ping()).version;
    const snap = await adapter.bootstrap();
    const stays = snap.visits.filter((v) => !v.deleted).length;
    return { outcome: 'connected', ok: true, message: staysSyncedMessage(stays), stays, version };
  } catch (e) {
    const code = isAdapterError(e) ? e.code : 'network';
    switch (code) {
      case 'unauthorized':
        return { outcome: 'wrong_passphrase', ok: false, message: adapterErrorMessage('unauthorized'), version };
      case 'not_apps_script':
        return { outcome: 'not_apps_script', ok: false, message: adapterErrorMessage('not_apps_script') };
      case 'network':
        return { outcome: 'unreachable', ok: false, message: adapterErrorMessage('network') };
      default:
        return { outcome: 'server', ok: false, message: e instanceof Error && e.message ? e.message : adapterErrorMessage('server') };
    }
  }
}

// ───────────────────────────── persistence ─────────────────────────────

const DB_NAME = 'suite-nothings-device';
let devDb: Promise<IDBPDatabase> | null = null;
function openDeviceDb(): Promise<IDBPDatabase> {
  devDb ??= openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore('kv');
    },
  });
  return devDb;
}

async function mirrorWrite(config: ConnectionConfig | null): Promise<void> {
  try {
    const db = await openDeviceDb();
    if (config) await db.put('kv', config, 'connection');
    else await db.delete('kv', 'connection');
  } catch {
    // IndexedDB unavailable (private mode): localStorage still has it.
  }
}

/** The saved connection (device prefs first; the IDB mirror is read by `restoreConnection`). */
export function getConnection(): ConnectionConfig | null {
  return getDevice('connection');
}

/** Save (or clear) the connection on this device, in both stores. */
export async function saveConnection(config: ConnectionConfig | null): Promise<void> {
  setDevice('connection', config);
  await mirrorWrite(config);
}

/** Record a successful sync time on the saved connection (quietly; no re-init). */
export function touchLastSync(iso: string): void {
  const cur = getDevice('connection');
  if (!cur) return;
  const next = { ...cur, lastSyncAt: iso };
  setDevice('connection', next);
  void mirrorWrite(next);
}

let restored: Promise<boolean> | null = null;
/**
 * Call before `initStore()`. If localStorage lost the connection but the IDB mirror still has it,
 * put it back (and keep live mode). Resolves true when something was restored. Fast path: when
 * localStorage already has it, resolves immediately (and refreshes the mirror in the background).
 */
export function restoreConnection(): Promise<boolean> {
  restored ??= (async () => {
    const local = getDevice('connection');
    if (local) {
      void mirrorWrite(local);
      return false;
    }
    try {
      const db = await openDeviceDb();
      const saved = (await db.get('kv', 'connection')) as ConnectionConfig | undefined;
      if (!saved?.apiUrl) return false;
      setDevice('connection', saved);
      if (getDevice('mode') === null) setDevice('mode', 'live');
      return true;
    } catch {
      return false;
    }
  })();
  return restored;
}

/** Keep the mirror in step with device-pref writes made elsewhere (e.g. activateLive). */
export function mirrorConnectionChanges(): () => void {
  return onDeviceChange((key) => {
    if (key === 'connection') void mirrorWrite(getDevice('connection'));
  });
}

/** A link to prefill the form: the saved one, else the build default (`VITE_API_URL`). */
export function defaultApiUrl(): string {
  return getDevice('connection')?.apiUrl ?? API_URL;
}

// ───────────────────────────── invite links ─────────────────────────────

/** `…/#/join?api=…&key=…&as=shady` for the other phone. */
export function inviteLink(config: Pick<ConnectionConfig, 'apiUrl' | 'key'>, as: PersonId, base?: string): string {
  const origin = base ?? (typeof location === 'undefined' ? '' : `${location.origin}${location.pathname}`);
  const q = new URLSearchParams({ api: config.apiUrl, key: config.key, as });
  return `${origin}#/join?${q.toString()}`;
}

export interface JoinParams {
  api: string;
  key: string;
  as: PersonId | null;
}

export type JoinParse = { ok: true; params: JoinParams } | { ok: false; message: string; partial: Partial<JoinParams> };

export function parseJoinParams(query: URLSearchParams): JoinParse {
  const api = query.get('api') ?? '';
  const key = (query.get('key') ?? '').trim();
  const asRaw = (query.get('as') ?? '').trim().toLowerCase();
  const as: PersonId | null = asRaw === 'nirsh' || asRaw === 'shady' ? asRaw : null;
  const check = validateApiUrl(api);
  if (!check.ok) return { ok: false, message: 'This invite link is missing part of our Sheet link. Paste it by hand below.', partial: { api, key, as } };
  if (!key) return { ok: false, message: 'This invite link is missing our passphrase. Type it below.', partial: { api: check.url, key, as } };
  return { ok: true, params: { api: check.url, key, as } };
}

// ───────────────────────────── demo → live (explicit only) ─────────────────────────────

/** Stays someone added by hand while in demo mode (not the sample seed). Never moved silently. */
export async function demoOnlyStays(): Promise<{ hotels: Hotel[]; visits: Visit[] }> {
  const [{ openDb: open }, { buildSeed }] = await Promise.all([import('./db'), import('./seed')]);
  const seed = buildSeed(null);
  const seedVisits = new Set(seed.visits.map((v) => v.visit_id));
  const db = await open('demo');
  const visits = (await db.getAll('visits')).filter((v) => !v.deleted && !seedVisits.has(v.visit_id));
  const hotelIds = new Set(visits.map((v) => v.hotel_id));
  const hotels = (await db.getAll('hotels')).filter((h) => hotelIds.has(h.hotel_id));
  return { hotels, visits };
}
