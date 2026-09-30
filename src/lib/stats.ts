/** Pure stats over stays (SPEC §3.3, §12). Inputs are `Stay[]` from the store; deleted stays are ignored. */
import type { HomeBase, PersonId, Stay } from '@/data/types';
import { timeToMinutes } from './dates';
import { haversineKm, pathKm, type LatLng } from './geo';

const live = (stays: readonly Stay[]) => stays.filter((s) => !s.visit.deleted && !s.hotel.deleted);
const chrono = (stays: readonly Stay[]) =>
  live(stays).sort((a, b) => a.visit.date.localeCompare(b.visit.date) || (a.visit.check_in ?? '').localeCompare(b.visit.check_in ?? ''));

export function hotelCount(stays: readonly Stay[]): number {
  return new Set(live(stays).map((s) => s.hotel.hotel_id)).size;
}

export function visitCount(stays: readonly Stay[]): number {
  return live(stays).length;
}

/** Hours for one stay from check-in/out and nights. Day use without times counts 0. */
export function stayHours(s: Pick<Stay['visit'], 'check_in' | 'check_out' | 'nights'>): number {
  const nights = Math.max(0, s.nights || 0);
  if (!s.check_in || !s.check_out) return nights * 24;
  const a = timeToMinutes(s.check_in);
  const b = timeToMinutes(s.check_out);
  let minutes = b - a + nights * 24 * 60;
  if (nights === 0 && minutes < 0) minutes += 24 * 60; // past midnight on a day stay
  return Math.max(0, minutes) / 60;
}

/** Total hours of hotel time together. */
export function hoursTogether(stays: readonly Stay[]): number {
  return live(stays).reduce((sum, s) => sum + stayHours(s.visit), 0);
}

export function cities(stays: readonly Stay[]): string[] {
  return [...new Set(live(stays).map((s) => `${s.hotel.city}|${s.hotel.country_code}`))].map((k) => k.split('|')[0]);
}

export function countries(stays: readonly Stay[]): string[] {
  return [...new Set(live(stays).map((s) => s.hotel.country_code.toUpperCase()))];
}

/** Countries other than home with at least one stay. */
export function countriesAbroad(stays: readonly Stay[], home: Pick<HomeBase, 'countryCode'>): string[] {
  return countries(stays).filter((c) => c !== home.countryCode.toUpperCase());
}

/** Km along the journey in chronological order, starting (and not ending) at home. */
export function kmTravelled(stays: readonly Stay[], home?: LatLng): number {
  const pts: LatLng[] = chrono(stays).map((s) => ({ lat: s.hotel.lat, lng: s.hotel.lng }));
  if (home && pts.length) pts.unshift(home);
  return pathKm(pts);
}

export function farthestFromHome(stays: readonly Stay[], home: LatLng): { stay: Stay; km: number } | null {
  let best: { stay: Stay; km: number } | null = null;
  for (const s of live(stays)) {
    const km = haversineKm(home, { lat: s.hotel.lat, lng: s.hotel.lng });
    if (!best || km > best.km) best = { stay: s, km };
  }
  return best;
}

export function longestStay(stays: readonly Stay[]): { stay: Stay; hours: number } | null {
  let best: { stay: Stay; hours: number } | null = null;
  for (const s of live(stays)) {
    const hours = stayHours(s.visit);
    if (!best || hours > best.hours) best = { stay: s, hours };
  }
  return best;
}

/** Hotel with the most visits (ties → most recent). null if no hotel has 2+ visits. */
export function mostRevisited(stays: readonly Stay[]): { hotelId: string; name: string; visits: number } | null {
  const counts = new Map<string, { name: string; visits: number; last: string }>();
  for (const s of live(stays)) {
    const c = counts.get(s.hotel.hotel_id) ?? { name: s.hotel.name, visits: 0, last: '' };
    c.visits++;
    if (s.visit.date > c.last) c.last = s.visit.date;
    counts.set(s.hotel.hotel_id, c);
  }
  let best: { hotelId: string; name: string; visits: number; last: string } | null = null;
  for (const [hotelId, c] of counts) {
    if (!best || c.visits > best.visits || (c.visits === best.visits && c.last > best.last)) best = { hotelId, ...c };
  }
  return best && best.visits > 1 ? { hotelId: best.hotelId, name: best.name, visits: best.visits } : null;
}

export function firstStay(stays: readonly Stay[]): Stay | null {
  return chrono(stays)[0] ?? null;
}
export function latestStay(stays: readonly Stay[]): Stay | null {
  const c = chrono(stays);
  return c[c.length - 1] ?? null;
}

/** Highest average rating (ties → most recent). */
export function favouriteStay(stays: readonly Stay[]): Stay | null {
  let best: { s: Stay; avg: number } | null = null;
  for (const s of chrono(stays)) {
    const r = [s.visit.rating_nirsh, s.visit.rating_shady].filter((x): x is NonNullable<typeof x> => x != null);
    if (!r.length) continue;
    const avg = r.reduce((a, b) => a + b, 0) / r.length;
    if (!best || avg >= best.avg) best = { s, avg };
  }
  return best?.s ?? null;
}

export interface PickScore {
  person: PersonId;
  picks: number;
  /** Mean of both ratings over that person's picks (null when none rated). */
  average: number | null;
}

/** Friendly running score of whose picks rate higher. Winner null on a tie or no data. */
export function whosePicksRateHigher(stays: readonly Stay[]): { nirsh: PickScore; shady: PickScore; winner: PersonId | null } {
  const score = (person: PersonId): PickScore => {
    const picks = live(stays).filter((s) => s.visit.picked_by === person);
    const ratings = picks.flatMap((s) => [s.visit.rating_nirsh, s.visit.rating_shady]).filter((x): x is NonNullable<typeof x> => x != null);
    return { person, picks: picks.length, average: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null };
  };
  const nirsh = score('nirsh');
  const shady = score('shady');
  let winner: PersonId | null = null;
  if (nirsh.average != null && shady.average != null && Math.abs(nirsh.average - shady.average) > 1e-9) {
    winner = nirsh.average > shady.average ? 'nirsh' : 'shady';
  } else if (nirsh.average != null && shady.average == null) winner = 'nirsh';
  else if (shady.average != null && nirsh.average == null) winner = 'shady';
  return { nirsh, shady, winner };
}

/** Stays waiting for `person`'s rating. */
export function awaitingRating(stays: readonly Stay[], person: PersonId): Stay[] {
  return live(stays).filter((s) => (person === 'nirsh' ? s.visit.rating_nirsh : s.visit.rating_shady) == null);
}

export interface Summary {
  hotels: number;
  visits: number;
  hours: number;
  cities: number;
  countries: number;
  km: number;
}

export function summary(stays: readonly Stay[], home?: LatLng): Summary {
  return {
    hotels: hotelCount(stays),
    visits: visitCount(stays),
    hours: Math.round(hoursTogether(stays)),
    cities: cities(stays).length,
    countries: countries(stays).length,
    km: Math.round(kmTravelled(stays, home)),
  };
}
