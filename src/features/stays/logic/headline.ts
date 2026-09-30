/**
 * Home-screen headline copy (SPEC §3.3 Dayuse-style hero). Pure — no store, no Date.now().
 * Priority order: no live stays → default; explicit milestone → byMilestone; monthly
 * anniversary window → byAnniversary; a very recent stay → byLatest(Revisit); a long gap
 * since the last stay → byCountPlain; otherwise alternate byCount/byCountPlain by day so the
 * headline is stable within a single day but still varies over time.
 */
import type { Stay } from '@/data/types';
import { daysBetween, dayNumber, parseDate } from '@/lib/dates';
import { hotelCount, latestStay, visitCount } from '@/lib/stats';

export type HeadlineKind = 'default' | 'byCount' | 'byCountPlain' | 'byLatest' | 'byLatestRevisit' | 'byAnniversary' | 'byMilestone';

export const HEADLINE_COPY = {
  byCount: (n: number) => `Stay ${n}, and still checking in.`,
  byCountPlain: (n: number) => `${n} hotels, one us.`,
  byLatest: (hotelName: string, city: string) => `Last stop: ${hotelName} in ${city}.`,
  byLatestRevisit: (hotelName: string) => `Back at ${hotelName}. We know the way now.`,
  byAnniversary: (months: number, n: number) => `${months} months together, ${n} hotels in.`,
  byMilestone: (n: number) => `Hotel number ${n}. We're keeping count.`,
  default: "Every room we've made ours.",
} as const;

export interface HeadlineContext {
  /** Today's date, `YYYY-MM-DD`, in the couple's timezone. */
  today: string;
  monthsTogether: number;
  /** Set when a hotel-count milestone was just hit (e.g. the 10th hotel). */
  milestoneHotels?: number | null;
}

/** Within this many days of the anniversary day-of-month, treat it as "anniversary season". */
const ANNIVERSARY_WINDOW = [18, 19, 20];
/** A stay within this many days counts as "just happened". */
const RECENT_DAYS = 7;
/** Beyond this many days since the last stay, favour the plain hotel count. */
const LONG_GAP_DAYS = 21;

export function pickHeadline(stays: readonly Stay[], ctx: HeadlineContext): { kind: HeadlineKind; text: string } {
  const visits = visitCount(stays);
  if (visits === 0) {
    return { kind: 'default', text: HEADLINE_COPY.default };
  }

  if (ctx.milestoneHotels != null) {
    return { kind: 'byMilestone', text: HEADLINE_COPY.byMilestone(ctx.milestoneHotels) };
  }

  const day = parseDate(ctx.today).d;
  if (ANNIVERSARY_WINDOW.includes(day) && ctx.monthsTogether >= 1) {
    return { kind: 'byAnniversary', text: HEADLINE_COPY.byAnniversary(ctx.monthsTogether, hotelCount(stays)) };
  }

  const latest = latestStay(stays);
  if (latest) {
    const gap = daysBetween(latest.visit.date, ctx.today);
    if (gap <= RECENT_DAYS) {
      return latest.visitNumber > 1
        ? { kind: 'byLatestRevisit', text: HEADLINE_COPY.byLatestRevisit(latest.hotel.name) }
        : { kind: 'byLatest', text: HEADLINE_COPY.byLatest(latest.hotel.name, latest.hotel.city) };
    }
    if (gap > LONG_GAP_DAYS) {
      return { kind: 'byCountPlain', text: HEADLINE_COPY.byCountPlain(hotelCount(stays)) };
    }
  }

  // Stable within a day, but alternates over time so the home screen doesn't go stale.
  return dayNumber(ctx.today) % 2 === 0
    ? { kind: 'byCount', text: HEADLINE_COPY.byCount(visits) }
    : { kind: 'byCountPlain', text: HEADLINE_COPY.byCountPlain(hotelCount(stays)) };
}
