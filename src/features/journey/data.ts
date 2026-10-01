/** Journey data prep (SPEC §10): which stays play, month ticks for the scrubber, the finale stats. Pure. */
import type { HomeBase, Stay } from '@/data/types';
import { MONTHS_SHORT, formatDate } from '@/lib/dates';
import { cities, countries, hotelCount, kmTravelled } from '@/lib/stats';

export type JourneyFilter = 'all' | 'year' | 'home';

export const FILTERS: { value: JourneyFilter; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'year', label: 'This year' },
  { value: 'home', label: 'Home city only' },
];

/** Chronological, filtered stays. `today` is YYYY-MM-DD in the couple's time zone. */
export function journeyStays(all: readonly Stay[], filter: JourneyFilter, home: HomeBase, today: string): Stay[] {
  const live = all.filter((s) => !s.visit.deleted && !s.hotel.deleted);
  const year = today.slice(0, 4);
  const kept = live.filter((s) => {
    if (filter === 'year') return s.visit.date.startsWith(year);
    if (filter === 'home') return s.hotel.city === home.city;
    return true;
  });
  return kept.sort(
    (a, b) => a.visit.date.localeCompare(b.visit.date) || (a.visit.check_in ?? '').localeCompare(b.visit.check_in ?? '') || a.stayNumber - b.stayNumber,
  );
}

/** Split-flap date text, e.g. `19 JUN 2026` (day padded so the board keeps its width). */
export function boardDate(iso: string): string {
  return formatDate(iso).toUpperCase().padStart(11, '0');
}

export interface MonthTick {
  /** 0–1 along the scrubber. */
  at: number;
  label: string;
}

/**
 * One tick per month boundary crossed by the replay, placed at the first arrival in that month.
 * `stopTimes[i]` is when stop i is reached; `total` is the full timeline length.
 */
export function monthTicks(stays: readonly Stay[], stopTimes: readonly number[], total: number): MonthTick[] {
  if (!total) return [];
  const ticks: MonthTick[] = [];
  let last = '';
  stays.forEach((s, i) => {
    const ym = s.visit.date.slice(0, 7);
    if (ym === last || stopTimes[i] === undefined) return;
    last = ym;
    ticks.push({ at: stopTimes[i] / total, label: MONTHS_SHORT[Number(ym.slice(5, 7)) - 1] });
  });
  return ticks;
}

export interface FinaleStats {
  hotels: number;
  cities: number;
  countries: number;
  km: number;
}

/** The replay leaves from home, so the distance does too. */
export function finaleStats(stays: readonly Stay[], home?: HomeBase): FinaleStats {
  return { hotels: hotelCount(stays), cities: cities(stays).length, countries: countries(stays).length, km: kmTravelled(stays, home) };
}

/** The postcard's quote: the favourite moment, else the note's first sentence, trimmed for a card. */
export function postcardLine(s: Stay, max = 90): string | null {
  const raw = (s.visit.favourite_moment || s.visit.note || '').trim();
  if (!raw) return null;
  const first = raw.match(/^.+?[.!?](\s|$)/)?.[0]?.trim() ?? raw;
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : max).replace(/[,;:\s]+$/, '')}…`;
}
