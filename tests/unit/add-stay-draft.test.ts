import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDemoAdapter, resetDemoServer } from '@/data/adapters/demo';
import { closeDb } from '@/data/db';
import { resetDevice, setDevice } from '@/data/device';
import * as store from '@/data/store';
import * as sync from '@/data/sync';
import {
  buildSavePlan,
  draftFromVisit,
  durationLabel,
  emptyDraft,
  hotelFromPlace,
  isDirty,
  reviveDraft,
  revisitDefaults,
  stepProblem,
  toStoredDraft,
  type AddStayDraft,
  type DraftPhoto,
} from '@/features/add-stay/draft';
import { saveStay } from '@/features/add-stay/save';
import { countryCodeFor } from '@/features/add-stay/places';
import type { PlaceResult } from '@/lib/geocode';
import { makeHotel, makeVisit } from './factories';

const photo = (key: string, extra: Partial<DraftPhoto> = {}): DraftPhoto => ({
  key,
  photo_id: null,
  thumb: new Blob(['t' + key], { type: 'image/webp' }),
  full: new Blob(['f' + key], { type: 'image/webp' }),
  width: 1600,
  height: 1200,
  taken_at: '2026-07-12T15:42:10',
  caption: '',
  gps: null,
  ...extra,
});

const withHotel = (d: AddStayDraft, id = 'H1'): AddStayDraft => ({ ...d, hotel: { kind: 'existing', hotel_id: id } });

describe('add-stay draft', () => {
  it('starts on today, day use, nothing rated', () => {
    const d = emptyDraft('2026-09-30');
    expect(d).toMatchObject({ date: '2026-09-30', visit_type: 'Dayuse', nights: 0, rating: null, hotel: null, step: 0 });
    expect(isDirty(d, emptyDraft('2026-09-30'))).toBe(false);
    expect(isDirty({ ...d, note: 'hi' }, d)).toBe(true);
    expect(isDirty({ ...d, photos: [photo('a')] }, d)).toBe(true);
  });

  it('validates each step with the copy-deck problems', () => {
    const d = emptyDraft('2026-09-30');
    expect(stepProblem(d, 'hotel')).toBe('hotelRequired');
    expect(stepProblem(withHotel(d), 'hotel')).toBeNull();
    expect(stepProblem({ ...d, date: '' }, 'when')).toBe('dateRequired');
    expect(stepProblem({ ...d, check_in: '18:00', check_out: '14:00' }, 'when')).toBe('checkOutBeforeCheckIn');
    // past midnight on a day stay is fine, and so is an overnight
    expect(stepProblem({ ...d, check_in: '20:00', check_out: '01:00' }, 'when')).toBeNull();
    expect(stepProblem({ ...d, check_in: '14:00', check_out: '12:00', nights: 1 }, 'when')).toBeNull();
    expect(stepProblem({ ...d, check_in: '25:99' }, 'when')).toBe('badTime');
  });

  it('labels durations', () => {
    expect(durationLabel('14:00', '18:00', 0)).toBe('4 h');
    expect(durationLabel('14:00', '18:30', 0)).toBe('4 h 30 min');
    expect(durationLabel('14:00', '12:00', 1)).toBe('22 h');
    expect(durationLabel('', '12:00', 0)).toBeNull();
  });

  it('puts my rating in my column and leaves the other one alone', () => {
    const d = { ...withHotel(emptyDraft('2026-09-30')), rating: 4 as const, note: '  sunset  ', check_in: '14:00' };
    const nirsh = buildSavePlan(d, { me: 'nirsh' }).visit;
    expect(nirsh).toMatchObject({ hotel_id: 'H1', date: '2026-09-30', rating_nirsh: 4, note: 'sunset', check_in: '14:00', check_out: null, nights: 0 });
    expect(nirsh).not.toHaveProperty('rating_shady');
    const shady = buildSavePlan(d, { me: 'shady' }).visit;
    expect(shady).toMatchObject({ rating_shady: 4 });
    expect(shady).not.toHaveProperty('rating_nirsh');
  });

  it('keeps the date a plain string and gives overnight stays at least one night', () => {
    const d = { ...withHotel(emptyDraft('2026-12-31')), visit_type: 'Overnight' as const, nights: 0 };
    const v = buildSavePlan(d, { me: 'nirsh' }).visit;
    expect(v.date).toBe('2026-12-31');
    expect(v.nights).toBe(1);
  });

  it('orders photos: saved ids stay, new ones are slotted by index', () => {
    const d = { ...withHotel(emptyDraft('2026-09-30')), photos: [photo('a'), photo('old', { photo_id: 'P0', thumb: null, full: null }), photo('b')] };
    const plan = buildSavePlan(d, { me: 'nirsh', existing: makeVisit(makeHotel({ hotel_id: 'H1' }), { visit_id: 'V1' }) });
    expect(plan.order).toEqual(['new:0', 'P0', 'new:1']);
    expect(plan.newPhotos.map((p) => p.key)).toEqual(['a', 'b']);
    expect(plan.visit.visit_id).toBe('V1');
    expect(plan.visit.photo_ids_json).toBe('["P0"]');
  });

  it('maps a Photon hotel with OSM tags into a Hotel record', () => {
    const place: PlaceResult = {
      id: 'osm:W1',
      name: 'Marina Lanterns Hotel',
      lat: 25.08,
      lng: 55.14,
      osm_id: 'W1',
      kind: 'tourism:hotel',
      isHotel: true,
      street: 'Al Marsa Street',
      housenumber: null,
      area: 'Dubai Marina',
      city: 'Dubai',
      region: 'Dubai',
      country: 'United Arab Emirates',
      country_code: 'ae',
      postcode: null,
      address: 'Al Marsa Street, Dubai Marina, Dubai',
      tags: { brand: 'Lanterns', wikidata: 'Q1', stars: '4', website: 'https://example.org' },
      source: 'photon',
    };
    expect(hotelFromPlace(place, { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE' })).toEqual({
      name: 'Marina Lanterns Hotel',
      brand: 'Lanterns',
      address: 'Al Marsa Street, Dubai Marina, Dubai',
      area: 'Dubai Marina',
      city: 'Dubai',
      region: 'Dubai',
      country: 'United Arab Emirates',
      country_code: 'AE',
      lat: 25.08,
      lng: 55.14,
      source: 'photon',
      osm_id: 'W1',
      wikidata_id: 'Q1',
      website: 'https://example.org',
      phone: null,
      stars: 4,
    });
  });

  it('round-trips photos through the stored (bytes) form', async () => {
    const d = { ...withHotel(emptyDraft('2026-09-30')), photos: [photo('a')] };
    const stored = await toStoredDraft(d);
    const back = reviveDraft(stored)!;
    expect(back.photos).toHaveLength(1);
    expect(back.photos[0].full).toBeInstanceOf(Blob);
    expect(await back.photos[0].full!.text()).toBe('fa');
    expect(reviveDraft({ v: 99 })).toBeNull();
    expect(reviveDraft(null)).toBeNull();
  });

  it('prefills edit mode and revisits', () => {
    const v = makeVisit(makeHotel({ hotel_id: 'H1' }), { visit_type: 'Spa', rating_shady: 5, rating_nirsh: 3, note: 'x' });
    expect(draftFromVisit(v, [], 'shady')).toMatchObject({ rating: 5, visit_type: 'Spa', note: 'x', hotel: { kind: 'existing', hotel_id: 'H1' } });
    expect(revisitDefaults({ ...v, visit_type: 'Staycation', nights: 0 })).toMatchObject({ visit_type: 'Staycation', nights: 1 });
    expect(revisitDefaults(null)).toEqual({});
  });

  it('finds country codes offline', () => {
    expect(countryCodeFor('Oman')).toBe('OM');
    expect(countryCodeFor('turkey') ?? countryCodeFor('Türkiye')).toBe('TR');
    expect(countryCodeFor('Narnia')).toBeNull();
  });
});

describe('saveStay', () => {
  beforeEach(async () => {
    sync.stopSync();
    await closeDb('demo');
    await resetDemoServer();
    globalThis.indexedDB = new IDBFactory();
    resetDevice();
    setDevice('me', 'shady');
    await store.initStore({ ns: 'demo', adapter: createDemoAdapter({ latencyMs: 0 }), startSync: false });
  });
  afterEach(() => sync.stopSync());

  it('creates the hotel, then the visit, then photos in order, all queued in the outbox', async () => {
    const d: AddStayDraft = {
      ...emptyDraft('2026-09-30'),
      hotel: {
        kind: 'new',
        hotel: { name: 'Lantern Nest', brand: null, address: null, area: 'Al Barsha', city: 'Dubai', region: null, country: 'United Arab Emirates', country_code: 'AE', lat: 25.1, lng: 55.2, source: 'manual', osm_id: null, wikidata_id: null, website: null, phone: null, stars: null },
      },
      rating: 5,
      photos: [photo('a', { caption: 'pool' }), photo('b')],
    };
    const res = await saveStay(d, 'shady', null);
    expect(res.hotelIsNew).toBe(true);
    expect(res.after.length).toBe(res.before.length + 1);
    const s = store.getState();
    const visit = s.visits.get(res.visit.visit_id)!;
    expect(visit).toMatchObject({ rating_shady: 5, rating_nirsh: null, added_by: 'shady', date: '2026-09-30' });
    const ids = JSON.parse(visit.photo_ids_json!) as string[];
    expect(ids).toHaveLength(2);
    expect(s.photos.get(ids[0])).toMatchObject({ caption: 'pool', width: 1600, taken_at: '2026-07-12T15:42:10' });
    // happy-dom Blobs lose their bytes through fake-indexeddb's clone; the row itself must exist.
    expect(await store.getPhotoBlob(ids[1], 'full')).toBeInstanceOf(Blob);
    // hotel + visit + 2 × (photo + visit order) + final order check
    expect(s.sync.pending).toBeGreaterThanOrEqual(6);
    expect(s.hotels.get(visit.hotel_id)).toMatchObject({ name: 'Lantern Nest', source: 'manual' });
  });
});
