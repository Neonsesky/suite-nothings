/** Home-screen city tabs and the filter sheet (SPEC §3.3). Pure — no store. */
import { ABROAD, averageRating, cityTab, visitSortKey } from '@/data/stays';
import type { HomeBase, PersonId, Stay, VisitType } from '@/data/types';
import { VISIT_TYPES } from '@/data/types';

export const ALL_TAB = 'All';

export interface CityTabOption {
  value: string;
  label: string;
  count: number;
}

const live = (stays: readonly Stay[]) => stays.filter((s) => !s.visit.deleted && !s.hotel.deleted);

/**
 * One tab per home-country city (SPEC's Dayuse-style pill row), ordered by visit count desc
 * then name, then an `Abroad` tab (if any), then `All` last. Every stay is reachable from a
 * non-`All` tab: `cityTab()` maps every hotel to either its home-country city or `Abroad`.
 */
export function cityTabs(stays: readonly Stay[], home: Pick<HomeBase, 'countryCode'>): CityTabOption[] {
  const liveStays = live(stays);
  const counts = new Map<string, number>();
  for (const s of liveStays) {
    const tab = cityTab(s.hotel, home);
    counts.set(tab, (counts.get(tab) ?? 0) + 1);
  }
  const abroadCount = counts.get(ABROAD) ?? 0;
  const cityEntries = [...counts.entries()].filter(([value]) => value !== ABROAD);
  cityEntries.sort(([a, ca], [b, cb]) => cb - ca || a.localeCompare(b));

  const tabs: CityTabOption[] = cityEntries.map(([value, count]) => ({ value, label: value, count }));
  if (abroadCount > 0) tabs.push({ value: ABROAD, label: ABROAD, count: abroadCount });
  tabs.push({ value: ALL_TAB, label: ALL_TAB, count: liveStays.length });
  return tabs;
}

export interface StayFilters {
  /** A hotel city name, or `Abroad` (cityTab semantics). */
  city?: string | null;
  year?: number | null;
  type?: VisitType | null;
  minRating?: number | null;
  pickedBy?: PersonId | 'both' | null;
}

export interface FilterOptions {
  /** Home-country cities present in the data, plus `Abroad` last if any stay is abroad. */
  cities: string[];
  years: number[];
  types: VisitType[];
  /** Minimum-rating thresholds meaningful for this data, e.g. `[3, 4, 5]`. */
  ratings: number[];
  pickedBy: (PersonId | 'both')[];
}

const RATING_THRESHOLDS = [3, 4, 5];
const PICKED_BY_ORDER: (PersonId | 'both')[] = ['nirsh', 'shady', 'both'];

/** Only the filter values actually present in the data, so the sheet never offers an empty option. */
export function filterOptions(stays: readonly Stay[], home: Pick<HomeBase, 'countryCode'>): FilterOptions {
  const liveStays = live(stays);

  const tabValues = new Set(liveStays.map((s) => cityTab(s.hotel, home)));
  const cities = [...tabValues].sort((a, b) => {
    if (a === ABROAD) return 1;
    if (b === ABROAD) return -1;
    return a.localeCompare(b);
  });

  const years = [...new Set(liveStays.map((s) => Number(s.visit.date.slice(0, 4))))].sort((a, b) => b - a);

  const types = VISIT_TYPES.filter((t) => liveStays.some((s) => s.visit.visit_type === t));

  const ratings = RATING_THRESHOLDS.filter((threshold) =>
    liveStays.some((s) => {
      const avg = averageRating(s.visit);
      return avg != null && avg >= threshold;
    }),
  );

  const pickedBy = PICKED_BY_ORDER.filter((p) => liveStays.some((s) => s.visit.picked_by === p));

  return { cities, years, types, ratings, pickedBy };
}

/** Case-insensitive match on hotel name, area, city, country, brand, note and favourite moment. */
export function matchesQuery(stay: Stay, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [stay.hotel.name, stay.hotel.brand, stay.hotel.area, stay.hotel.city, stay.hotel.country, stay.visit.note, stay.visit.favourite_moment]
    .filter(Boolean)
    .join(' \u0000 ')
    .toLowerCase();
  return hay.includes(q);
}

export function applyFilters(
  stays: readonly Stay[],
  f: StayFilters & { tab?: string | null; query?: string | null },
  home: Pick<HomeBase, 'countryCode'>,
): Stay[] {
  const matchesCity = (stay: Stay, city: string) => (city === ABROAD ? cityTab(stay.hotel, home) === ABROAD : stay.hotel.city === city);

  const out = live(stays).filter((s) => {
    if (f.tab && f.tab !== ALL_TAB && !matchesCity(s, f.tab)) return false;
    if (f.city && !matchesCity(s, f.city)) return false;
    if (f.year && !s.visit.date.startsWith(String(f.year))) return false;
    if (f.type && s.visit.visit_type !== f.type) return false;
    if (f.pickedBy && s.visit.picked_by !== f.pickedBy) return false;
    if (f.minRating) {
      const avg = averageRating(s.visit);
      if (avg == null || avg < f.minRating) return false;
    }
    if (f.query && !matchesQuery(s, f.query)) return false;
    return true;
  });

  // Newest first.
  return out.sort((a, b) => (visitSortKey(a.visit) < visitSortKey(b.visit) ? 1 : -1));
}

export function activeFilterCount(f: StayFilters): number {
  let n = 0;
  if (f.city != null) n++;
  if (f.year != null) n++;
  if (f.type != null) n++;
  if (f.minRating != null) n++;
  if (f.pickedBy != null) n++;
  return n;
}

/** Unique hotel brands, ordered by visit count desc then name (for a text marquee). */
export function brandsList(stays: readonly Stay[]): string[] {
  const counts = new Map<string, number>();
  for (const s of live(stays)) {
    const brand = s.hotel.brand;
    if (!brand) continue;
    counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a, ca], [b, cb]) => cb - ca || a.localeCompare(b)).map(([brand]) => brand);
}
