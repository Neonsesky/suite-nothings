/**
 * Sheets adapter: the app ⇄ Apps Script web app ⇄ Google Sheet + Drive.
 * Wire contract: apps-script/PROTOCOL.md.
 *
 * - GETs carry `action`, `key` and params in the query string.
 * - POSTs are *simple requests* (text/plain body, no custom headers) because Apps Script can't
 *   answer a CORS preflight. `fetch` follows the 302 to script.googleusercontent.com.
 * - Rows are parsed tolerantly (people edit the Sheet by hand): trimmed strings, coerced numbers
 *   and booleans, dates/times normalised, unknown enum values mapped to safe defaults.
 */
import { openDB, type IDBPDatabase } from 'idb';
import { COUPLE, type PersonId } from '@/config/couple';
import { normaliseTime, today, isIsoDate, MONTHS_SHORT } from '@/lib/dates';
import type { PlaceResult } from '@/lib/geocode';
import { openDb } from '../db';
import {
  BOOKED_VIA,
  MOODS,
  VISIT_TYPES,
  type BookedVia,
  type ConnectionConfig,
  type EnrichmentStatus,
  type HomeBase,
  type Hotel,
  type HotelSource,
  type Letter,
  type Mood,
  type OutboxOp,
  type Photo,
  type PriceLevel,
  type Rating,
  type SettingsMap,
  type Snapshot,
  type UnlockRule,
  type Visit,
  type VisitType,
  type Wish,
} from '../types';
import { AdapterError, type AdapterErrorCode, type ApplyResult, type DataAdapter } from './types';

// ───────────────────────────── tolerant cell parsing ─────────────────────────────

type Raw = Record<string, unknown>;
const EPOCH = '1970-01-01T00:00:00.000Z';

/** Look a field up by name, forgiving case and stray whitespace in the header. */
function field(row: Raw, name: string): unknown {
  if (name in row) return row[name];
  const want = name.toLowerCase();
  for (const k of Object.keys(row)) if (k.trim().toLowerCase() === want) return row[k];
  return undefined;
}

export function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const s = String(v).trim();
  return s === '' ? null : s;
}

export function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = str(v);
  if (s === null) return null;
  const n = Number(s.replace(/,/g, '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  const s = str(v)?.toLowerCase();
  return s === 'true' || s === 'yes' || s === '1' || s === 'y';
}

function intIn<T extends number>(v: unknown, min: number, max: number): T | null {
  const n = num(v);
  if (n === null) return null;
  const r = Math.round(n);
  return r >= min && r <= max ? (r as T) : null;
}

const MONTH_INDEX = new Map(MONTHS_SHORT.map((m, i) => [m.toLowerCase(), i + 1]));
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Calendar date → `YYYY-MM-DD`, from whatever Sheets or a person produced. */
export function parseDateCell(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : today(COUPLE.timezone, v);
  const s = str(v);
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : today(COUPLE.timezone, d);
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s); // DD/MM/YYYY (UK/UAE order)
  if (m) return valid(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})$/.exec(s); // 19 Jun 2026
  if (m) {
    const mo = MONTH_INDEX.get(m[2].toLowerCase());
    return mo ? valid(+m[3], mo, +m[1]) : null;
  }
  return null;
}

function valid(y: number, m: number, d: number): string | null {
  const iso = `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;
  return isIsoDate(iso) ? iso : null;
}

/** Time of day → `HH:mm`. Accepts `14:00`, `14:00:00`, `9:5`, `2pm`, a fraction of a day, a Date. */
export function parseTimeCell(v: unknown): string | null {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: COUPLE.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(v);
    const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const mi = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${h}:${mi}`;
  }
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const mins = Math.round(v * 24 * 60) % (24 * 60);
    return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
  }
  const s = str(v)?.toLowerCase();
  if (!s) return null;
  const m = /^(\d{1,2})(?:[:.](\d{1,2}))?(?::\d{1,2})?\s*(am|pm)?$/.exec(s);
  if (!m) return normaliseTime(s);
  let h = +m[1];
  const mi = m[2] ? +m[2] : 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (!m[2] && !m[3]) return null; // a bare number isn't a time
  return h < 24 && mi < 60 ? `${pad2(h)}:${pad2(mi)}` : null;
}

/** Timestamp → ISO UTC string (so string comparison orders correctly). Plain dates pass through. */
export function parseTimestamp(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const s = str(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function jsonArray(v: unknown): string | null {
  if (Array.isArray(v)) return JSON.stringify(v.map(String));
  const s = str(v);
  if (!s) return null;
  try {
    const parsed: unknown = JSON.parse(s);
    return Array.isArray(parsed) ? JSON.stringify(parsed.map(String)) : null;
  } catch {
    // A person typed a list by hand: "pool, spa, gym".
    return JSON.stringify(s.split(',').map((x) => x.trim()).filter(Boolean));
  }
}

function oneOf<T extends string>(v: unknown, list: readonly T[]): T | null {
  const s = str(v)?.toLowerCase();
  if (!s) return null;
  return list.find((x) => x.toLowerCase() === s) ?? null;
}

const PEOPLE_IDS = ['nirsh', 'shady'] as const satisfies readonly PersonId[];
const person = (v: unknown): PersonId | null => oneOf(v, PEOPLE_IDS);
const SOURCES = ['photon', 'manual', 'seed', 'wishlist'] as const satisfies readonly HotelSource[];
const ENRICH = ['none', 'pending', 'done', 'failed', 'skipped'] as const satisfies readonly EnrichmentStatus[];

function priceLevel(v: unknown): PriceLevel | null {
  const s = str(v);
  if (s && /^[¤$€£]{1,4}$/.test(s)) return s.length as PriceLevel;
  return intIn<PriceLevel>(v, 1, 4);
}

function unlockRule(v: unknown): UnlockRule {
  const s = str(v)?.replace(/\s+/g, '').toLowerCase();
  if (!s) return 'always';
  if (s === 'always' || s === 'first_abroad') return s;
  if (/^(visits|hotels)>=\d+$/.test(s)) return s as UnlockRule;
  const d = /^date>=(.+)$/.exec(s);
  if (d) {
    const iso = parseDateCell(d[1]);
    if (iso) return `date>=${iso}`;
  }
  return s as UnlockRule; // unknown rules stay locked (see features/letters/unlock.ts)
}

function stamps(row: Raw) {
  const created = parseTimestamp(field(row, 'created_at'));
  const updated = parseTimestamp(field(row, 'updated_at')) ?? created ?? EPOCH;
  return { created_at: created ?? updated, updated_at: updated };
}

export function parseHotel(row: Raw): Hotel | null {
  const hotel_id = str(field(row, 'hotel_id'));
  const lat = num(field(row, 'lat'));
  const lng = num(field(row, 'lng'));
  if (!hotel_id) return null;
  return {
    hotel_id,
    name: str(field(row, 'name')) ?? 'A hotel we loved',
    brand: str(field(row, 'brand')),
    address: str(field(row, 'address')),
    area: str(field(row, 'area')),
    city: str(field(row, 'city')) ?? '',
    region: str(field(row, 'region')),
    country: str(field(row, 'country')) ?? '',
    country_code: (str(field(row, 'country_code')) ?? '').toUpperCase(),
    lat: lat ?? 0,
    lng: lng ?? 0,
    source: oneOf(field(row, 'source'), SOURCES) ?? 'manual',
    osm_id: str(field(row, 'osm_id')),
    wikidata_id: str(field(row, 'wikidata_id')),
    website: str(field(row, 'website')),
    phone: str(field(row, 'phone')),
    stars: intIn(field(row, 'stars'), 1, 5),
    price_level: priceLevel(field(row, 'price_level')),
    description: str(field(row, 'description')),
    description_source: str(field(row, 'description_source')),
    amenities_json: jsonArray(field(row, 'amenities_json')),
    cover_photo_id: str(field(row, 'cover_photo_id')),
    enrichment_status: oneOf(field(row, 'enrichment_status'), ENRICH) ?? 'none',
    enriched_at: parseTimestamp(field(row, 'enriched_at')),
    image_url: str(field(row, 'image_url')),
    image_credit: str(field(row, 'image_credit')),
    enriched_fields_json: jsonArray(field(row, 'enriched_fields_json')),
    ...stamps(row),
    deleted: bool(field(row, 'deleted')),
  };
}

export function parseVisit(row: Raw): Visit | null {
  const visit_id = str(field(row, 'visit_id'));
  const hotel_id = str(field(row, 'hotel_id'));
  const date = parseDateCell(field(row, 'date'));
  if (!visit_id || !hotel_id || !date) return null;
  const picked = str(field(row, 'picked_by'))?.toLowerCase();
  return {
    visit_id,
    hotel_id,
    date,
    check_in: parseTimeCell(field(row, 'check_in')),
    check_out: parseTimeCell(field(row, 'check_out')),
    nights: Math.max(0, Math.round(num(field(row, 'nights')) ?? 0)),
    visit_type: (oneOf(field(row, 'visit_type'), VISIT_TYPES) ?? 'Other') as VisitType,
    booked_via: (oneOf(field(row, 'booked_via'), BOOKED_VIA) ?? (str(field(row, 'booked_via')) ? 'Other' : null)) as BookedVia | null,
    note: str(field(row, 'note')),
    favourite_moment: str(field(row, 'favourite_moment')),
    mood: oneOf(field(row, 'mood'), MOODS) as Mood | null,
    rating_nirsh: intIn<Rating>(field(row, 'rating_nirsh'), 1, 5),
    rating_shady: intIn<Rating>(field(row, 'rating_shady'), 1, 5),
    picked_by: picked === 'both' ? 'both' : person(picked),
    added_by: person(field(row, 'added_by')),
    photo_ids_json: jsonArray(field(row, 'photo_ids_json')),
    ...stamps(row),
    deleted: bool(field(row, 'deleted')),
  };
}

export function parsePhoto(row: Raw): Photo | null {
  const photo_id = str(field(row, 'photo_id'));
  const visit_id = str(field(row, 'visit_id'));
  if (!photo_id || !visit_id) return null;
  return {
    photo_id,
    visit_id,
    thumb_file_id: str(field(row, 'thumb_file_id')),
    full_file_id: str(field(row, 'full_file_id')),
    width: num(field(row, 'width')) ?? 0,
    height: num(field(row, 'height')) ?? 0,
    taken_at: parseTimestamp(field(row, 'taken_at')),
    caption: str(field(row, 'caption')),
    ...stamps(row),
    deleted: bool(field(row, 'deleted')),
  };
}

export function parseWish(row: Raw): Wish | null {
  const wish_id = str(field(row, 'wish_id'));
  const name = str(field(row, 'name'));
  if (!wish_id || !name) return null;
  return {
    wish_id,
    name,
    lat: num(field(row, 'lat')),
    lng: num(field(row, 'lng')),
    city: str(field(row, 'city')),
    country: str(field(row, 'country')),
    note: str(field(row, 'note')),
    added_by: person(field(row, 'added_by')),
    priority: intIn<1 | 2 | 3>(field(row, 'priority'), 1, 3),
    fulfilled_visit_id: str(field(row, 'fulfilled_visit_id')),
    ...stamps(row),
    deleted: bool(field(row, 'deleted')),
  };
}

export function parseLetter(row: Raw): Letter | null {
  const letter_id = str(field(row, 'letter_id'));
  const body = field(row, 'body_md');
  if (!letter_id || body === null || body === undefined || String(body).trim() === '') return null;
  const read_at = parseTimestamp(field(row, 'read_at'));
  const created_at = parseTimestamp(field(row, 'created_at')) ?? EPOCH;
  const updated_at = parseTimestamp(field(row, 'updated_at')) ?? read_at ?? created_at;
  return {
    letter_id,
    title: str(field(row, 'title')) ?? 'A note for you',
    // Keep the body exactly as written (line breaks included); only trim the ends.
    body_md: String(body).replace(/\r\n/g, '\n').trim(),
    from: person(field(row, 'from')) ?? 'nirsh',
    to: person(field(row, 'to')) ?? 'shady',
    unlock_rule: unlockRule(field(row, 'unlock_rule')),
    written_at: parseTimestamp(field(row, 'written_at')) ?? created_at,
    read_at,
    created_at,
    updated_at,
  };
}

function parseHomeBase(v: unknown): HomeBase | null {
  let o: unknown = v;
  if (typeof v === 'string') {
    try {
      o = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== 'object') return null;
  const r = o as Raw;
  const lat = num(r.lat);
  const lng = num(r.lng);
  const city = str(r.city);
  if (lat === null || lng === null || !city) return null;
  const bbox = Array.isArray(r.bbox) && r.bbox.length === 4 && r.bbox.every((x) => num(x) !== null) ? (r.bbox.map((x) => num(x)) as HomeBase['bbox']) : undefined;
  return {
    city,
    country: str(r.country) ?? '',
    countryCode: (str(r.countryCode) ?? str(r.country_code) ?? '').toUpperCase(),
    lat,
    lng,
    ...(bbox ? { bbox } : {}),
  };
}

export function parseSettings(v: unknown): Partial<SettingsMap> {
  let r: Raw = {};
  if (Array.isArray(v)) {
    // Raw key/value rows, in case a server sends the tab as-is.
    for (const row of v as Raw[]) {
      const k = str(field(row, 'key'));
      if (k) r[k] = field(row, 'value');
    }
  } else if (v && typeof v === 'object') r = v as Raw;
  const out: Partial<SettingsMap> = {};
  const home = parseHomeBase(r.home_base);
  if (home) out.home_base = home;
  const lighting = oneOf(r.map_lighting, ['auto', 'day', 'golden', 'night'] as const);
  if (lighting) out.map_lighting = lighting;
  const units = oneOf(r.units, ['km', 'mi'] as const);
  if (units) out.units = units;
  const updated = parseTimestamp(r.updated_at);
  if (updated && Object.keys(out).length) out.updated_at = updated;
  return out;
}

function rows<T>(v: unknown, parse: (r: Raw) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const r of v) {
    if (!r || typeof r !== 'object') continue;
    const parsed = parse(r as Raw);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function parseSnapshot(data: unknown): Snapshot {
  const d = (data && typeof data === 'object' ? data : {}) as Raw;
  return {
    hotels: rows(d.hotels, parseHotel),
    visits: rows(d.visits, parseVisit),
    photos: rows(d.photos, parsePhoto),
    wishes: rows(d.wishes ?? d.wishlist, parseWish),
    letters: rows(d.letters, parseLetter),
    settings: parseSettings(d.settings),
    serverTime: parseTimestamp(d.serverTime) ?? new Date().toISOString(),
  };
}

// ───────────────────────────── transport ─────────────────────────────

export const DEFAULT_TIMEOUT_MS = 20_000;
export const UPLOAD_TIMEOUT_MS = 90_000;

export interface SheetsAdapterOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Where outbox photo blobs live (defaults to the live namespace's `photoBlobs` store). */
  readBlob?: (key: string) => Promise<Blob | null>;
  /** Photo cache (defaults to IndexedDB `suite-nothings-photo-cache`). */
  photoCache?: PhotoCache;
}

export interface PhotoCache {
  get(fileId: string): Promise<Blob | null>;
  put(fileId: string, blob: Blob): Promise<void>;
}

interface Envelope {
  ok: boolean;
  data?: unknown;
  error?: { code?: string; message?: string };
}

function looksLikeHtml(text: string): boolean {
  return /^\s*<(!doctype|html|head|body|\?xml)/i.test(text);
}

function isEnvelope(v: unknown): v is Envelope {
  return !!v && typeof v === 'object' && typeof (v as Envelope).ok === 'boolean';
}

const SERVER_CODES: Record<string, AdapterErrorCode> = {
  unauthorized: 'unauthorized',
  conflict: 'conflict',
  bad_request: 'server',
  not_found: 'server',
  server: 'server',
};

/** The typed `AdapterError` for a failed request (exported for tests). */
export function mapServerError(err: Envelope['error'], forWrite: boolean): AdapterError {
  const code = err?.code ?? 'server';
  // A write whose target is gone can never succeed; treat like a conflict so the op is dropped
  // and the next pull brings the Sheet's truth.
  if (forWrite && code === 'not_found') return new AdapterError('conflict', err?.message ?? 'Not in our Sheet any more');
  return new AdapterError(SERVER_CODES[code] ?? 'server', err?.message ?? 'Our Sheet had a problem');
}

function withTimeout(ms: number): { signal: AbortSignal; done(): void; timedOut(): boolean } {
  const ctrl = new AbortController();
  let fired = false;
  const t = setTimeout(() => {
    fired = true;
    ctrl.abort();
  }, ms);
  return { signal: ctrl.signal, done: () => clearTimeout(t), timedOut: () => fired };
}

export function createSheetsAdapter(config: ConnectionConfig, opts: SheetsAdapterOptions = {}): SheetsAdapter {
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => globalThis.fetch(...a));
  const baseTimeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const readBlob = opts.readBlob ?? defaultReadBlob;
  const cache = opts.photoCache ?? idbPhotoCache;
  const apiUrl = config.apiUrl.trim();

  async function send(init: { method: 'GET'; params: Record<string, string> } | { method: 'POST'; body: unknown }, timeoutMs = baseTimeout): Promise<unknown> {
    if (!apiUrl) throw new AdapterError('not_configured', 'Not connected to our Sheet yet');
    let url: URL;
    try {
      url = new URL(apiUrl);
    } catch {
      throw new AdapterError('not_apps_script', "This isn't an Apps Script web app link");
    }
    const t = withTimeout(timeoutMs);
    let res: Response;
    try {
      if (init.method === 'GET') {
        for (const [k, v] of Object.entries(init.params)) url.searchParams.set(k, v);
        res = await doFetch(url.toString(), { method: 'GET', redirect: 'follow', signal: t.signal, credentials: 'omit', cache: 'no-store' });
      } else {
        res = await doFetch(url.toString(), {
          method: 'POST',
          redirect: 'follow',
          signal: t.signal,
          credentials: 'omit',
          // text/plain keeps this a CORS "simple request": Apps Script can't answer a preflight.
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(init.body),
        });
      }
    } catch (e) {
      t.done();
      const msg = t.timedOut() ? 'Our Sheet took too long to answer' : e instanceof Error ? e.message : String(e);
      throw new AdapterError('network', msg);
    }
    let text: string;
    try {
      text = await res.text();
    } catch (e) {
      throw new AdapterError('network', e instanceof Error ? e.message : String(e));
    } finally {
      t.done();
    }
    if (/accounts\.google\.com|ServiceLogin/.test(res.url) || looksLikeHtml(text) || res.status === 404) {
      throw new AdapterError('not_apps_script', "This isn't an Apps Script web app link");
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      if (res.status >= 500) throw new AdapterError('server', `Our Sheet answered ${res.status}`);
      throw new AdapterError('not_apps_script', "This isn't an Apps Script web app link");
    }
    if (!isEnvelope(body)) throw new AdapterError('not_apps_script', "This isn't an Apps Script web app link");
    if (!body.ok) throw mapServerError(body.error, init.method === 'POST');
    return body.data ?? {};
  }

  const get = (action: string, params: Record<string, string> = {}, timeoutMs?: number) =>
    send({ method: 'GET', params: { action, ...params, ...(action === 'ping' ? {} : { key: config.key }) } }, timeoutMs);
  const post = (action: string, payload: unknown, timeoutMs?: number) => send({ method: 'POST', body: { key: config.key, action, payload } }, timeoutMs);

  const inFlight = new Map<string, Promise<Blob>>();

  async function apply(op: OutboxOp): Promise<ApplyResult> {
    switch (op.action) {
      case 'upsertHotel':
        return rowResult(await post('upsertHotel', op.payload), 'hotels', parseHotel);
      case 'upsertVisit':
        return rowResult(await post('upsertVisit', op.payload), 'visits', parseVisit);
      case 'deleteVisit':
        return rowResult(await post('deleteVisit', op.payload), 'visits', parseVisit);
      case 'upsertWish':
        return rowResult(await post('upsertWish', op.payload), 'wishes', parseWish);
      case 'markLetterRead':
        return rowResult(await post('markLetterRead', op.payload), 'letters', parseLetter);
      case 'upsertLetter':
        return rowResult(await post('upsertLetter', op.payload), 'letters', parseLetter);
      case 'updateSettings': {
        const data = (await post('updateSettings', op.payload)) as Raw;
        return { ok: true, applied: { settings: parseSettings(data.settings) }, serverTime: parseTimestamp(data.serverTime) ?? undefined };
      }
      case 'uploadPhoto': {
        const { photo, thumb_key, full_key } = op.payload;
        // Already uploaded (replay after a lost response): send only the row, no bytes.
        const needBytes = !photo.thumb_file_id && !photo.full_file_id;
        const [thumb, full] = needBytes ? await Promise.all([thumb_key ? readBlob(thumb_key) : null, full_key ? readBlob(full_key) : null]) : [null, null];
        const data = (await post(
          'uploadPhoto',
          { photo, thumb: thumb ? await encodeBlob(thumb) : null, full: full ? await encodeBlob(full) : null },
          UPLOAD_TIMEOUT_MS,
        )) as Raw;
        const res = rowResult(data, 'photos', parsePhoto);
        const ids = (data.fileIds ?? {}) as Raw;
        const row = res.applied?.photos?.[0];
        res.fileIds = {
          thumb_file_id: str(ids.thumb_file_id) ?? row?.thumb_file_id ?? null,
          full_file_id: str(ids.full_file_id) ?? row?.full_file_id ?? null,
        };
        // Our own upload: keep the local bytes as the cache for those file ids.
        if (thumb && res.fileIds.thumb_file_id) void cache.put(res.fileIds.thumb_file_id, thumb).catch(() => undefined);
        if (full && res.fileIds.full_file_id) void cache.put(res.fileIds.full_file_id, full).catch(() => undefined);
        return res;
      }
    }
  }

  return {
    kind: 'sheets',
    async ping() {
      const data = (await get('ping')) as Raw;
      return { ok: true, version: str(data.version) ?? undefined };
    },
    async bootstrap() {
      return parseSnapshot(await get('bootstrap', {}, Math.max(baseTimeout, 30_000)));
    },
    async changes(sinceIso: string) {
      return parseSnapshot(await get('changes', { since: sinceIso }));
    },
    apply,
    async getPhoto(id: string) {
      const hit = await cache.get(id).catch(() => null);
      if (hit) return hit;
      let p = inFlight.get(id);
      if (!p) {
        p = (async () => {
          const data = (await get('photo', { id }, 60_000)) as Raw;
          const b64 = str(data.base64);
          if (!b64) throw new AdapterError('server', 'That photo is missing from our Drive folder');
          const blob = decodeBlob(b64, str(data.mime) ?? 'image/jpeg');
          await cache.put(id, blob).catch(() => undefined);
          return blob;
        })().finally(() => inFlight.delete(id));
        inFlight.set(id, p);
      }
      return p;
    },
    async geocode(query: string, near?: { lat: number; lng: number }) {
      const data = (await post('geocode', { query, ...(near ? { near } : {}) })) as Raw;
      return rows(data.results, toPlace);
    },
    async invoke(action: string, payload: unknown) {
      return post(action, payload);
    },
    async upsertLetter(letter: Letter) {
      const res = rowResult(await post('upsertLetter', letter), 'letters', parseLetter);
      return res.applied?.letters?.[0] ?? letter;
    },
  };
}

/** The Sheets adapter also lets Nirsh write future letters from the app. */
export interface SheetsAdapter extends DataAdapter {
  upsertLetter(letter: Letter): Promise<Letter>;
}

type RowKey = 'hotels' | 'visits' | 'photos' | 'wishes' | 'letters';

function rowResult<K extends RowKey>(data: unknown, key: K, parse: (r: Raw) => Snapshot[K][number] | null): ApplyResult {
  const d = (data ?? {}) as Raw;
  const row = d.row && typeof d.row === 'object' ? parse(d.row as Raw) : null;
  const applied: Partial<Snapshot> = row ? ({ [key]: [row] } as Partial<Snapshot>) : {};
  return { ok: true, applied, serverTime: parseTimestamp(d.serverTime) ?? undefined };
}

function toPlace(r: Raw): PlaceResult | null {
  const lat = num(r.lat);
  const lng = num(r.lng);
  const name = str(r.name) ?? str(r.address);
  if (lat === null || lng === null || !name) return null;
  const address = str(r.address);
  return {
    id: `server:${lat.toFixed(5)},${lng.toFixed(5)}`,
    name,
    lat,
    lng,
    osm_id: null,
    kind: null,
    isHotel: false,
    street: null,
    housenumber: null,
    area: null,
    city: str(r.city),
    region: str(r.region),
    country: str(r.country),
    country_code: str(r.country_code)?.toUpperCase() ?? null,
    postcode: str(r.postcode),
    address,
    tags: {},
    source: 'server',
  };
}

// ───────────────────────────── blobs ─────────────────────────────

export async function encodeBlob(blob: Blob): Promise<{ mime: string; base64: string }> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return { mime: blob.type || 'image/jpeg', base64: btoa(bin) };
}

export function decodeBlob(base64: string, mime: string): Blob {
  const bin = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function defaultReadBlob(key: string): Promise<Blob | null> {
  const db = await openDb('live');
  const row = await db.get('photoBlobs', key);
  if (!row) return null;
  // WebKit may store `bytes` instead of a Blob (see PhotoBlob in types.ts).
  return row.blob instanceof Blob ? row.blob : row.bytes ? new Blob([row.bytes], { type: row.mime }) : null;
}

let cacheDb: Promise<IDBPDatabase> | null = null;
function openCache(): Promise<IDBPDatabase> {
  cacheDb ??= openDB('suite-nothings-photo-cache', 1, {
    upgrade(db) {
      db.createObjectStore('files');
    },
  });
  return cacheDb;
}

/** Drive photos cached by file id, so each one downloads once per device. */
export const idbPhotoCache: PhotoCache = {
  async get(fileId) {
    const v: unknown = await (await openCache()).get('files', fileId);
    return v instanceof Blob ? v : null;
  },
  async put(fileId, blob) {
    await (await openCache()).put('files', blob, fileId);
  },
};
