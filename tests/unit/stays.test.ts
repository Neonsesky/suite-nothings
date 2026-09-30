import { describe, expect, it } from 'vitest';
import type { Hotel, Photo } from '@/data/types';
import { ABROAD, buildStays, cityTab, filterStays, parseJsonArray } from '@/data/stays';
import { makeHotel, makePhoto, makeVisit } from './factories';

describe('parseJsonArray', () => {
  it('parses a JSON array of strings', () => {
    expect(parseJsonArray('["a","b"]')).toEqual(['a', 'b']);
  });
  it('returns [] for bad JSON', () => {
    expect(parseJsonArray('not json')).toEqual([]);
  });
  it('returns [] for null/undefined/empty', () => {
    expect(parseJsonArray(null)).toEqual([]);
    expect(parseJsonArray(undefined)).toEqual([]);
    expect(parseJsonArray('')).toEqual([]);
  });
  it('drops non-string entries and non-array JSON', () => {
    expect(parseJsonArray('["a", 1, null, "b"]')).toEqual(['a', 'b']);
    expect(parseJsonArray('{"a":1}')).toEqual([]);
  });
});

describe('cityTab', () => {
  it('returns the hotel city when it matches home', () => {
    expect(cityTab({ city: 'Dubai', country_code: 'AE' }, { countryCode: 'ae' })).toBe('Dubai');
  });
  it('returns Abroad when the hotel is outside the home country', () => {
    expect(cityTab({ city: 'Muscat', country_code: 'OM' }, { countryCode: 'AE' })).toBe(ABROAD);
  });
});

describe('buildStays', () => {
  const golden = makeHotel({ hotel_id: 'H1', name: 'Golden Tulip' });
  const atlantis = makeHotel({ hotel_id: 'H2', name: 'Atlantis' });
  const hotels = new Map<string, Hotel>([
    [golden.hotel_id, golden],
    [atlantis.hotel_id, atlantis],
  ]);

  it('numbers visits per hotel and stays overall, in chronological order regardless of input order', () => {
    const v1 = makeVisit(golden, { visit_id: 'V1', date: '2026-06-19', created_at: '2026-06-19T08:00:00.000Z' });
    const v2 = makeVisit(atlantis, { visit_id: 'V2', date: '2026-06-27', created_at: '2026-06-27T08:00:00.000Z' });
    const v3 = makeVisit(golden, { visit_id: 'V3', date: '2026-07-19', created_at: '2026-07-19T08:00:00.000Z' });
    // Deliberately out of order to check sorting.
    const stays = buildStays([v3, v1, v2], hotels, []);
    expect(stays.map((s) => s.visit.visit_id)).toEqual(['V1', 'V2', 'V3']);
    expect(stays.find((s) => s.visit.visit_id === 'V1')).toMatchObject({ visitNumber: 1, stayNumber: 1 });
    expect(stays.find((s) => s.visit.visit_id === 'V2')).toMatchObject({ visitNumber: 1, stayNumber: 2 });
    expect(stays.find((s) => s.visit.visit_id === 'V3')).toMatchObject({ visitNumber: 2, stayNumber: 3 });
  });

  it('gives deleted visits visitNumber/stayNumber 0 and does not let them consume a counter slot', () => {
    const v1 = makeVisit(golden, { visit_id: 'V1', date: '2026-06-19', created_at: '2026-06-19T08:00:00.000Z' });
    const vDeleted = makeVisit(golden, { visit_id: 'V2', date: '2026-06-20', created_at: '2026-06-20T08:00:00.000Z', deleted: true });
    const v3 = makeVisit(golden, { visit_id: 'V3', date: '2026-06-21', created_at: '2026-06-21T08:00:00.000Z' });
    const stays = buildStays([v1, vDeleted, v3], hotels, []);
    expect(stays.find((s) => s.visit.visit_id === 'V2')).toMatchObject({ visitNumber: 0, stayNumber: 0 });
    // v3 is still the 2nd live visit to this hotel and the 2nd live stay overall.
    expect(stays.find((s) => s.visit.visit_id === 'V3')).toMatchObject({ visitNumber: 2, stayNumber: 2 });
  });

  it('skips visits whose hotel is missing from the map', () => {
    const orphan = makeVisit(golden, { visit_id: 'V-orphan', hotel_id: 'missing-hotel' });
    const v1 = makeVisit(golden, { visit_id: 'V1' });
    const stays = buildStays([orphan, v1], hotels, []);
    expect(stays.map((s) => s.visit.visit_id)).toEqual(['V1']);
  });

  it('orders photos by photo_ids_json, unlisted photos last by created_at', () => {
    const v1 = makeVisit(golden, { visit_id: 'V1', photo_ids_json: '["P2","P1"]' });
    const p1: Photo = makePhoto(v1, { photo_id: 'P1', created_at: '2026-06-19T09:00:00.000Z' });
    const p2: Photo = makePhoto(v1, { photo_id: 'P2', created_at: '2026-06-19T10:00:00.000Z' });
    const p3: Photo = makePhoto(v1, { photo_id: 'P3', created_at: '2026-06-19T08:00:00.000Z' });
    const stays = buildStays([v1], hotels, [p3, p1, p2]);
    expect(stays[0]!.photos.map((p) => p.photo_id)).toEqual(['P2', 'P1', 'P3']);
  });
});

describe('filterStays', () => {
  const golden = makeHotel({ hotel_id: 'H1', name: 'Golden Tulip', city: 'Dubai', country_code: 'AE' });
  const chedi = makeHotel({ hotel_id: 'H2', name: 'The Chedi Muscat', city: 'Muscat', country_code: 'OM' });
  const home = { countryCode: 'AE' };

  const v1 = makeVisit(golden, {
    visit_id: 'V1',
    date: '2026-06-19',
    visit_type: 'Dayuse',
    rating_nirsh: 5,
    rating_shady: 5,
    picked_by: 'nirsh',
    note: 'Fries at sunset',
  });
  const v2 = makeVisit(chedi, {
    visit_id: 'V2',
    date: '2026-08-14',
    visit_type: 'Overnight',
    rating_nirsh: 3,
    rating_shady: 3,
    picked_by: 'shady',
    note: 'Lanterns by the pool',
  });
  const v3Deleted = makeVisit(golden, { visit_id: 'V3', date: '2026-09-01', deleted: true });

  function buildFixtureStays() {
    const hotels = new Map<string, Hotel>([
      [golden.hotel_id, golden],
      [chedi.hotel_id, chedi],
    ]);
    return buildStays([v1, v2, v3Deleted], hotels, []);
  }

  it('filters by city', () => {
    const stays = buildFixtureStays();
    expect(filterStays(stays, { city: 'Dubai' }).map((s) => s.visit.visit_id)).toEqual(['V1']);
  });

  it('filters by Abroad using the home country', () => {
    const stays = buildFixtureStays();
    expect(filterStays(stays, { city: ABROAD }, home).map((s) => s.visit.visit_id)).toEqual(['V2']);
  });

  it('excludes Abroad results entirely when no home is given', () => {
    const stays = buildFixtureStays();
    expect(filterStays(stays, { city: ABROAD }).map((s) => s.visit.visit_id)).toEqual([]);
  });

  it('filters by year', () => {
    const stays = buildFixtureStays();
    expect(filterStays(stays, { year: 2026 }).map((s) => s.visit.visit_id).sort()).toEqual(['V1', 'V2']);
    expect(filterStays(stays, { year: 2027 })).toEqual([]);
  });

  it('filters by visit type', () => {
    const stays = buildFixtureStays();
    expect(filterStays(stays, { type: 'Overnight' }).map((s) => s.visit.visit_id)).toEqual(['V2']);
  });

  it('filters by minimum average rating', () => {
    const stays = buildFixtureStays();
    expect(filterStays(stays, { minRating: 4 }).map((s) => s.visit.visit_id)).toEqual(['V1']);
  });

  it('filters by pickedBy', () => {
    const stays = buildFixtureStays();
    expect(filterStays(stays, { pickedBy: 'shady' }).map((s) => s.visit.visit_id)).toEqual(['V2']);
  });

  it('filters by a case-insensitive text query over note/name/etc', () => {
    const stays = buildFixtureStays();
    expect(filterStays(stays, { query: 'lanterns' }).map((s) => s.visit.visit_id)).toEqual(['V2']);
    expect(filterStays(stays, { query: 'golden tulip' }).map((s) => s.visit.visit_id)).toEqual(['V1']);
  });

  it('excludes deleted stays unless includeDeleted is set', () => {
    const stays = buildFixtureStays();
    expect(filterStays(stays).some((s) => s.visit.visit_id === 'V3')).toBe(false);
    expect(filterStays(stays, { includeDeleted: true }).some((s) => s.visit.visit_id === 'V3')).toBe(true);
  });

  it('orders newest first by default and oldest first when asked', () => {
    const stays = buildFixtureStays();
    expect(filterStays(stays).map((s) => s.visit.visit_id)).toEqual(['V2', 'V1']);
    expect(filterStays(stays, { order: 'oldest' }).map((s) => s.visit.visit_id)).toEqual(['V1', 'V2']);
  });
});
