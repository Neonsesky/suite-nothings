/** Home-screen "moment" card (SPEC §3.3): an on-this-day memory, or a monthly anniversary. Pure. */
import type { Stay } from '@/data/types';
import { isMonthAnniversary, monthAnniversaryDate, monthsTogether, parseDate, toIsoDate, zonedParts } from '@/lib/dates';
import { hotelCount } from '@/lib/stats';

export type Moment =
  | { kind: 'onThisDay'; title: string; body: string; stay: Stay }
  | { kind: 'anniversary'; title: string; body: string; months: number; date: string; isToday: boolean };

const live = (stays: readonly Stay[]) => stays.filter((s) => !s.visit.deleted && !s.hotel.deleted);

function hotelsUpTo(stays: readonly Stay[], date: string): number {
  return hotelCount(stays.filter((s) => s.visit.date <= date));
}

/** A live stay whose check-in falls on today's month/day in an earlier year. Closest year wins. */
function findOnThisDay(stays: readonly Stay[], today: string): Stay | null {
  const { y: todayYear, m: todayMonth, d: todayDay } = parseDate(today);
  let best: Stay | null = null;
  let bestYear = -Infinity;
  for (const s of live(stays)) {
    if (s.visit.date >= today) continue; // must be strictly in the past
    const { y, m, d } = parseDate(s.visit.date);
    if (m !== todayMonth || d !== todayDay || y >= todayYear) continue;
    if (y > bestYear || (y === bestYear && (best == null || s.hotel.name.localeCompare(best.hotel.name) < 0))) {
      best = s;
      bestYear = y;
    }
  }
  return best;
}

export function pickMoment(stays: readonly Stay[], today: string, now: Date = new Date()): Moment | null {
  const onThisDay = findOnThisDay(stays, today);
  if (onThisDay) {
    const years = parseDate(today).y - parseDate(onThisDay.visit.date).y;
    const body = years === 1 ? `1 year ago today, we checked into ${onThisDay.hotel.name}.` : `${years} years ago today, we checked into ${onThisDay.hotel.name}.`;
    return { kind: 'onThisDay', title: 'On this day', body, stay: onThisDay };
  }

  const months = monthsTogether(now);
  if (months < 1) return null;

  if (isMonthAnniversary(today)) {
    const n = hotelsUpTo(stays, today);
    return { kind: 'anniversary', title: `${months} months together`, body: `${months} months together, ${n} hotels in.`, months, date: today, isToday: true };
  }

  // Most recent past monthly anniversary: `months` is already the count of whole months elapsed.
  const anniversaryInstant = monthAnniversaryDate(months);
  const p = zonedParts(anniversaryInstant);
  const anniversaryDate = toIsoDate({ y: p.y, m: p.m, d: p.d });
  const n = hotelsUpTo(stays, anniversaryDate);
  return {
    kind: 'anniversary',
    title: `${months} months together`,
    body: `${months} months together, ${n} hotels in.`,
    months,
    date: anniversaryDate,
    isToday: false,
  };
}
