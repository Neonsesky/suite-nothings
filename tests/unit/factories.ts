/** Shared test fixtures for Hotel/Visit/Photo — not a test suite itself. */
import type { Hotel, Photo, Stay, Visit } from '@/data/types';

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export function makeHotel(overrides: Partial<Hotel> = {}): Hotel {
  const id = overrides.hotel_id ?? nextId('HOTEL');
  return {
    hotel_id: id,
    name: 'Test Hotel',
    brand: null,
    address: null,
    area: null,
    city: 'Dubai',
    region: 'Dubai',
    country: 'United Arab Emirates',
    country_code: 'AE',
    lat: 25.2048,
    lng: 55.2708,
    source: 'seed',
    osm_id: 'W1',
    wikidata_id: null,
    website: null,
    phone: null,
    stars: null,
    price_level: null,
    description: null,
    description_source: null,
    amenities_json: null,
    cover_photo_id: null,
    enrichment_status: 'none',
    enriched_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted: false,
    ...overrides,
  };
}

export function makeVisit(hotel: Hotel, overrides: Partial<Visit> = {}): Visit {
  const id = overrides.visit_id ?? nextId('VISIT');
  return {
    visit_id: id,
    hotel_id: hotel.hotel_id,
    date: '2026-06-19',
    check_in: '14:00',
    check_out: '20:00',
    nights: 0,
    visit_type: 'Dayuse',
    booked_via: 'Direct',
    note: null,
    favourite_moment: null,
    mood: null,
    rating_nirsh: null,
    rating_shady: null,
    picked_by: null,
    added_by: null,
    photo_ids_json: '[]',
    created_at: '2026-06-19T18:00:00.000Z',
    updated_at: '2026-06-19T18:00:00.000Z',
    deleted: false,
    ...overrides,
  };
}

export function makePhoto(visit: Visit, overrides: Partial<Photo> = {}): Photo {
  const id = overrides.photo_id ?? nextId('PHOTO');
  return {
    photo_id: id,
    visit_id: visit.visit_id,
    thumb_file_id: null,
    full_file_id: null,
    width: 100,
    height: 100,
    taken_at: null,
    caption: null,
    created_at: '2026-06-19T18:00:00.000Z',
    updated_at: '2026-06-19T18:00:00.000Z',
    deleted: false,
    ...overrides,
  };
}

export function makeStay(hotel: Hotel, visit: Visit, overrides: Partial<Stay> = {}): Stay {
  return { visit, hotel, photos: [], visitNumber: 1, stayNumber: 1, ...overrides };
}
