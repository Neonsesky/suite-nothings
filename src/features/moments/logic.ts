/** Moments (SPEC §12): "on this day" memories and the monthly anniversary on the 19th. Pure. */
import type { Stay } from '@/data/types';
import { anniversaryNumber, monthAnniversaryDate, monthsTogether, parseDate, toIsoDate, zonedParts } from '@/lib/dates';
import { hotelCount } from '@/lib/stats';

export interface OnThisDay {
  stay: Stay;
  /** Whole months back (12 = a year). */
  monthsAgo: number;
  /** "1 year ago today", "3 months ago today". */
  when: string;
}

export interface Anniversary {
  months: number;
  /** YYYY-MM-DD of the anniversary shown. */
  date: string;
  isToday: boolean;
  hotels: number;
  title: string;
  body: string;
}

const live = (stays: readonly Stay[]) => stays.filter((s) => !s.visit.deleted && !s.hotel.deleted);

export function agoLabel(monthsAgo: number): string {
  if (monthsAgo % 12 === 0) {
    const y = monthsAgo / 12;
    return `${y} ${y === 1 ? 'year' : 'years'} ago today`;
  }
  return `${monthsAgo} ${monthsAgo === 1 ? 'month' : 'months'} ago today`;
}

/**
 * Stays checked in on today's day of the month in an earlier month or year. Whole years come first
 * (biggest feels), then the most recent months. One stay per hotel per day; at most `limit`.
 */
export function onThisDay(stays: readonly Stay[], today: string, limit = 3): OnThisDay[] {
  const t = parseDate(today);
  const out: OnThisDay[] = [];
  for (const s of live(stays)) {
    if (s.visit.date >= today) continue;
    const v = parseDate(s.visit.date);
    if (v.d !== t.d) continue;
    const monthsAgo = (t.y - v.y) * 12 + (t.m - v.m);
    if (monthsAgo < 1) continue;
    out.push({ stay: s, monthsAgo, when: agoLabel(monthsAgo) });
  }
  const seen = new Set<string>();
  return out
    .sort((a, b) => {
      const ya = a.monthsAgo % 12 === 0 ? 0 : 1;
      const yb = b.monthsAgo % 12 === 0 ? 0 : 1;
      return ya - yb || (ya === 0 ? b.monthsAgo - a.monthsAgo : a.monthsAgo - b.monthsAgo) || a.stay.hotel.name.localeCompare(b.stay.hotel.name);
    })
    .filter((m) => {
      const k = `${m.monthsAgo}|${m.stay.hotel.hotel_id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
}

/** "4 months together, 15 hotels in." (design/copy.md home.monthlyAnniversary.body). */
export function anniversaryCopy(months: number, hotels: number): { title: string; body: string } {
  const span = months % 12 === 0 ? `${months / 12} ${months === 12 ? 'year' : 'years'}` : `${months} ${months === 1 ? 'month' : 'months'}`;
  return { title: `${span} together`, body: `${span} together, ${hotels} ${hotels === 1 ? 'hotel' : 'hotels'} in.` };
}

/**
 * Today's monthly anniversary, or (with `includePast`) the most recent one, so the slot is never
 * blank once we've passed our first month. Hotels count up to and including that day.
 */
export function anniversary(stays: readonly Stay[], today: string, now: Date = new Date(), includePast = true): Anniversary | null {
  const n = anniversaryNumber(today);
  if (n != null && n > 0) {
    const hotels = hotelCount(live(stays).filter((s) => s.visit.date <= today));
    return { months: n, date: today, isToday: true, hotels, ...anniversaryCopy(n, hotels) };
  }
  if (!includePast) return null;
  const months = monthsTogether(now);
  if (months < 1) return null;
  const p = zonedParts(monthAnniversaryDate(months));
  const date = toIsoDate({ y: p.y, m: p.m, d: p.d });
  const hotels = hotelCount(live(stays).filter((s) => s.visit.date <= date));
  return { months, date, isToday: false, hotels, ...anniversaryCopy(months, hotels) };
}
