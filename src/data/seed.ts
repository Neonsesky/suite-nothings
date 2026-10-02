/**
 * Demo seed (SPEC §16). Real, well-known hotels; coordinates geocoded with Photon
 * (photon.komoot.io, osm_tag=tourism:hotel) on 30 Sep 2026 and hardcoded with their OSM ids.
 * Legs cover all three journey styles: glides inside Dubai, hops to Abu Dhabi / RAK / Muscat,
 * flights to Istanbul and back.
 */
import { body as privateLetterBody } from 'virtual:private-letter';
import { COUPLE } from '@/config/couple';
import type { BookedVia, Hotel, Letter, Mood, PersonId, Rating, SettingsMap, Snapshot, Visit, VisitType, Wish } from './types';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Deterministic, valid ULID for seed rows: time part from `iso`, random part from `n`. */
export function seedUlid(iso: string, n: number): string {
  let t = Date.parse(iso);
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  let rand = '';
  let x = (n * 2654435761) >>> 0;
  for (let i = 0; i < 16; i++) {
    rand += ALPHABET[(x + i * 7 + n) % 32];
    x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  }
  return time + rand;
}

const SEEDED_AT = '2026-06-19T12:00:00.000Z';

interface HotelSeed {
  key: string;
  name: string;
  brand: string | null;
  area: string;
  city: string;
  region: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  osm_id: string;
  stars: number;
  price_level: 1 | 2 | 3 | 4;
  address: string;
}

const HOTEL_SEEDS: HotelSeed[] = [
  { key: 'golden-tulip', name: 'Golden Tulip Al Barsha', brand: 'Golden Tulip', area: 'Al Barsha', city: 'Dubai', region: 'Dubai', country: 'United Arab Emirates', country_code: 'AE', lat: 25.11276, lng: 55.190071, osm_id: 'W91402276', stars: 4, price_level: 2, address: '38 Street, Al Barsha 1, Dubai' },
  { key: 'atlantis-royal', name: 'Atlantis The Royal', brand: 'Atlantis', area: 'Palm Jumeirah', city: 'Dubai', region: 'Dubai', country: 'United Arab Emirates', country_code: 'AE', lat: 25.137842, lng: 55.127337, osm_id: 'W1465036747', stars: 5, price_level: 4, address: 'Crescent Road, Palm Jumeirah, Dubai' },
  { key: 'rixos-jbr', name: 'Rixos Premium Dubai JBR', brand: 'Rixos', area: 'JBR', city: 'Dubai', region: 'Dubai', country: 'United Arab Emirates', country_code: 'AE', lat: 25.080085, lng: 55.135893, osm_id: 'N5602910622', stars: 5, price_level: 3, address: 'Al Mamsha Street, Jumeirah Beach Residence, Dubai' },
  { key: 'address-downtown', name: 'Address Downtown', brand: 'Address Hotels + Resorts', area: 'Downtown Dubai', city: 'Dubai', region: 'Dubai', country: 'United Arab Emirates', country_code: 'AE', lat: 25.19404, lng: 55.278912, osm_id: 'W532836513', stars: 5, price_level: 4, address: 'Al Yamamah Street, Downtown Dubai' },
  { key: 'sheraton-sharjah', name: 'Sheraton Sharjah Beach Resort & Spa', brand: 'Sheraton', area: 'Al Muntazah', city: 'Sharjah', region: 'Sharjah', country: 'United Arab Emirates', country_code: 'AE', lat: 25.396074, lng: 55.422657, osm_id: 'N4288077389', stars: 5, price_level: 2, address: 'Al Muntazah Street, Sharjah' },
  { key: 'grosvenor', name: 'Grosvenor House Dubai', brand: 'The Luxury Collection', area: 'Dubai Marina', city: 'Dubai', region: 'Dubai', country: 'United Arab Emirates', country_code: 'AE', lat: 25.085225, lng: 55.143718, osm_id: 'N659838912', stars: 5, price_level: 3, address: 'Al Emreef Street, Dubai Marina' },
  { key: 'emirates-palace', name: 'Emirates Palace Mandarin Oriental', brand: 'Mandarin Oriental', area: 'Al Ras Al Akhdar', city: 'Abu Dhabi', region: 'Abu Dhabi', country: 'United Arab Emirates', country_code: 'AE', lat: 24.462386, lng: 54.317475, osm_id: 'W30394921', stars: 5, price_level: 4, address: 'King Abdullah bin Abdulaziz Al Saud Street, Abu Dhabi' },
  { key: 'chedi-muscat', name: 'The Chedi Muscat', brand: 'GHM', area: 'Al Ghubrah North', city: 'Muscat', region: 'Muscat', country: 'Oman', country_code: 'OM', lat: 23.602373, lng: 58.399289, osm_id: 'W35896442', stars: 5, price_level: 4, address: '18th November Street, Al Ghubrah North, Muscat' },
  { key: 'waldorf-rak', name: 'Waldorf Astoria Ras Al Khaimah', brand: 'Waldorf Astoria', area: 'Al Hamra', city: 'Ras Al Khaimah', region: 'Ras Al Khaimah', country: 'United Arab Emirates', country_code: 'AE', lat: 25.68537, lng: 55.772719, osm_id: 'W330027063', stars: 5, price_level: 3, address: 'Vienna Street, Al Jazirah Al Hamra, Ras Al Khaimah' },
  { key: 'ciragan', name: 'Çırağan Palace Kempinski Istanbul', brand: 'Kempinski', area: 'Beşiktaş', city: 'Istanbul', region: 'Istanbul', country: 'Türkiye', country_code: 'TR', lat: 41.044444, lng: 29.016629, osm_id: 'W498861863', stars: 5, price_level: 4, address: 'Çırağan Caddesi, Yıldız, Beşiktaş, Istanbul' },
  { key: 'burj-al-arab', name: 'Burj Al Arab Jumeirah', brand: 'Jumeirah', area: 'Umm Suqeim', city: 'Dubai', region: 'Dubai', country: 'United Arab Emirates', country_code: 'AE', lat: 25.141327, lng: 55.185397, osm_id: 'W12700546', stars: 5, price_level: 4, address: 'Jumeirah Street, Umm Suqeim 3, Dubai' },
];

interface VisitSeed {
  hotel: string;
  date: string;
  check_in: string;
  check_out: string;
  nights: number;
  visit_type: VisitType;
  booked_via: BookedVia;
  mood: Mood;
  rating_nirsh: Rating | null;
  rating_shady: Rating | null;
  picked_by: PersonId | 'both';
  added_by: PersonId;
  note: string;
  favourite_moment: string | null;
}

const VISIT_SEEDS: VisitSeed[] = [
  { hotel: 'golden-tulip', date: '2026-06-19', check_in: '16:00', check_out: '23:00', nights: 0, visit_type: 'Dayuse', booked_via: 'Dayuse', mood: 'giddy', rating_nirsh: 5, rating_shady: 5, picked_by: 'nirsh', added_by: 'nirsh', note: 'Our first check-in. Booked on Dayuse on a whim and stayed until they politely asked for the key back.', favourite_moment: 'Room-service fries at sunset, eaten on the bed like a picnic.' },
  { hotel: 'atlantis-royal', date: '2026-06-27', check_in: '10:00', check_out: '18:00', nights: 0, visit_type: 'Pool day', booked_via: 'Direct', mood: 'blissful', rating_nirsh: 4, rating_shady: 5, picked_by: 'shady', added_by: 'shady', note: 'The sky pool, with the Palm doing its best postcard impression below us.', favourite_moment: 'Racing across the pool and both of us claiming we won.' },
  { hotel: 'rixos-jbr', date: '2026-07-04', check_in: '15:00', check_out: '12:00', nights: 1, visit_type: 'Staycation', booked_via: 'Booking.com', mood: 'lazy', rating_nirsh: 4, rating_shady: 5, picked_by: 'nirsh', added_by: 'nirsh', note: 'Beach on one side, The Walk on the other. We did neither and ordered breakfast in bed.', favourite_moment: null },
  { hotel: 'address-downtown', date: '2026-07-11', check_in: '19:30', check_out: '23:30', nights: 0, visit_type: 'Brunch or dinner', booked_via: 'Direct', mood: 'fancy', rating_nirsh: 5, rating_shady: 5, picked_by: 'shady', added_by: 'shady', note: 'Dinner facing the fountains. We timed dessert to the 9pm show.', favourite_moment: 'The waiter pretending not to see us steal the last macaron.' },
  { hotel: 'sheraton-sharjah', date: '2026-07-19', check_in: '11:00', check_out: '19:00', nights: 0, visit_type: 'Dayuse', booked_via: 'Dayuse', mood: 'cosy', rating_nirsh: 4, rating_shady: 4, picked_by: 'both', added_by: 'nirsh', note: 'One month together. A quiet beach day in Sharjah and a very ambitious sandcastle.', favourite_moment: 'Naming the sandcastle. It was called Suite One.' },
  { hotel: 'grosvenor', date: '2026-07-25', check_in: '13:00', check_out: '18:00', nights: 0, visit_type: 'Spa', booked_via: 'Direct', mood: 'sleepy', rating_nirsh: 5, rating_shady: null, picked_by: 'nirsh', added_by: 'nirsh', note: 'Couples massage, then naps on the loungers until the Marina lights came on.', favourite_moment: null },
  { hotel: 'emirates-palace', date: '2026-08-08', check_in: '15:00', check_out: '12:00', nights: 1, visit_type: 'Overnight', booked_via: 'Direct', mood: 'fancy', rating_nirsh: 5, rating_shady: 5, picked_by: 'shady', added_by: 'shady', note: 'The gold cappuccino. We took forty photos of it and drank it cold.', favourite_moment: 'Getting lost in the corridors on the way back from the beach.' },
  { hotel: 'chedi-muscat', date: '2026-08-14', check_in: '15:00', check_out: '12:00', nights: 2, visit_type: 'Overnight', booked_via: 'Booking.com', mood: 'romantic', rating_nirsh: 5, rating_shady: 5, picked_by: 'nirsh', added_by: 'nirsh', note: 'Our first trip abroad together. The long pool at night with every lantern lit.', favourite_moment: 'Counting the lanterns and losing count on purpose.' },
  { hotel: 'golden-tulip', date: '2026-08-19', check_in: '16:00', check_out: '23:00', nights: 0, visit_type: 'Dayuse', booked_via: 'Dayuse', mood: 'romantic', rating_nirsh: 5, rating_shady: 5, picked_by: 'shady', added_by: 'shady', note: 'Two months, back where it all started. Same hotel, and we asked for the same floor.', favourite_moment: 'The front desk remembered us.' },
  { hotel: 'waldorf-rak', date: '2026-08-29', check_in: '14:00', check_out: '12:00', nights: 1, visit_type: 'Staycation', booked_via: 'Direct', mood: 'adventurous', rating_nirsh: 4, rating_shady: 5, picked_by: 'shady', added_by: 'shady', note: 'Road trip north. A very long beach and the best sunset of the summer.', favourite_moment: null },
  { hotel: 'ciragan', date: '2026-09-05', check_in: '15:00', check_out: '12:00', nights: 4, visit_type: 'Overnight', booked_via: 'Booking.com', mood: 'romantic', rating_nirsh: 5, rating_shady: 5, picked_by: 'nirsh', added_by: 'nirsh', note: 'Breakfast on the Bosphorus every morning, ferries going by like they were on a schedule just for us.', favourite_moment: 'Simit on the terrace in the rain.' },
  { hotel: 'burj-al-arab', date: '2026-09-19', check_in: '12:30', check_out: '16:30', nights: 0, visit_type: 'Brunch or dinner', booked_via: 'Direct', mood: 'blissful', rating_nirsh: 5, rating_shady: null, picked_by: 'nirsh', added_by: 'nirsh', note: 'Three months. Brunch inside the sail, and a dessert that made us both go quiet.', favourite_moment: null },
];

export const DEMO_LETTER_TITLE = 'A note on your pillow';
/** Shown in demo builds without the private letter (CI). */
export const DEMO_LETTER_PLACEHOLDER =
  "This is the demo pillow note. Nirsh's real note is tucked away in our private Sheet, and it appears right here once we're connected.";

/** Dubai emirate, roughly. [west, south, east, north] */
export const DUBAI_BBOX: [number, number, number, number] = [54.88, 24.6, 55.65, 25.4];

export function defaultSettings(now: string = SEEDED_AT): SettingsMap {
  return {
    home_base: { ...COUPLE.defaultHomeBase, bbox: DUBAI_BBOX },
    map_lighting: 'auto',
    units: 'km',
    updated_at: now,
  };
}

function hotelId(key: string): string {
  return seedUlid(SEEDED_AT, HOTEL_SEEDS.findIndex((h) => h.key === key) + 1);
}

/** Build the demo snapshot. `letterBody` defaults to the build-time private letter (or null). */
export function buildSeed(letterBody: string | null = privateLetterBody): Snapshot {
  const hotels: Hotel[] = HOTEL_SEEDS.map((h) => {
    const firstVisit = VISIT_SEEDS.find((v) => v.hotel === h.key)!;
    const created = `${firstVisit.date}T08:00:00.000Z`;
    return {
      hotel_id: hotelId(h.key),
      name: h.name,
      brand: h.brand,
      address: h.address,
      area: h.area,
      city: h.city,
      region: h.region,
      country: h.country,
      country_code: h.country_code,
      lat: h.lat,
      lng: h.lng,
      source: 'seed',
      osm_id: h.osm_id,
      wikidata_id: null,
      website: null,
      phone: null,
      stars: h.stars,
      price_level: h.price_level,
      description: null,
      description_source: null,
      amenities_json: null,
      cover_photo_id: null,
      enrichment_status: 'none',
      enriched_at: null,
      created_at: created,
      updated_at: created,
      deleted: false,
    };
  });

  const visits: Visit[] = VISIT_SEEDS.map((v, i) => {
    const created = `${v.date}T18:00:00.000Z`;
    return {
      visit_id: seedUlid(created, 100 + i),
      hotel_id: hotelId(v.hotel),
      date: v.date,
      check_in: v.check_in,
      check_out: v.check_out,
      nights: v.nights,
      visit_type: v.visit_type,
      booked_via: v.booked_via,
      note: v.note,
      favourite_moment: v.favourite_moment,
      mood: v.mood,
      rating_nirsh: v.rating_nirsh,
      rating_shady: v.rating_shady,
      picked_by: v.picked_by,
      added_by: v.added_by,
      photo_ids_json: '[]',
      created_at: created,
      updated_at: created,
      deleted: false,
    };
  });

  const wishes: Wish[] = [
    { name: 'Six Senses Zighy Bay', lat: 25.710023, lng: 56.272654, city: 'Dibba', country: 'Oman', note: 'The one you paraglide into. We will take the car.', added_by: 'shady' as const, priority: 1 as const },
    { name: 'Al Maha Desert Resort', lat: 24.822999, lng: 55.662474, city: 'Dubai', country: 'United Arab Emirates', note: 'Oryx at breakfast, apparently.', added_by: 'nirsh' as const, priority: 2 as const },
  ].map((w, i) => {
    const created = `2026-09-2${i}T10:00:00.000Z`;
    return { wish_id: seedUlid(created, 200 + i), fulfilled_visit_id: null, created_at: created, updated_at: created, deleted: false, ...w };
  });

  const letters: Letter[] = [
    {
      letter_id: seedUlid('2026-09-30T20:00:00.000Z', 300),
      title: DEMO_LETTER_TITLE,
      body_md: letterBody ?? DEMO_LETTER_PLACEHOLDER,
      from: 'nirsh',
      to: 'shady',
      unlock_rule: 'always',
      written_at: '2026-09-30',
      read_at: null,
      created_at: '2026-09-30T20:00:00.000Z',
      updated_at: '2026-09-30T20:00:00.000Z',
    },
  ];

  return { hotels, visits, photos: [], wishes, places: [], letters, settings: defaultSettings(), serverTime: '2026-09-30T20:00:00.000Z' };
}
