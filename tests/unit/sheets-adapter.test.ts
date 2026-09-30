import { describe, expect, it, vi } from 'vitest';
import {
  createSheetsAdapter,
  decodeBlob,
  encodeBlob,
  parseDateCell,
  parseHotel,
  parseLetter,
  parseSettings,
  parseSnapshot,
  parseTimeCell,
  parseVisit,
  type PhotoCache,
} from '@/data/adapters/sheets';
import { AdapterError } from '@/data/adapters/types';
import type { ConnectionConfig, OutboxOp, Visit } from '@/data/types';

const CONFIG: ConnectionConfig = { apiUrl: 'https://script.google.com/macros/s/AKfycbxTESTTESTTEST/exec', key: 'our-key', connectedAt: null, lastSyncAt: null };

type Call = { url: string; init: RequestInit };

function fakeFetch(handler: (url: URL, init: RequestInit) => { status?: number; body: string; url?: string } | Promise<never>) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const out = await handler(new URL(url), init);
    const res = new Response(out.body, { status: out.status ?? 200 });
    Object.defineProperty(res, 'url', { value: out.url ?? url });
    return res;
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

const ok = (data: unknown) => ({ body: JSON.stringify({ ok: true, data }) });
const fail = (code: string, message = code) => ({ body: JSON.stringify({ ok: false, error: { code, message } }) });

function memoryCache(): PhotoCache & { map: Map<string, Blob> } {
  const map = new Map<string, Blob>();
  return { map, get: async (k) => map.get(k) ?? null, put: async (k, b) => void map.set(k, b) };
}

const visitRow = {
  visit_id: 'V1',
  hotel_id: 'H1',
  date: '2026-06-19',
  check_in: '14:00',
  check_out: '20:00',
  nights: 0,
  visit_type: 'Dayuse',
  added_by: 'nirsh',
  created_at: '2026-06-19T10:00:00.000Z',
  updated_at: '2026-06-19T10:00:00.000Z',
  deleted: false,
};

describe('tolerant cell parsing', () => {
  it('normalises dates from every shape Sheets or a person produces', () => {
    expect(parseDateCell('2026-06-19')).toBe('2026-06-19');
    expect(parseDateCell(' 2026/6/9 ')).toBe('2026-06-09');
    expect(parseDateCell('19/06/2026')).toBe('2026-06-19');
    expect(parseDateCell('19 Jun 2026')).toBe('2026-06-19');
    // Sheets Date object at local midnight in Dubai = 20:00Z the previous day.
    expect(parseDateCell(new Date('2026-06-18T20:00:00.000Z'))).toBe('2026-06-19');
    expect(parseDateCell('2026-06-18T20:00:00.000Z')).toBe('2026-06-19');
    expect(parseDateCell('2026-02-30')).toBeNull();
    expect(parseDateCell('')).toBeNull();
  });

  it('normalises times to HH:mm', () => {
    expect(parseTimeCell('14:00')).toBe('14:00');
    expect(parseTimeCell('9:05:00')).toBe('09:05');
    expect(parseTimeCell('2pm')).toBe('14:00');
    expect(parseTimeCell('12:30 AM')).toBe('00:30');
    expect(parseTimeCell(14 / 24)).toBe('14:00');
    expect(parseTimeCell(new Date('1899-12-30T10:00:00.000Z'))).toMatch(/^\d{2}:\d{2}$/);
    expect(parseTimeCell('14')).toBeNull();
    expect(parseTimeCell('')).toBeNull();
  });

  it('parses a messy visit row: whitespace, odd case, strings for numbers and booleans', () => {
    const v = parseVisit({
      ' visit_id ': ' V9 ',
      hotel_id: 'H1',
      date: '19/06/2026',
      check_in: '2pm',
      nights: '1',
      visit_type: 'pool DAY',
      booked_via: 'Expedia',
      mood: 'Cosy',
      rating_nirsh: '5',
      rating_shady: '9',
      picked_by: 'BOTH',
      added_by: ' Shady ',
      photo_ids_json: '["P1","P2"]',
      deleted: 'TRUE',
      updated_at: '',
      created_at: '2026-06-19T10:00:00Z',
      extra_column: 'kept by the server, ignored here',
    })!;
    expect(v).toMatchObject({
      visit_id: 'V9',
      date: '2026-06-19',
      check_in: '14:00',
      check_out: null,
      nights: 1,
      visit_type: 'Pool day',
      booked_via: 'Other',
      mood: 'cosy',
      rating_nirsh: 5,
      rating_shady: null,
      picked_by: 'both',
      added_by: 'shady',
      photo_ids_json: '["P1","P2"]',
      deleted: true,
      created_at: '2026-06-19T10:00:00.000Z',
      updated_at: '2026-06-19T10:00:00.000Z',
    });
  });

  it('skips rows without ids (blank rows) and keeps hotels with string coordinates', () => {
    expect(parseVisit({ visit_id: '', hotel_id: 'H1', date: '2026-06-19' })).toBeNull();
    const h = parseHotel({ hotel_id: 'H1', name: ' Golden Tulip ', lat: '25.11', lng: '55.2', stars: '4', price_level: '¤¤¤', country_code: 'ae', amenities_json: 'pool, spa', deleted: '' })!;
    expect(h).toMatchObject({ name: 'Golden Tulip', lat: 25.11, lng: 55.2, stars: 4, price_level: 3, country_code: 'AE', amenities_json: '["pool","spa"]', deleted: false, source: 'manual' });
  });

  it('letters keep their body verbatim and derive updated_at from read_at', () => {
    const l = parseLetter({ letter_id: 'L1', title: 'Hi', body_md: 'line one\r\n\r\nline two', from: 'nirsh', to: 'shady', unlock_rule: ' Visits >= 5 ', read_at: '2026-09-20T08:00:00Z', created_at: '2026-09-19T08:00:00Z' })!;
    expect(l.body_md).toBe('line one\n\nline two');
    expect(l.unlock_rule).toBe('visits>=5');
    expect(l.updated_at).toBe('2026-09-20T08:00:00.000Z');
  });

  it('settings accept an object or raw key/value rows', () => {
    const home = { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', lat: 25.2, lng: 55.27 };
    expect(parseSettings({ home_base: JSON.stringify(home), map_lighting: 'Night', units: 'mi', updated_at: '2026-09-01T00:00:00Z' })).toEqual({
      home_base: home,
      map_lighting: 'night',
      units: 'mi',
      updated_at: '2026-09-01T00:00:00.000Z',
    });
    expect(parseSettings([{ key: 'units', value: 'km' }, { key: 'updated_at', value: '2026-09-01T00:00:00Z' }])).toEqual({ units: 'km', updated_at: '2026-09-01T00:00:00.000Z' });
    expect(parseSettings({ home_base: 'not json' })).toEqual({});
  });

  it('parseSnapshot tolerates missing tabs', () => {
    const s = parseSnapshot({ visits: [visitRow, null, 'x'], serverTime: '2026-09-30T12:00:00Z' });
    expect(s.visits).toHaveLength(1);
    expect(s.hotels).toEqual([]);
    expect(s.serverTime).toBe('2026-09-30T12:00:00.000Z');
  });
});

describe('createSheetsAdapter transport', () => {
  it('GETs with action, key and params, following redirects', async () => {
    const { fetch, calls } = fakeFetch((url) => ok({ visits: [visitRow], serverTime: '2026-09-30T12:00:00.000Z', echo: url.searchParams.get('since') }));
    const a = createSheetsAdapter(CONFIG, { fetch });
    const snap = await a.changes('2026-09-30T11:00:00.000Z');
    expect(snap.visits[0].visit_id).toBe('V1');
    const u = new URL(calls[0].url);
    expect(u.searchParams.get('action')).toBe('changes');
    expect(u.searchParams.get('key')).toBe('our-key');
    expect(u.searchParams.get('since')).toBe('2026-09-30T11:00:00.000Z');
    expect(calls[0].init.redirect).toBe('follow');
  });

  it('ping sends no key', async () => {
    const { fetch, calls } = fakeFetch(() => ({ body: JSON.stringify({ ok: true, version: '1.0.0', data: { version: '1.0.0' } }) }));
    expect(await createSheetsAdapter(CONFIG, { fetch }).ping()).toEqual({ ok: true, version: '1.0.0' });
    expect(new URL(calls[0].url).searchParams.has('key')).toBe(false);
  });

  it('POSTs as a CORS simple request (text/plain, JSON body, no custom headers)', async () => {
    const { fetch, calls } = fakeFetch(() => ok({ row: { ...visitRow, note: 'from server' }, applied: true, serverTime: '2026-09-30T12:00:00.000Z' }));
    const a = createSheetsAdapter(CONFIG, { fetch });
    const op: OutboxOp = { op_id: 'O1', action: 'upsertVisit', payload: parseVisit(visitRow) as Visit, created_at: '', attempts: 0 };
    const res = await a.apply(op);
    expect(res.applied?.visits?.[0].note).toBe('from server');
    const init = calls[0].init;
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' });
    expect(JSON.parse(String(init.body))).toMatchObject({ key: 'our-key', action: 'upsertVisit', payload: { visit_id: 'V1' } });
  });

  const cases: [string, Parameters<typeof fakeFetch>[0], string][] = [
    ['an HTML page', () => ({ body: '<!DOCTYPE html><html><body>Sorry, unable to open the file</body></html>' }), 'not_apps_script'],
    ['a Google sign-in redirect', () => ({ body: '{}', url: 'https://accounts.google.com/ServiceLogin?continue=x' }), 'not_apps_script'],
    ['a 404', () => ({ status: 404, body: 'Not Found' }), 'not_apps_script'],
    ['non-JSON text', () => ({ body: 'hello' }), 'not_apps_script'],
    ['JSON that is not our envelope', () => ({ body: '{"hello":1}' }), 'not_apps_script'],
    ['an auth error', () => fail('unauthorized', 'Wrong passphrase'), 'unauthorized'],
    ['a server error', () => fail('server', 'boom'), 'server'],
    ['a 500 with no JSON', () => ({ status: 500, body: 'oops' }), 'server'],
    ['a TypeError (offline, CORS)', () => Promise.reject(new TypeError('Failed to fetch')), 'network'],
  ];
  for (const [name, handler, code] of cases) {
    it(`maps ${name} → ${code}`, async () => {
      const { fetch } = fakeFetch(handler);
      await expect(createSheetsAdapter(CONFIG, { fetch }).bootstrap()).rejects.toMatchObject({ code });
    });
  }

  it('maps a timeout → network', async () => {
    const fetch = ((_: unknown, init: RequestInit) =>
      new Promise((_r, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as unknown as typeof globalThis.fetch;
    const err = await createSheetsAdapter(CONFIG, { fetch, timeoutMs: 20 }).changes('2026-09-30T00:00:00.000Z').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdapterError);
    expect(err).toMatchObject({ code: 'network', retryable: true });
  });

  it('a write to a row the Sheet no longer has is a conflict (dropped, not retried forever)', async () => {
    const { fetch } = fakeFetch(() => fail('not_found'));
    const op: OutboxOp = { op_id: 'O', action: 'deleteVisit', payload: { visit_id: 'gone', deleted: true, updated_at: 'x' }, created_at: '', attempts: 0 };
    await expect(createSheetsAdapter(CONFIG, { fetch }).apply(op)).rejects.toMatchObject({ code: 'conflict' });
  });

  it('uploads photo blobs as base64 and returns the Drive file ids', async () => {
    const blobs = new Map([
      ['P1:thumb', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })],
      ['P1:full', new Blob([new Uint8Array([4, 5, 6, 7])], { type: 'image/jpeg' })],
    ]);
    const cache = memoryCache();
    const { fetch, calls } = fakeFetch(() =>
      ok({ row: { photo_id: 'P1', visit_id: 'V1', thumb_file_id: 'D-T', full_file_id: 'D-F', created_at: '2026-09-30T00:00:00Z' }, fileIds: { thumb_file_id: 'D-T', full_file_id: 'D-F' }, applied: true }),
    );
    const a = createSheetsAdapter(CONFIG, { fetch, readBlob: async (k) => blobs.get(k) ?? null, photoCache: cache });
    const photo = { photo_id: 'P1', visit_id: 'V1', thumb_file_id: null, full_file_id: null, width: 4, height: 3, taken_at: null, caption: null, created_at: 'x', updated_at: 'x', deleted: false };
    const res = await a.apply({ op_id: 'O', action: 'uploadPhoto', payload: { photo, thumb_key: 'P1:thumb', full_key: 'P1:full' }, created_at: '', attempts: 0 });
    expect(res.fileIds).toEqual({ thumb_file_id: 'D-T', full_file_id: 'D-F' });
    const body = JSON.parse(String(calls[0].init.body)) as { payload: { thumb: { base64: string }; full: { base64: string } } };
    expect(body.payload.thumb.base64).toBe(btoa(String.fromCharCode(1, 2, 3)));
    expect(body.payload.full.base64).toBe(btoa(String.fromCharCode(4, 5, 6, 7)));
    await Promise.resolve();
    expect(cache.map.has('D-T')).toBe(true);
  });

  it('getPhoto downloads once, then serves from the cache', async () => {
    const cache = memoryCache();
    const { fetch, calls } = fakeFetch(() => ok({ mime: 'image/webp', base64: btoa('abc') }));
    const a = createSheetsAdapter(CONFIG, { fetch, photoCache: cache });
    const [b1, b2] = await Promise.all([a.getPhoto('D1'), a.getPhoto('D1')]);
    expect(b1.type).toBe('image/webp');
    expect(await b1.text()).toBe('abc');
    expect(b2).toBe(b1);
    await a.getPhoto('D1');
    expect(calls).toHaveLength(1);
  });

  it('base64 helpers round-trip binary data', async () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 256);
    const enc = await encodeBlob(new Blob([bytes], { type: 'image/jpeg' }));
    const back = new Uint8Array(await decodeBlob(enc.base64, enc.mime).arrayBuffer());
    expect(back).toEqual(bytes);
  });

  it('geocode maps server results to PlaceResult', async () => {
    const { fetch } = fakeFetch(() => ok({ results: [{ name: 'Burj Al Arab', address: 'Jumeirah St, Dubai', lat: 25.14, lng: 55.18, country_code: 'ae', city: 'Dubai' }, { name: 'no coords' }] }));
    const r = await createSheetsAdapter(CONFIG, { fetch }).geocode('burj', { lat: 25, lng: 55 });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: 'Burj Al Arab', source: 'server', country_code: 'AE', city: 'Dubai' });
  });
});
