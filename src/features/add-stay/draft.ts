/**
 * Add-a-stay draft: the whole form as one serialisable object (autosaved to the `drafts` store),
 * plus the pure helpers that turn it into store writes. Unit-tested in tests/unit/add-stay-draft.test.ts.
 */
import type { PersonId } from '@/config/couple';
import type { HotelInput, VisitInput } from '@/data/store';
import type { BookedVia, Hotel, Photo, Rating, Visit, VisitType } from '@/data/types';
import { normaliseTime, timeToMinutes } from '@/lib/dates';
import type { PlaceResult } from '@/lib/geocode';

export const DRAFT_VERSION = 1;
export const NEW_DRAFT_ID = 'add-stay';
export const editDraftId = (visitId: string) => `edit-stay:${visitId}`;

export const STEPS = ['hotel', 'when', 'what', 'photos', 'good'] as const;
export type StepId = (typeof STEPS)[number];
export const STEP_TITLES: Record<StepId, string> = {
  hotel: 'Hotel',
  when: 'When',
  what: 'What we did',
  photos: 'Photos',
  good: 'The good part',
};

/** Visit types that span a night. Picking one bumps `nights` to at least 1. */
export const NIGHT_TYPES: readonly VisitType[] = ['Overnight', 'Staycation'];

/** A hotel the stay will be saved against: one we already have, or a new one to create. */
export type HotelChoice =
  | { kind: 'existing'; hotel_id: string }
  | { kind: 'new'; hotel: NewHotel };

/** Everything a new Hotel record gets from search, GPS or a manual pin (SPEC §5). */
export type NewHotel = Pick<
  Hotel,
  'name' | 'brand' | 'address' | 'area' | 'city' | 'region' | 'country' | 'country_code' | 'lat' | 'lng' | 'source' | 'osm_id' | 'wikidata_id' | 'website' | 'phone' | 'stars'
>;

export interface DraftPhoto {
  /** Local id for React keys; becomes nothing on save (the store mints the photo_id). */
  key: string;
  /** Set for photos that already belong to the visit (edit mode). */
  photo_id: string | null;
  thumb: Blob | null;
  full: Blob | null;
  width: number;
  height: number;
  taken_at: string | null;
  caption: string;
  gps: { lat: number; lng: number } | null;
}

export interface AddStayDraft {
  v: typeof DRAFT_VERSION;
  step: number;
  /** Furthest step reached, so the progress bar can jump back and forth. */
  reached: number;
  hotel: HotelChoice | null;
  date: string;
  check_in: string;
  check_out: string;
  nights: number;
  visit_type: VisitType;
  booked_via: BookedVia | null;
  note: string;
  favourite_moment: string;
  mood: Visit['mood'];
  rating: Rating | null;
  picked_by: Visit['picked_by'];
  photos: DraftPhoto[];
  /** The EXIF suggestion was answered (either way); don't ask again. */
  exifAnswered: boolean;
}

export function emptyDraft(date: string): AddStayDraft {
  return {
    v: DRAFT_VERSION,
    step: 0,
    reached: 0,
    hotel: null,
    date,
    check_in: '',
    check_out: '',
    nights: 0,
    visit_type: 'Dayuse',
    booked_via: null,
    note: '',
    favourite_moment: '',
    mood: null,
    rating: null,
    picked_by: null,
    photos: [],
    exifAnswered: false,
  };
}

/** True once the draft holds anything worth asking about before discarding. */
export function isDirty(d: AddStayDraft, base: AddStayDraft): boolean {
  const keys: (keyof AddStayDraft)[] = ['hotel', 'date', 'check_in', 'check_out', 'nights', 'visit_type', 'booked_via', 'note', 'favourite_moment', 'mood', 'rating', 'picked_by'];
  if (d.photos.length !== base.photos.length || d.photos.some((p, i) => p.key !== base.photos[i]?.key || p.caption !== base.photos[i]?.caption)) return true;
  return keys.some((k) => JSON.stringify(d[k]) !== JSON.stringify(base[k]));
}

/** Loads a stored draft if it looks like ours; anything else is ignored. */
export function reviveDraft(data: unknown): AddStayDraft | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<AddStayDraft>;
  if (d.v !== DRAFT_VERSION || typeof d.date !== 'string' || !Array.isArray(d.photos)) return null;
  return { ...emptyDraft(d.date), ...d } as AddStayDraft;
}

/** A Photon (or server geocoder) result as a new hotel. Brand, wikidata and contact come from OSM tags. */
export function hotelFromPlace(p: PlaceResult, fallback: { city: string; country: string; countryCode: string }): NewHotel {
  const t = p.tags ?? {};
  const stars = Number.parseFloat(t.stars ?? '');
  return {
    name: p.name,
    brand: t.brand ?? t.operator ?? null,
    address: p.address,
    area: p.area,
    city: p.city ?? p.region ?? fallback.city,
    region: p.region,
    country: p.country ?? fallback.country,
    country_code: (p.country_code ?? fallback.countryCode).toUpperCase(),
    lat: p.lat,
    lng: p.lng,
    source: 'photon',
    osm_id: p.osm_id,
    wikidata_id: t.wikidata ?? t['brand:wikidata'] ?? null,
    website: t.website ?? t['contact:website'] ?? null,
    phone: t.phone ?? t['contact:phone'] ?? null,
    stars: Number.isFinite(stars) && stars >= 1 && stars <= 5 ? Math.round(stars) : null,
  };
}

export type StepProblem = 'hotelRequired' | 'dateRequired' | 'checkOutBeforeCheckIn' | 'badTime' | null;

export const PROBLEM_COPY: Record<Exclude<StepProblem, null>, string> = {
  hotelRequired: 'Add a hotel to continue.',
  dateRequired: 'Pick a date to continue.',
  checkOutBeforeCheckIn: 'Check-out is before check-in. Fix the times to continue.',
  badTime: 'Times look like 14:00. Fix the times to continue.',
};

/** What stops the user leaving `step`, if anything. */
export function stepProblem(d: AddStayDraft, step: StepId): StepProblem {
  if (step === 'hotel') return d.hotel ? null : 'hotelRequired';
  if (step === 'when') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return 'dateRequired';
    const a = d.check_in.trim() ? normaliseTime(d.check_in) : '';
    const b = d.check_out.trim() ? normaliseTime(d.check_out) : '';
    if (a === null || b === null) return 'badTime';
    // A day stay may run past midnight (check-out before 06:00); anything else is a typo.
    if (a && b && d.nights === 0 && timeToMinutes(b) <= timeToMinutes(a) && timeToMinutes(b) >= 6 * 60) return 'checkOutBeforeCheckIn';
  }
  return null;
}

/** Hours between check-in and check-out, for the "14:00 → 18:00 · 4 h" preview. */
export function durationLabel(checkIn: string, checkOut: string, nights: number): string | null {
  const a = normaliseTime(checkIn);
  const b = normaliseTime(checkOut);
  if (!a || !b) return null;
  let minutes = timeToMinutes(b) - timeToMinutes(a) + nights * 24 * 60;
  if (nights === 0 && minutes < 0) minutes += 24 * 60;
  if (minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export interface SavePlan {
  /** Present when the hotel is new and must be created first. */
  hotel: HotelInput | null;
  /** hotel_id is '' when `hotel` is new; fill it with the created id. */
  visit: VisitInput;
  /** New photos to add, in display order. */
  newPhotos: DraftPhoto[];
  /** Final order of every photo: saved photo_ids, or `new:<index into newPhotos>`. */
  order: string[];
}

/**
 * The writes a save makes. My rating goes into my column; the other person's is left alone
 * (null for a new stay), so the card can say "Waiting for Shady's rating".
 */
export function buildSavePlan(d: AddStayDraft, ctx: { me: PersonId | null; existing?: Visit | null; hotelId?: string }): SavePlan {
  if (!d.hotel) throw new Error('A stay needs a hotel');
  const me = ctx.me ?? 'nirsh';
  const hotel: HotelInput | null = d.hotel.kind === 'new' ? { ...d.hotel.hotel } : null;
  const hotel_id = d.hotel.kind === 'existing' ? d.hotel.hotel_id : ctx.hotelId ?? '';
  const text = (s: string) => (s.trim() ? s.trim() : null);
  const nights = NIGHT_TYPES.includes(d.visit_type) ? Math.max(1, d.nights) : Math.max(0, d.nights);
  const newPhotos = d.photos.filter((p) => !p.photo_id);
  let n = 0;
  const order = d.photos.map((p) => p.photo_id ?? `new:${n++}`);
  const visit: VisitInput = {
    ...(ctx.existing ? { visit_id: ctx.existing.visit_id } : {}),
    hotel_id,
    date: d.date,
    check_in: normaliseTime(d.check_in),
    check_out: normaliseTime(d.check_out),
    nights,
    visit_type: d.visit_type,
    booked_via: d.booked_via,
    note: text(d.note),
    favourite_moment: text(d.favourite_moment),
    mood: d.mood,
    [me === 'shady' ? 'rating_shady' : 'rating_nirsh']: d.rating,
    picked_by: d.picked_by,
    photo_ids_json: JSON.stringify(order.filter((id) => !id.startsWith('new:'))),
  };
  return { hotel, visit, newPhotos, order };
}

/** Prefill a draft from a saved visit (edit mode). */
export function draftFromVisit(v: Visit, photos: Photo[], me: PersonId | null): AddStayDraft {
  return {
    ...emptyDraft(v.date),
    step: 0,
    reached: STEPS.length - 1,
    hotel: { kind: 'existing', hotel_id: v.hotel_id },
    check_in: v.check_in ?? '',
    check_out: v.check_out ?? '',
    nights: v.nights,
    visit_type: v.visit_type,
    booked_via: v.booked_via,
    note: v.note ?? '',
    favourite_moment: v.favourite_moment ?? '',
    mood: v.mood,
    rating: me === 'shady' ? v.rating_shady : v.rating_nirsh,
    picked_by: v.picked_by,
    photos: photos.map((p) => ({
      key: p.photo_id,
      photo_id: p.photo_id,
      thumb: null,
      full: null,
      width: p.width,
      height: p.height,
      taken_at: p.taken_at,
      caption: p.caption ?? '',
      gps: null,
    })),
    exifAnswered: true,
  };
}

/** Revisit defaults: what we did last time at this hotel. */
export function revisitDefaults(last: Visit | null): Partial<AddStayDraft> {
  if (!last) return {};
  return { visit_type: last.visit_type, booked_via: last.booked_via, nights: NIGHT_TYPES.includes(last.visit_type) ? Math.max(1, last.nights) : 0 };
}
