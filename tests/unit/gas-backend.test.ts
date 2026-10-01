// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createGasEnv, type GasEnv } from '../../tools/gas-harness/index.mjs';

const KEY = 'pillow mint balcony';
const HEADERS: Record<string, string[]> = {
  Hotels: ['hotel_id', 'name', 'brand', 'address', 'area', 'city', 'region', 'country', 'country_code', 'lat', 'lng', 'source', 'osm_id', 'wikidata_id', 'website', 'phone', 'stars', 'price_level', 'description', 'description_source', 'amenities_json', 'cover_photo_id', 'enrichment_status', 'enriched_at', 'created_at', 'updated_at', 'deleted', 'server_updated_at', 'image_url', 'image_credit', 'enriched_fields_json'],
  Visits: ['visit_id', 'hotel_id', 'date', 'check_in', 'check_out', 'nights', 'visit_type', 'booked_via', 'note', 'favourite_moment', 'mood', 'rating_nirsh', 'rating_shady', 'picked_by', 'added_by', 'photo_ids_json', 'created_at', 'updated_at', 'deleted', 'server_updated_at'],
  Photos: ['photo_id', 'visit_id', 'thumb_file_id', 'full_file_id', 'width', 'height', 'taken_at', 'caption', 'created_at', 'deleted', 'updated_at', 'server_updated_at'],
  Wishlist: ['wish_id', 'name', 'lat', 'lng', 'city', 'country', 'note', 'added_by', 'priority', 'fulfilled_visit_id', 'created_at', 'updated_at', 'deleted', 'server_updated_at'],
  Letters: ['letter_id', 'title', 'body_md', 'from', 'to', 'unlock_rule', 'written_at', 'read_at', 'created_at', 'updated_at', 'server_updated_at'],
  Settings: ['key', 'value'],
  Log: ['timestamp', 'actor', 'action', 'detail'],
};

function ready(): GasEnv {
  const env = createGasEnv({ appKey: KEY });
  env.run('setup');
  return env;
}
const post = (env: GasEnv, action: string, payload: unknown, key: string = KEY) => env.call.post({ key, action, payload });
const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
function visit(over: Record<string, unknown> = {}) {
  return { visit_id: 'V1', hotel_id: 'H1', date: '2026-06-19', check_in: '14:00', check_out: '18:00', nights: 0, visit_type: 'Dayuse', mood: 'cosy', added_by: 'nirsh', created_at: '2026-06-19T10:00:00.000Z', updated_at: '2026-06-19T10:00:00.000Z', deleted: false, ...over };
}

describe('setup()', () => {
  it('creates every tab with exact headers, frozen bold header, validations, formats, folder and properties', () => {
    const env = createGasEnv({ promptResponse: { button: 'OK', text: '  ' + KEY + ' ' } });
    const summary = env.run('setup') as string;
    expect(summary).toContain('Passphrase saved');
    expect(env.prompts[0].title).toBe('Choose our passphrase');
    expect(env.prompts[0].message).toBe('Both phones will type this once. Use a few words only the two of you know.');
    expect(env.props.APP_KEY).toBe(KEY);
    for (const [name, headers] of Object.entries(HEADERS)) {
      const sheet = env.ss.sheet(name);
      expect(sheet.headers()).toEqual(headers);
      expect(sheet.frozenRows()).toBe(1);
      expect(sheet.headerBold()).toBe(true);
    }
    const visits = env.ss.sheet('Visits');
    expect(visits.validation('visit_type')?.list).toEqual(['Dayuse', 'Staycation', 'Overnight', 'Pool day', 'Spa', 'Brunch or dinner', 'Other']);
    expect(visits.validation('mood')?.list).toEqual(expect.arrayContaining(['blissful', 'cosy', 'romantic', 'giddy', 'lazy', 'adventurous', 'fancy', 'sleepy', 'giggly', 'fizzy']));
    expect(visits.validation('picked_by')?.list).toEqual(['nirsh', 'shady', 'both']);
    expect(visits.validation('mood')?.allowInvalid).toBe(true);
    expect(visits.validation('note')).toBeNull();
    expect(env.ss.sheet('Hotels').validation('source')?.list).toEqual(['photon', 'manual', 'seed', 'wishlist']);
    expect(env.ss.sheet('Hotels').validation('price_level')?.list).toEqual(['1', '2', '3', '4']);
    expect(env.ss.sheet('Letters').validation('from')?.list).toEqual(['nirsh', 'shady']);
    expect(visits.numberFormat('updated_at')).toBe('@');
    expect(visits.numberFormat('server_updated_at')).toBe('@');
    expect(visits.numberFormat('nights')).toBeNull();
    const folderId = env.props.PHOTOS_FOLDER_ID;
    expect(env.drive.folders.get(folderId)?.name).toBe('Suite Nothings photos');
    expect(env.props.SPREADSHEET_ID).toBe(env.ss.id);
    expect(env.props.SCHEMA_VERSION).toBe('1');
    const settings = Object.fromEntries(env.ss.sheet('Settings').rows().map((r) => [r.key, r.value]));
    expect(JSON.parse(String(settings.home_base))).toEqual({ city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', lat: 25.2048, lng: 55.2708 });
    expect(settings.map_lighting).toBe('auto');
    expect(settings.units).toBe('km');
  });

  it('re-running keeps data, the folder and the key (cancel keeps it; a new answer replaces it)', () => {
    let answer = { button: 'CANCEL' as 'OK' | 'CANCEL', text: '' };
    const env = createGasEnv({ appKey: KEY, promptResponse: () => answer });
    env.run('setup');
    const folderId = env.props.PHOTOS_FOLDER_ID;
    post(env, 'upsertVisit', visit());
    env.ss.sheet('Visits').setRaw([...env.ss.sheet('Visits').raw().map((r, i) => [...r, i === 0 ? 'our notes' : 'keep me'])]);
    expect(env.run('setup')).toContain('Passphrase kept');
    expect(env.prompts[1].message).toContain('already saved');
    expect(env.props.APP_KEY).toBe(KEY);
    expect(env.props.PHOTOS_FOLDER_ID).toBe(folderId);
    expect(env.drive.folders.size).toBe(1);
    const rows = env.ss.sheet('Visits').rows();
    expect(rows).toHaveLength(1);
    expect(rows[0]['our notes']).toBe('keep me');
    expect(env.ss.sheet('Settings').rows().filter((r) => r.key === 'home_base')).toHaveLength(1);
    answer = { button: 'OK', text: 'new words' };
    env.run('setup');
    expect(env.props.APP_KEY).toBe('new words');
  });

  it('unbound: uses SPREADSHEET_ID, never prompts, logs how to set APP_KEY', () => {
    const env = createGasEnv({ bound: false });
    const summary = env.run('setup') as string;
    expect(summary).toContain('NOT set');
    expect(env.prompts).toHaveLength(0);
    expect(env.logs.join('\n')).toMatch(/Project Settings.*Script properties.*Add script property.*APP_KEY.*Save script properties/s);
    expect(env.ss.sheet('Visits').exists()).toBe(true);
    expect(env.call.post({ key: 'x', action: 'upsertVisit', payload: visit() }).error?.message).toContain("isn't set yet");
  });

  it('recreates the photo folder if the saved one was deleted', () => {
    const env = ready();
    const first = env.props.PHOTOS_FOLDER_ID;
    env.drive.folders.get(first)!.trashed = true;
    env.run('setup');
    expect(env.props.PHOTOS_FOLDER_ID).not.toBe(first);
  });
});

describe('selfTest()', () => {
  it('passes, leaves no SELFTEST rows and releases the lock', () => {
    const env = ready();
    expect(env.run('selfTest')).toBe('selfTest passed');
    for (const name of ['Hotels', 'Visits', 'Photos', 'Wishlist', 'Letters']) {
      expect(JSON.stringify(env.ss.sheet(name).rows())).not.toContain('SELFTEST');
    }
    expect(env.lock.held).toBe(false);
    expect(env.logs).toContain('selfTest passed');
  });
});

describe('auth and envelope', () => {
  it('ping needs no key', () => {
    const env = ready();
    const res = env.call.get({ action: 'ping' });
    expect(res.ok).toBe(true);
    expect(res.version).toBe('1.0.0');
    expect(res.data.version).toBe('1.0.0');
    expect(Date.parse(res.data.serverTime)).not.toBeNaN();
  });

  it('every other action is unauthorized with a wrong or missing key', () => {
    const env = ready();
    for (const action of ['bootstrap', 'changes', 'photo']) {
      expect(env.call.get({ action, since: iso(), id: 'x' }).error?.code).toBe('unauthorized');
      expect(env.call.get({ action, key: 'nope', since: iso(), id: 'x' }).error?.code).toBe('unauthorized');
    }
    for (const action of ['upsertHotel', 'upsertVisit', 'deleteVisit', 'uploadPhoto', 'upsertWish', 'upsertLetter', 'markLetterRead', 'updateSettings', 'geocode']) {
      const res = post(env, action, {}, 'wrong');
      expect(res).toEqual({ ok: false, error: { code: 'unauthorized', message: expect.any(String) } });
      expect(env.call.post({ action, payload: {} }).error?.code).toBe('unauthorized');
    }
    expect(post(env, 'upsertVisit', visit(), KEY + 'x').ok).toBe(false);
  });

  it('bad_request for unknown actions, bad JSON and missing fields; errors are logged', () => {
    const env = ready();
    expect(env.call.get({ action: 'dance', key: KEY }).error?.code).toBe('bad_request');
    expect(post(env, 'dance', {}).error?.code).toBe('bad_request');
    expect(env.call.post('{not json').error?.code).toBe('bad_request');
    expect(post(env, 'upsertVisit', { visit_id: 'V1' }).error?.code).toBe('bad_request');
    expect(post(env, 'upsertVisit', visit({ updated_at: 'soon' })).error?.code).toBe('bad_request');
    expect(env.call.get({ action: 'changes', key: KEY, since: 'yesterday-ish' }).error?.code).toBe('bad_request');
    expect(env.ss.sheet('Log').rows().some((r) => r.action === 'error' && String(r.detail).includes('bad_request'))).toBe(true);
  });

  it('a lock timeout becomes a server error', () => {
    const env = ready();
    env.lock.failNext = true;
    const res = post(env, 'upsertVisit', visit());
    expect(res.error?.code).toBe('server');
    expect(env.lock.held).toBe(false);
  });
});

describe('bootstrap and changes', () => {
  it('bootstrap returns every tab, deleted rows included, and parsed settings', () => {
    const env = ready();
    post(env, 'upsertHotel', { hotel_id: 'H1', name: 'Atlantis', lat: 25.13, lng: 55.11, amenities_json: ['pool'], updated_at: iso() });
    post(env, 'upsertVisit', visit({ deleted: true }));
    const { data } = env.call.get({ action: 'bootstrap', key: KEY });
    expect(Object.keys(data).sort()).toEqual(['hotels', 'letters', 'photos', 'serverTime', 'settings', 'visits', 'wishes']);
    expect(data.hotels[0]).toMatchObject({ hotel_id: 'H1', lat: 25.13, amenities_json: '["pool"]', deleted: false, brand: null });
    expect(data.hotels[0]).not.toHaveProperty('server_updated_at');
    expect(data.visits[0]).toMatchObject({ visit_id: 'V1', deleted: true, date: '2026-06-19', check_in: '14:00' });
    expect(data.settings.home_base).toMatchObject({ city: 'Dubai', countryCode: 'AE' });
    expect(data.settings.units).toBe('km');
  });

  it('changes uses server_updated_at, so an old client clock still shows up', async () => {
    const env = ready();
    post(env, 'upsertVisit', visit({ visit_id: 'OLD' }));
    await new Promise((r) => setTimeout(r, 3));
    const since = env.call.get({ action: 'bootstrap', key: KEY }).data.serverTime;
    await new Promise((r) => setTimeout(r, 3));
    // Written after `since`, but the phone's clock says two years ago.
    post(env, 'upsertVisit', visit({ visit_id: 'SKEWED', updated_at: '2024-01-01T00:00:00.000Z' }));
    await new Promise((r) => setTimeout(r, 3)); // serverTime is 1 ms behind, so leave a gap
    const changes = env.call.get({ action: 'changes', key: KEY, since }).data;
    expect(changes.visits.map((v: { visit_id: string }) => v.visit_id)).toEqual(['SKEWED']);
    expect(changes.settings).toEqual({});
    await new Promise((r) => setTimeout(r, 3));
    const later = env.call.get({ action: 'changes', key: KEY, since: changes.serverTime }).data;
    expect(later.visits).toEqual([]);
    post(env, 'updateSettings', { units: 'mi', updated_at: iso(1000) });
    expect(env.call.get({ action: 'changes', key: KEY, since: later.serverTime }).data.settings.units).toBe('mi');
  });
});

describe('writes', () => {
  it('upsert is last-write-wins and replays never duplicate', () => {
    const env = ready();
    const first = post(env, 'upsertVisit', visit());
    expect(first.data).toMatchObject({ applied: true, row: { visit_id: 'V1', note: null } });
    const newer = post(env, 'upsertVisit', visit({ note: 'rooftop pool', updated_at: '2026-06-19T11:00:00.000Z' }));
    expect(newer.data.applied).toBe(true);
    const older = post(env, 'upsertVisit', visit({ note: 'stale', updated_at: '2026-06-19T10:30:00.000Z' }));
    expect(older.data).toMatchObject({ applied: false, row: { note: 'rooftop pool' } });
    const replay = post(env, 'upsertVisit', visit({ note: 'rooftop pool', updated_at: '2026-06-19T11:00:00.000Z' }));
    expect(replay.data.applied).toBe(false);
    expect(env.ss.sheet('Visits').rows()).toHaveLength(1);
    expect(env.ss.sheet('Visits').rows()[0].server_updated_at).toMatch(/Z$/);
  });

  it('deleteVisit soft-deletes, undo restores, unknown id is not_found', () => {
    const env = ready();
    post(env, 'upsertVisit', visit({ note: 'keep' }));
    const del = post(env, 'deleteVisit', { visit_id: 'V1', deleted: true, updated_at: '2026-06-20T00:00:00.000Z' });
    expect(del.data).toMatchObject({ applied: true, row: { deleted: true, note: 'keep' } });
    const undo = post(env, 'deleteVisit', { visit_id: 'V1', deleted: false, updated_at: '2026-06-20T00:00:01.000Z' });
    expect(undo.data.row.deleted).toBe(false);
    expect(post(env, 'deleteVisit', { visit_id: 'NOPE', deleted: true, updated_at: iso() }).error?.code).toBe('not_found');
  });

  it('uploadPhoto stores files in Drive once and photo GET round-trips; other Drive files are not served', () => {
    const env = ready();
    const thumb = Buffer.from([0xff, 0xd8, 1, 2, 3, 200]).toString('base64');
    const full = Buffer.from('full-size bytes').toString('base64');
    const payload = {
      photo: { photo_id: 'P1', visit_id: 'V1', thumb_file_id: 'local:thumb', full_file_id: null, width: 1600, height: 1200, created_at: '2026-06-19T10:00:00.000Z', updated_at: '2026-06-19T10:00:00.000Z', deleted: false },
      thumb: { mime: 'image/jpeg', base64: thumb }, full: { mime: 'image/jpeg', base64: full },
    };
    const res = post(env, 'uploadPhoto', payload);
    expect(res.ok).toBe(true);
    expect(env.drive.files.size).toBe(2);
    const { thumb_file_id, full_file_id } = res.data.fileIds;
    expect(res.data.row).toMatchObject({ photo_id: 'P1', thumb_file_id, full_file_id, width: 1600 });
    expect(env.drive.files.get(thumb_file_id)?.name).toBe('P1-thumb.jpg');
    const again = post(env, 'uploadPhoto', payload);
    expect(env.drive.files.size).toBe(2);
    expect(again.data.fileIds).toEqual({ thumb_file_id, full_file_id });
    expect(env.ss.sheet('Photos').rows()).toHaveLength(1);
    const got = env.call.get({ action: 'photo', id: thumb_file_id, key: KEY });
    expect(got.data).toEqual({ mime: 'image/jpeg', base64: thumb });
    expect(env.call.get({ action: 'photo', id: 'missing', key: KEY }).error?.code).toBe('not_found');
    const secret = env.drive.addFile({ name: 'tax.pdf', data: 'private' });
    expect(env.call.get({ action: 'photo', id: secret, key: KEY }).error?.code).toBe('not_found');
  });

  it('markLetterRead: first read wins; upsertLetter; unknown letter is not_found', () => {
    const env = ready();
    const letter = { letter_id: 'L1', title: 'Hi', body_md: 'Line one\n\nLine two\n', from: 'nirsh', to: 'shady', unlock_rule: 'visits>=5', written_at: '2026-09-19', read_at: null, created_at: '2026-09-19T20:00:00.000Z', updated_at: '2026-09-19T20:00:00.000Z' };
    expect(post(env, 'upsertLetter', letter).data.row).toMatchObject({ body_md: 'Line one\n\nLine two\n', unlock_rule: 'visits>=5', written_at: '2026-09-19' });
    const first = post(env, 'markLetterRead', { letter_id: 'L1', read_at: '2026-10-01T08:00:00.000Z' });
    expect(first.data).toMatchObject({ applied: true, row: { read_at: '2026-10-01T08:00:00.000Z' } });
    expect(Date.parse(first.data.row.updated_at)).toBeGreaterThan(Date.parse(letter.updated_at));
    const second = post(env, 'markLetterRead', { letter_id: 'L1', read_at: '2026-10-02T08:00:00.000Z' });
    expect(second.data).toMatchObject({ applied: false, row: { read_at: '2026-10-01T08:00:00.000Z' } });
    expect(post(env, 'markLetterRead', { letter_id: 'L9', read_at: iso() }).error?.code).toBe('not_found');
    expect(env.ss.sheet('Log').rows().map((r) => String(r.detail)).join()).not.toContain('Line one');
  });

  it('updateSettings is last-write-wins on the updated_at row', () => {
    const env = ready();
    const home = { city: 'Abu Dhabi', country: 'United Arab Emirates', countryCode: 'AE', lat: 24.45, lng: 54.37 };
    const res = post(env, 'updateSettings', { home_base: home, map_lighting: 'night', updated_at: iso(60_000) });
    expect(res.data.applied).toBe(true);
    expect(res.data.settings).toMatchObject({ home_base: home, map_lighting: 'night', units: 'km' });
    expect(res.data.settings).not.toHaveProperty('server_updated_at');
    const stale = post(env, 'updateSettings', { map_lighting: 'day', updated_at: iso(-60_000) });
    expect(stale.data).toMatchObject({ applied: false, settings: { map_lighting: 'night' } });
    expect(post(env, 'updateSettings', { units: 'mi' }).error?.code).toBe('bad_request');
  });

  it('aiDescribe and placesLookup answer not_configured without a key (w2-enrich)', () => {
    const env = ready();
    expect(post(env, 'aiDescribe', { prompt: 'Facts: {}' }).data).toEqual({ ok: false, code: 'not_configured' });
    expect(post(env, 'placesLookup', { name: 'Atlantis The Royal', lat: 25.13, lng: 55.12 }).data).toEqual({ ok: false, code: 'not_configured' });
  });

  it('geocode maps Maps.newGeocoder results and biases near a point', () => {
    const env = ready();
    const res = post(env, 'geocode', { query: 'Burj Al Arab', near: { lat: 25.2, lng: 55.27 } });
    expect(res.data.results).toEqual([{ name: 'Burj Al Arab', address: expect.stringContaining('Umm Suqeim'), lat: 25.141291, lng: 55.185348, city: 'Dubai', region: 'Dubai', country: 'United Arab Emirates', country_code: 'AE', postcode: null }]);
    const bounds = env.geocoder.lastBounds!;
    [24.7, 54.77, 25.7, 55.77].forEach((n, i) => expect(bounds[i]).toBeCloseTo(n, 5));
    expect(post(env, 'geocode', { query: 'Nowhere Inn' }).data.results).toEqual([]);
    expect(post(env, 'geocode', {}).error?.code).toBe('bad_request');
  });

  it('writes Log rows with actor and action, and trims the Log', () => {
    const env = ready();
    post(env, 'upsertVisit', visit({ added_by: 'shady' }));
    const log = env.ss.sheet('Log').rows();
    expect(log.at(-1)).toMatchObject({ actor: 'shady', action: 'upsertVisit', detail: 'V1 applied' });
    env.ss.sheet('Log').setRaw([HEADERS.Log, ...Array.from({ length: 2205 }, (_, i) => [iso(), 'app', 'old', String(i)])]);
    post(env, 'upsertVisit', visit({ updated_at: iso() }));
    const trimmed = env.ss.sheet('Log').rows();
    expect(trimmed).toHaveLength(2000);
    expect(trimmed.at(-1)?.action).toBe('upsertVisit');
  });
});

describe('messy sheets', () => {
  function messy(): GasEnv {
    const env = ready();
    env.ss.sheet('Visits').setRaw([
      ['  Note ', 'our column', 'VISIT_ID', 'hotel_id', 'date', 'check_in', 'check_out', 'nights', 'deleted', 'updated_at', 'mood', 'rating_nirsh'],
      ['first', 'x1', 'V1', ' H1 ', new Date('2026-06-19T08:00:00Z'), 14 / 24, new Date('2026-06-19T14:30:00Z'), '1', 'TRUE', '2026-06-19T10:00:00.000Z', ' cosy ', '5'],
      ['', '', '', '', '', '', '', '', '', '', '', ''],
      ['typed by hand', 'x2', 'V2', 'H1', '19 Jun 2026', '2:30 PM', '9:5', '', 'no', '', '', ''],
      [],
      ['', 'x3', 'V3', 'H2', '19/06/2026', '14:00:00', '', 'abc', true, '2026-06-01T00:00:00.000Z', 'giddy', ''],
    ]);
    env.ss.sheet('Hotels').setRaw([
      ['hotel_id', 'name', 'lat', 'lng', 'updated_at'],
      ['H1', ' Atlantis ', '25.13', ' 55.11 ', '2026-06-01T00:00:00.000Z'],
    ]);
    return env;
  }

  it('reads by header name with blank rows, whitespace, Date cells, fractions and strings', () => {
    const env = messy();
    const { data } = env.call.get({ action: 'bootstrap', key: KEY });
    const byId = Object.fromEntries(data.visits.map((v: { visit_id: string }) => [v.visit_id, v]));
    expect(Object.keys(byId)).toEqual(['V1', 'V2', 'V3']);
    expect(byId.V1).toMatchObject({ hotel_id: 'H1', note: 'first', date: '2026-06-19', check_in: '14:00', check_out: '18:30', nights: 1, deleted: true, mood: 'cosy', rating_nirsh: 5 });
    expect(byId.V2).toMatchObject({ date: '2026-06-19', check_in: '14:30', check_out: '09:05', nights: 0, deleted: false, mood: null });
    expect(byId.V3).toMatchObject({ date: '2026-06-19', check_in: '14:00', nights: 0, deleted: true, note: null });
    expect(byId.V1).not.toHaveProperty('our column');
    expect(data.hotels[0]).toMatchObject({ name: 'Atlantis', lat: 25.13, lng: 55.11 });
  });

  it('stamps hand-typed rows with a blank updated_at so they show up in changes', () => {
    const env = messy();
    const since = new Date(Date.now() - 1).toISOString();
    const changes = env.call.get({ action: 'changes', key: KEY, since }).data;
    expect(changes.visits.map((v: { visit_id: string }) => v.visit_id)).toEqual(['V2']);
    const v2 = env.ss.sheet('Visits').rows().find((r) => r.VISIT_ID === 'V2')!;
    expect(v2.updated_at).toMatch(/Z$/);
    expect(v2.server_updated_at).toBe(v2.updated_at);
    expect(env.ss.sheet('Visits').headers()).toContain('server_updated_at');
  });

  it('an upsert keeps extra columns and places values by header', () => {
    const env = messy();
    const res = post(env, 'upsertVisit', { visit_id: 'V1', hotel_id: 'H1', date: '2026-06-20', note: 'moved', updated_at: '2026-06-19T12:00:00.000Z' });
    expect(res.data).toMatchObject({ applied: true, row: { date: '2026-06-20', note: 'moved', check_in: '14:00', deleted: true } });
    const row = env.ss.sheet('Visits').rows().find((r) => r.VISIT_ID === 'V1')!;
    expect(row['our column']).toBe('x1');
    expect(row.Note).toBe('moved');
    expect(row.date).toBe('2026-06-20');
    const headers = env.ss.sheet('Visits').headers();
    expect(headers.slice(0, 3)).toEqual(['Note', 'our column', 'VISIT_ID']);
    expect(headers).toEqual(expect.arrayContaining(['visit_type', 'photo_ids_json', 'server_updated_at']));
    post(env, 'upsertVisit', visit({ visit_id: 'V4', updated_at: iso() }));
    expect(env.ss.sheet('Visits').rows().find((r) => r.VISIT_ID === 'V4')?.['our column']).toBe('');
  });

  it('onEdit stamps edited rows (not stamp-only edits) and the change syncs', () => {
    const env = ready();
    post(env, 'upsertVisit', visit({ updated_at: '2030-01-01T00:00:00.000Z' }));
    const sheet = env.ss.sheet('Visits');
    const row = sheet.rowOf('V1')!;
    const since = iso(-1);
    sheet.editCell(row, 'note', 'typed in the Sheet');
    const after = sheet.rows()[0];
    expect(after.updated_at).toBe('2030-01-01T00:00:00.001Z'); // stored + 1 ms beats a future stamp
    const changes = env.call.get({ action: 'changes', key: KEY, since }).data;
    expect(changes.visits[0]).toMatchObject({ visit_id: 'V1', note: 'typed in the Sheet' });
    sheet.editCell(row, 'updated_at', '2031-01-01T00:00:00.000Z');
    expect(sheet.cell(row, 'updated_at')).toBe('2031-01-01T00:00:00.000Z');
    sheet.editCell(1, 'note', 'NOTE');
    expect(sheet.cell(row, 'updated_at')).toBe('2031-01-01T00:00:00.000Z');
    expect(env.lock.held).toBe(false);
  });

  it('onEdit on Settings bumps the updated_at row', () => {
    const env = ready();
    const sheet = env.ss.sheet('Settings');
    const since = iso(-1);
    sheet.editCell(sheet.rowOf('units')!, 'value', 'mi');
    const changes = env.call.get({ action: 'changes', key: KEY, since }).data;
    expect(changes.settings.units).toBe('mi');
    expect(Date.parse(changes.settings.updated_at)).toBeGreaterThan(Date.parse(since));
  });
});

describe('fixed clock', () => {
  it('uses the injected clock for stamps', () => {
    const env = createGasEnv({ appKey: KEY, now: () => new Date('2026-09-30T12:00:00.000Z') });
    env.run('setup');
    post(env, 'upsertVisit', visit());
    expect(env.ss.sheet('Visits').rows()[0].server_updated_at).toBe('2026-09-30T12:00:00.000Z');
    expect(env.call.get({ action: 'ping' }).data.serverTime).toBe('2026-09-30T12:00:00.000Z');
  });
});
