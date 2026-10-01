/** Pure helpers for the Us dashboard (SPEC §8.7, §12). Unit-tested in tests/unit/us.test.ts. */
import { personName, type PersonId } from '@/config/couple';
import type { HomeBase, Stay } from '@/data/types';
import { formatKm } from '@/lib/geo';
import { farthestFromHome, longestStay, mostRevisited, summary, whosePicksRateHigher, type Summary } from '@/lib/stats';

export interface PickBoard {
  rows: { person: PersonId; name: string; picks: number; average: number | null; /** 0–1 share of the 5-point scale */ fill: number; leader: boolean }[];
  /** Friendly one-liner (design/copy.md us.picks.*). */
  line: string;
  state: 'leader' | 'tie' | 'empty';
}

/** "4.3" — one decimal, trailing ".0" kept so the two scores line up. */
export function formatScore(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

/** Whose picks rate higher, as a running score with bar fills and the copy line. */
export function pickBoard(stays: readonly Stay[]): PickBoard {
  const r = whosePicksRateHigher(stays);
  const both = [r.nirsh, r.shady];
  const rated = both.filter((p) => p.average != null);
  // Compare on the displayed (rounded) score so the copy never says "4.3 beats 4.3".
  const shownEqual = rated.length === 2 && formatScore(r.nirsh.average!) === formatScore(r.shady.average!);
  const winner = shownEqual ? null : r.winner;
  const rows = both.map((p) => ({
    person: p.person,
    name: personName(p.person),
    picks: p.picks,
    average: p.average,
    fill: p.average == null ? 0 : Math.max(0, Math.min(1, p.average / 5)),
    leader: winner === p.person,
  }));
  if (rated.length === 0) return { rows, line: 'Rate a few stays and we’ll keep score.', state: 'empty' };
  if (!winner) return { rows, line: 'Dead even. You both pick well.', state: 'tie' };
  const lead = winner === 'nirsh' ? r.nirsh : r.shady;
  const other = winner === 'nirsh' ? r.shady : r.nirsh;
  const line =
    other.average == null
      ? `${personName(lead.person)}'s picks average ${formatScore(lead.average!)}. ${personName(other.person)}, your move.`
      : `${personName(lead.person)}'s picks average ${formatScore(lead.average!)}, ${personName(other.person)}'s average ${formatScore(other.average)}.`;
  return { rows, line, state: 'leader' };
}

export interface Highlight {
  key: 'longest' | 'farthest' | 'regular';
  label: string;
  value: string;
  detail: string;
  visitId: string | null;
}

/** "26 h" under two days, else "3 nights". */
export function formatStayLength(hours: number, nights: number): string {
  if (nights >= 2) return `${nights} nights`;
  if (nights === 1 && hours >= 24) return hours >= 30 ? `1 night, ${Math.round(hours)} h` : '1 night';
  return `${Math.round(hours)} h`;
}

export function highlights(stays: readonly Stay[], home: HomeBase, units: 'km' | 'mi' = 'km'): Highlight[] {
  const out: Highlight[] = [];
  const longest = longestStay(stays);
  if (longest && longest.hours > 0) {
    out.push({
      key: 'longest',
      label: 'Longest stay',
      value: formatStayLength(longest.hours, longest.stay.visit.nights),
      detail: longest.stay.hotel.name,
      visitId: longest.stay.visit.visit_id,
    });
  }
  const far = farthestFromHome(stays, home);
  if (far && far.km >= 1) {
    out.push({
      key: 'farthest',
      label: 'Farthest from home',
      value: formatKm(far.km, units),
      detail: `${far.stay.hotel.name}, ${far.stay.hotel.city || far.stay.hotel.country}`,
      visitId: far.stay.visit.visit_id,
    });
  }
  const regular = mostRevisited(stays);
  if (regular) {
    const latest = [...stays].filter((s) => s.hotel.hotel_id === regular.hotelId && !s.visit.deleted).sort((a, b) => b.visit.date.localeCompare(a.visit.date))[0];
    out.push({
      key: 'regular',
      label: regular.visits >= 3 ? 'Our regular' : 'Most revisited',
      value: `${regular.visits} visits`,
      detail: regular.name,
      visitId: latest?.visit.visit_id ?? null,
    });
  }
  return out;
}

export interface StatTile {
  key: keyof Summary;
  value: string;
  label: string;
}

export function statTiles(stays: readonly Stay[], home: HomeBase, units: 'km' | 'mi' = 'km'): StatTile[] {
  const s = summary(stays, home);
  const n = (v: number) => v.toLocaleString('en-GB');
  return [
    { key: 'hotels', value: n(s.hotels), label: s.hotels === 1 ? 'Hotel' : 'Hotels' },
    { key: 'visits', value: n(s.visits), label: s.visits === 1 ? 'Visit' : 'Visits' },
    { key: 'hours', value: n(s.hours), label: 'Hours together in hotels' },
    { key: 'cities', value: n(s.cities), label: s.cities === 1 ? 'City' : 'Cities' },
    { key: 'countries', value: n(s.countries), label: s.countries === 1 ? 'Country' : 'Countries' },
    { key: 'km', value: formatKm(s.km, units), label: 'Travelled, stay to stay' },
  ];
}
