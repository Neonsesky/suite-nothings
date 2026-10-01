/**
 * Milestone engine (SPEC §12). Pure and deterministic: the same stays (in any order) always give
 * the same milestones, each credited to the stay that first reached it.
 *
 * Rules, in catalogue order:
 * - first-stay: the first live stay.
 * - hotels-N (5/10/25/50/100): the stay that brings the unique hotel count to N.
 * - first-outside-home-city: a hotel whose city differs from the home city (case-insensitive,
 *   trimmed). When the hotel has no city we fall back to distance: more than 40 km from home.
 *   A hotel in another country always counts as outside.
 * - first-abroad: a hotel whose country code differs from home's.
 * - three-in-a-month: the third stay within one calendar month (by check-in date).
 * - anniversary-stay: a stay dated on a monthly anniversary (the 19th, lib/dates).
 * - five-star: a stay every given rating of which is 5 (at least one rating). The hotel's official
 *   star class doesn't count: the copy is about our own "perfect 5 stars".
 * - our-regular: the third visit to the same hotel.
 * Deleted visits and deleted hotels are ignored.
 */
import { COUPLE } from '@/config/couple';
import type { HomeBase, Stay } from '@/data/types';
import { isMonthAnniversary } from '@/lib/dates';
import { haversineKm } from '@/lib/geo';

export type MilestoneId =
  | 'first-stay'
  | 'hotels-5'
  | 'hotels-10'
  | 'hotels-25'
  | 'hotels-50'
  | 'hotels-100'
  | 'first-outside-home-city'
  | 'first-abroad'
  | 'three-in-a-month'
  | 'anniversary-stay'
  | 'five-star'
  | 'our-regular';

export interface Milestone {
  id: MilestoneId;
  title: string; // e.g. "5 hotels"
  caption: string; // e.g. "5 hotels together. We're building a habit."
  /** Visit that unlocked it. */
  visitId: string | null;
  /** YYYY-MM-DD */
  achievedOn: string;
  /** Filled-in {country} / {hotelName} for copy, when the rule has one. */
  detail?: string;
}

export type MilestoneIcon = 'key' | 'keys' | 'pin' | 'plane' | 'calendar' | 'heart' | 'star' | 'home';

export interface MilestoneDef {
  id: MilestoneId;
  /** Grid label, e.g. "First stay outside Dubai" (us.milestone.*.name). */
  name: string;
  /** Shown while locked, e.g. "Unlocks at 5 hotels" (us.milestone.*.locked). */
  locked: string;
  /** Milestones are celebration, so every stamp is ginger (SPEC §3.2). */
  tone: 'honey' | 'ginger';
  /** 1–4 characters shown big on the stamp face, e.g. "5", "19", "★". */
  short: string;
  /** Tiny line under `short`, e.g. "hotels". */
  caption: string;
  /** Icon hint for richer stamps. */
  icon: MilestoneIcon;
}

export interface MilestoneOptions {
  home?: Pick<HomeBase, 'city' | 'countryCode' | 'lat' | 'lng'>;
}

/** Hotels with no city this far from home count as outside the home city. */
export const OUTSIDE_HOME_KM = 40;

interface CopyRow {
  key: string;
  short: string;
  small: string;
  icon: MilestoneIcon;
  name: string;
  locked: string;
  unlocked: string;
  toast: string;
}

/** design/copy.md `us.milestone.*` and `addStay.milestone.*`. */
const COPY: Record<MilestoneId, CopyRow> = {
  'first-stay': {
    key: 'firstStay',
    short: '1',
    small: 'first stay',
    icon: 'key',
    name: 'First stay',
    locked: 'Unlocks with our first stay',
    unlocked: 'Every room starts somewhere.',
    toast: 'Our first stay. Every room starts somewhere.',
  },
  'hotels-5': {
    key: 'hotels5',
    short: '5',
    small: 'hotels',
    icon: 'keys',
    name: '5 hotels',
    locked: 'Unlocks at 5 hotels',
    unlocked: "5 hotels together. We're building a habit.",
    toast: "5 hotels. We're building a habit.",
  },
  'hotels-10': {
    key: 'hotels10',
    short: '10',
    small: 'hotels',
    icon: 'keys',
    name: '10 hotels',
    locked: 'Unlocks at 10 hotels',
    unlocked: '10 hotels together.',
    toast: '10 hotels together.',
  },
  'hotels-25': {
    key: 'hotels25',
    short: '25',
    small: 'hotels',
    icon: 'keys',
    name: '25 hotels',
    locked: 'Unlocks at 25 hotels',
    unlocked: '25 hotels. A whole shelf of key tags.',
    toast: '25 hotels. A whole shelf of key tags.',
  },
  'hotels-50': {
    key: 'hotels50',
    short: '50',
    small: 'hotels',
    icon: 'keys',
    name: '50 hotels',
    locked: 'Unlocks at 50 hotels',
    unlocked: '50 hotels together.',
    toast: '50 hotels together.',
  },
  'hotels-100': {
    key: 'hotels100',
    short: '100',
    small: 'hotels',
    icon: 'keys',
    name: '100 hotels',
    locked: 'Unlocks at 100 hotels',
    unlocked: '100 hotels. We should get a plaque.',
    toast: '100 hotels. We should get a plaque.',
  },
  'first-outside-home-city': {
    key: 'firstOutsideHomeCity',
    short: 'Away',
    small: 'from home',
    icon: 'pin',
    name: 'First stay outside {homeCity}',
    locked: 'Unlocks the first time we stay outside {homeCity}',
    unlocked: 'First stay outside {homeCity}. The map just got bigger.',
    toast: 'First stay outside {homeCity}. The map just got bigger.',
  },
  'first-abroad': {
    key: 'firstAbroad',
    short: '✈',
    small: 'abroad',
    icon: 'plane',
    name: 'First stay abroad',
    locked: 'Unlocks the first time we stay in another country',
    unlocked: 'First stay abroad, in {country}.',
    toast: 'First stay abroad, in {country}.',
  },
  'three-in-a-month': {
    key: 'threeInOneMonth',
    short: '3×',
    small: 'in a month',
    icon: 'calendar',
    name: 'On a roll',
    locked: 'Unlocks with three stays in one month',
    unlocked: "Three stays this month. We're on a roll.",
    toast: "Three stays this month. We're on a roll.",
  },
  'anniversary-stay': {
    key: 'monthlyAnniversary',
    short: '19',
    small: 'on the 19th',
    icon: 'heart',
    name: 'Right on the 19th',
    locked: 'Unlocks with a stay on our monthly anniversary',
    unlocked: "Checked in on the 19th. You didn't even plan that, did you?",
    toast: "Checked in on the 19th. You didn't even plan that, did you?",
  },
  'five-star': {
    key: 'fiveStars',
    short: '★',
    small: 'perfect',
    icon: 'star',
    name: 'Perfect stay',
    locked: 'Unlocks with a 5-star stay',
    unlocked: 'A perfect 5 stars. Noted.',
    toast: 'A perfect 5 stars. Noted.',
  },
  'our-regular': {
    key: 'thirdVisit',
    short: '3rd',
    small: 'visit',
    icon: 'home',
    name: 'Our regular',
    locked: 'Unlocks the third time we return to a hotel',
    unlocked: 'Third time at {hotelName}. That makes it ours.',
    toast: 'Third time at {hotelName}. That makes it ours.',
  },
};

/** Catalogue order (also the order several milestones unlocked by one stay are shown in). */
export const MILESTONE_IDS: readonly MilestoneId[] = [
  'first-stay',
  'hotels-5',
  'hotels-10',
  'hotels-25',
  'hotels-50',
  'hotels-100',
  'first-outside-home-city',
  'first-abroad',
  'three-in-a-month',
  'anniversary-stay',
  'five-star',
  'our-regular',
];

const HOTEL_STEPS: ReadonlyArray<[number, MilestoneId]> = [
  [5, 'hotels-5'],
  [10, 'hotels-10'],
  [25, 'hotels-25'],
  [50, 'hotels-50'],
  [100, 'hotels-100'],
];

type Vars = { homeCity?: string; country?: string; hotelName?: string };

function fill(template: string, vars: Vars): string {
  return template.replace(/\{(homeCity|country|hotelName)\}/g, (_, k: keyof Vars) => vars[k] ?? '');
}

const defaultHome = (): Required<MilestoneOptions>['home'] => COUPLE.defaultHomeBase;

/** The catalogue for the Us screen's earned/locked grid, with {homeCity} filled in. */
export function milestoneDefs(opts: MilestoneOptions = {}): MilestoneDef[] {
  const homeCity = (opts.home ?? defaultHome()).city;
  return MILESTONE_IDS.map((id) => {
    const c = COPY[id];
    return { id, name: fill(c.name, { homeCity }), locked: fill(c.locked, { homeCity }), tone: 'ginger', short: c.short, caption: c.small, icon: c.icon };
  });
}

/** Catalogue for the default home base (Dubai). Prefer `milestoneDefs({ home })` when home can change. */
export const MILESTONE_DEFS: readonly MilestoneDef[] = milestoneDefs();

/** The catalogue entry for one milestone. */
export function milestoneDef(id: MilestoneId, opts: MilestoneOptions = {}): MilestoneDef {
  return milestoneDefs(opts).find((d) => d.id === id)!;
}

/** The add-stay toast line (copy.md `addStay.milestone.*`) for a reached milestone. */
export function milestoneToast(m: Milestone, opts: MilestoneOptions = {}): string {
  const homeCity = (opts.home ?? defaultHome()).city;
  return fill(COPY[m.id].toast, { homeCity, country: m.detail, hotelName: m.detail });
}

/** Chronological order with stable tie-breaks, so input order never matters. */
function chronological(stays: readonly Stay[]): Stay[] {
  return stays
    .filter((s) => !s.visit.deleted && !s.hotel.deleted)
    .slice()
    .sort((a, b) => {
      const x = a.visit;
      const y = b.visit;
      return (
        cmp(x.date, y.date) ||
        cmp(x.check_in ?? '', y.check_in ?? '') ||
        cmp(x.created_at, y.created_at) ||
        cmp(x.visit_id, y.visit_id)
      );
    });
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

function isOutsideHomeCity(s: Stay, home: Required<MilestoneOptions>['home']): boolean {
  const code = norm(s.hotel.country_code);
  if (code && code !== norm(home.countryCode)) return true;
  const city = norm(s.hotel.city);
  if (city) return city !== norm(home.city);
  if (!Number.isFinite(s.hotel.lat) || !Number.isFinite(s.hotel.lng)) return false;
  return haversineKm({ lat: home.lat, lng: home.lng }, { lat: s.hotel.lat, lng: s.hotel.lng }) > OUTSIDE_HOME_KM;
}

function isPerfect(s: Stay): boolean {
  const ratings = [s.visit.rating_nirsh, s.visit.rating_shady].filter((r) => r != null);
  return ratings.length > 0 && ratings.every((r) => r === 5);
}

/** Every milestone reached by `stays`, in the order they were reached (catalogue order within one stay). */
export function allMilestones(stays: readonly Stay[], opts: MilestoneOptions = {}): Milestone[] {
  const home = opts.home ?? defaultHome();
  const homeCity = home.city;
  const out: Milestone[] = [];
  const got = new Set<MilestoneId>();
  const hotels = new Set<string>();
  const perHotel = new Map<string, number>();
  const perMonth = new Map<string, number>();

  for (const s of chronological(stays)) {
    const { visit, hotel } = s;
    hotels.add(hotel.hotel_id);
    const visits = (perHotel.get(hotel.hotel_id) ?? 0) + 1;
    perHotel.set(hotel.hotel_id, visits);
    const month = visit.date.slice(0, 7);
    const inMonth = (perMonth.get(month) ?? 0) + 1;
    perMonth.set(month, inMonth);

    const reached: Array<[MilestoneId, string | undefined]> = [];
    reached.push(['first-stay', undefined]);
    for (const [n, id] of HOTEL_STEPS) if (hotels.size >= n) reached.push([id, undefined]);
    if (isOutsideHomeCity(s, home)) reached.push(['first-outside-home-city', undefined]);
    const code = norm(hotel.country_code);
    if (code && code !== norm(home.countryCode)) reached.push(['first-abroad', hotel.country.trim() || hotel.country_code.toUpperCase()]);
    if (inMonth >= 3) reached.push(['three-in-a-month', undefined]);
    if (isMonthAnniversary(visit.date)) reached.push(['anniversary-stay', undefined]);
    if (isPerfect(s)) reached.push(['five-star', undefined]);
    if (visits >= 3) reached.push(['our-regular', hotel.name]);

    reached.sort((a, b) => MILESTONE_IDS.indexOf(a[0]) - MILESTONE_IDS.indexOf(b[0]));
    for (const [id, detail] of reached) {
      if (got.has(id)) continue;
      got.add(id);
      const c = COPY[id];
      const vars = { homeCity, country: detail, hotelName: detail };
      out.push({
        id,
        title: fill(c.name, vars),
        caption: fill(c.unlocked, vars),
        visitId: visit.visit_id,
        achievedOn: visit.date,
        ...(detail ? { detail } : {}),
      });
    }
  }
  return out;
}

/** Milestones newly reached by `stays` that are not already in `prev`. Idempotent and order-independent. */
export function checkMilestones(stays: readonly Stay[], prev: readonly Pick<Milestone, 'id'>[], opts: MilestoneOptions = {}): Milestone[] {
  const seen = new Set(prev.map((m) => m.id));
  return allMilestones(stays, opts).filter((m) => !seen.has(m.id));
}
