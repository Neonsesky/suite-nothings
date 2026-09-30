/** Pure helpers that derive `Stay` views and filter them. No IndexedDB here (unit-testable). */
import type { Hotel, HomeBase, Photo, PersonId, Stay, Visit, VisitType } from './types';

export interface StayFilter {
  /** Hotel city name, or the special value 'Abroad' (outside the home-base country). */
  city?: string | null;
  year?: number | null;
  type?: VisitType | null;
  /** Minimum average rating (1–5). */
  minRating?: number | null;
  pickedBy?: PersonId | 'both' | null;
  /** Case-insensitive match on hotel name, area, city, note, favourite moment. */
  query?: string | null;
  hotelId?: string | null;
  includeDeleted?: boolean;
  /** Default 'newest'. */
  order?: 'newest' | 'oldest';
}

export const ABROAD = 'Abroad';

export function parseJsonArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Chronological key for sorting visits: date, then check-in time, then created_at. */
export function visitSortKey(v: Visit): string {
  return `${v.date}T${v.check_in ?? '00:00'}|${v.created_at}`;
}

/** Joins visits with hotels and photos. Skips visits whose hotel is missing. Oldest first. */
export function buildStays(visits: Iterable<Visit>, hotels: ReadonlyMap<string, Hotel>, photos: Iterable<Photo>): Stay[] {
  const byVisit = new Map<string, Photo[]>();
  for (const p of photos) {
    if (p.deleted) continue;
    const arr = byVisit.get(p.visit_id);
    if (arr) arr.push(p);
    else byVisit.set(p.visit_id, [p]);
  }
  const sorted = [...visits].filter((v) => hotels.has(v.hotel_id)).sort((a, b) => (visitSortKey(a) < visitSortKey(b) ? -1 : 1));
  const perHotel = new Map<string, number>();
  let n = 0;
  const out: Stay[] = [];
  for (const visit of sorted) {
    const hotel = hotels.get(visit.hotel_id)!;
    let visitNumber = 0;
    let stayNumber = 0;
    if (!visit.deleted) {
      visitNumber = (perHotel.get(hotel.hotel_id) ?? 0) + 1;
      perHotel.set(hotel.hotel_id, visitNumber);
      stayNumber = ++n;
    }
    const order = parseJsonArray(visit.photo_ids_json);
    const ph = (byVisit.get(visit.visit_id) ?? []).slice().sort((a, b) => {
      const ia = order.indexOf(a.photo_id);
      const ib = order.indexOf(b.photo_id);
      return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) || (a.created_at < b.created_at ? -1 : 1);
    });
    out.push({ visit, hotel, photos: ph, visitNumber, stayNumber });
  }
  return out;
}

/** City tab for a hotel: its city when in the home-base country, otherwise 'Abroad'. */
export function cityTab(hotel: Pick<Hotel, 'city' | 'country_code'>, home: Pick<HomeBase, 'countryCode'>): string {
  return hotel.country_code.toUpperCase() === home.countryCode.toUpperCase() ? hotel.city : ABROAD;
}

export function averageRating(v: Pick<Visit, 'rating_nirsh' | 'rating_shady'>): number | null {
  const r = [v.rating_nirsh, v.rating_shady].filter((x): x is NonNullable<typeof x> => x != null);
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
}

export function filterStays(stays: readonly Stay[], f: StayFilter = {}, home?: Pick<HomeBase, 'countryCode'>): Stay[] {
  const q = f.query?.trim().toLowerCase();
  const out = stays.filter(({ visit, hotel }) => {
    if (!f.includeDeleted && (visit.deleted || hotel.deleted)) return false;
    if (f.hotelId && visit.hotel_id !== f.hotelId) return false;
    if (f.city) {
      if (f.city === ABROAD) {
        if (!home || hotel.country_code.toUpperCase() === home.countryCode.toUpperCase()) return false;
      } else if (hotel.city !== f.city) return false;
    }
    if (f.year && !visit.date.startsWith(String(f.year))) return false;
    if (f.type && visit.visit_type !== f.type) return false;
    if (f.pickedBy && visit.picked_by !== f.pickedBy) return false;
    if (f.minRating) {
      const avg = averageRating(visit);
      if (avg == null || avg < f.minRating) return false;
    }
    if (q) {
      const hay = [hotel.name, hotel.brand, hotel.area, hotel.city, hotel.country, visit.note, visit.favourite_moment]
        .filter(Boolean)
        .join(' \u0000 ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return f.order === 'oldest' ? out : out.reverse();
}
