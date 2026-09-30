/**
 * Date helpers. Calendar dates are plain `YYYY-MM-DD` strings and are never shifted through a
 * local-time Date. Formatting is locale-stable: `19 Jun 2026`, 24h `HH:mm`.
 */
import { COUPLE } from '@/config/couple';

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

export interface YMD {
  y: number;
  m: number; // 1–12
  d: number;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function parseDate(s: string): YMD {
  const m = DATE_RE.exec(s.trim());
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${s}`);
  return { y: +m[1], m: +m[2], d: +m[3] };
}

export function toIsoDate({ y, m, d }: YMD): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** `2026-06-19` → `19 Jun 2026` */
export function formatDate(s: string): string {
  const { y, m, d } = parseDate(s);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** `2026-06-19` → `19 Jun` */
export function formatDateShort(s: string): string {
  const { m, d } = parseDate(s);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** `2026-06-19` → `June 2026` */
export function formatMonth(s: string): string {
  const { y, m } = parseDate(s);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** Normalises `9:5`, `09:05`, `0905` → `09:05`; returns null if invalid. */
export function normaliseTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}):?(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = +m[1];
  const mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

/** `14:00`, `20:00` → `14:00 → 20:00`; one side only → `from 14:00` / `until 20:00`. */
export function formatTimeRange(checkIn: string | null, checkOut: string | null): string | null {
  const a = normaliseTime(checkIn);
  const b = normaliseTime(checkOut);
  if (a && b) return `${a} → ${b}`;
  if (a) return `from ${a}`;
  if (b) return `until ${b}`;
  return null;
}

/** Minutes since midnight for `HH:mm`. */
export function timeToMinutes(t: string): number {
  const n = normaliseTime(t);
  if (!n) throw new Error(`Not a HH:mm time: ${t}`);
  return +n.slice(0, 2) * 60 + +n.slice(3);
}

/** Wall-clock parts of `instant` in `timeZone`. */
export function zonedParts(instant: Date, timeZone: string = COUPLE.timezone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (t: string) => +(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day'), hh: get('hour'), mm: get('minute'), ss: get('second') };
}

/** Today's date in the couple's timezone (Asia/Dubai by default), as `YYYY-MM-DD`. */
export function today(timeZone: string = COUPLE.timezone, now: Date = new Date()): string {
  const p = zonedParts(now, timeZone);
  return toIsoDate({ y: p.y, m: p.m, d: p.d });
}

/** Current `HH:mm` in the couple's timezone. */
export function nowTime(timeZone: string = COUPLE.timezone, now: Date = new Date()): string {
  const p = zonedParts(now, timeZone);
  return `${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}`;
}

/** Day number (days since 1970-01-01) of a calendar date; for pure date arithmetic. */
export function dayNumber(s: string): number {
  const { y, m, d } = parseDate(s);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function addDays(s: string, n: number): string {
  const dt = new Date((dayNumber(s) + n) * 86_400_000);
  return toIsoDate({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface Duration {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Whole calendar months (anniversary-aware) and remaining days. */
  months: number;
  monthDays: number;
}

/** Time elapsed since `COUPLE.togetherSince` (or `since`). */
export function togetherDuration(now: Date = new Date(), since: string = COUPLE.togetherSince): Duration {
  const start = new Date(since);
  const totalMs = Math.max(0, now.getTime() - start.getTime());
  const s = Math.floor(totalMs / 1000);
  const months = monthsTogether(now, since);
  const anniv = monthAnniversaryDate(months, since);
  const monthDays = Math.max(0, Math.floor((now.getTime() - anniv.getTime()) / 86_400_000));
  return {
    totalMs,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    months,
    monthDays,
  };
}

/** The instant of the n-th month anniversary (day clamped to month length, same wall time). */
export function monthAnniversaryDate(n: number, since: string = COUPLE.togetherSince): Date {
  const tz = COUPLE.timezone;
  const start = new Date(since);
  const p = zonedParts(start, tz);
  const total = p.m - 1 + n;
  const y = p.y + Math.floor(total / 12);
  const m = (total % 12) + 1;
  const d = Math.min(p.d, daysInMonth(y, m));
  // Offset between the zone and UTC at the start instant (Asia/Dubai has no DST).
  const offsetMs = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - start.getTime();
  return new Date(Date.UTC(y, m - 1, d, p.hh, p.mm, p.ss) - offsetMs);
}

/** Whole months together at `now`. */
export function monthsTogether(now: Date = new Date(), since: string = COUPLE.togetherSince): number {
  const start = new Date(since);
  if (now < start) return 0;
  const p0 = zonedParts(start);
  const p1 = zonedParts(now);
  let n = (p1.y - p0.y) * 12 + (p1.m - p0.m);
  if (monthAnniversaryDate(n, since) > now) n--;
  return Math.max(0, n);
}

/** Is calendar `date` a monthly anniversary day (the 19th, clamped for short months)? */
export function isMonthAnniversary(date: string, since: string = COUPLE.togetherSince): boolean {
  const start = zonedParts(new Date(since));
  const { y, m, d } = parseDate(date);
  if (date <= toIsoDate({ y: start.y, m: start.m, d: start.d })) return false;
  return d === Math.min(start.d, daysInMonth(y, m));
}

/** Which month anniversary `date` is (1, 2, …), or null. */
export function anniversaryNumber(date: string, since: string = COUPLE.togetherSince): number | null {
  if (!isMonthAnniversary(date, since)) return null;
  const start = zonedParts(new Date(since));
  const { y, m } = parseDate(date);
  return (y - start.y) * 12 + (m - start.m);
}

/** Relative "3 min ago" style copy for sync timestamps. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diff = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  const p = zonedParts(new Date(iso));
  return formatDate(toIsoDate({ y: p.y, m: p.m, d: p.d }));
}
