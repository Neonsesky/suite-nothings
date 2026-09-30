import { describe, expect, it } from 'vitest';
import {
  addDays,
  anniversaryNumber,
  daysBetween,
  formatDate,
  formatDateShort,
  formatMonth,
  formatRelative,
  formatTimeRange,
  isIsoDate,
  isMonthAnniversary,
  monthsTogether,
  normaliseTime,
  timeToMinutes,
  today,
  togetherDuration,
} from '@/lib/dates';

describe('formatDate / formatDateShort / formatMonth', () => {
  it('formats a full date', () => {
    expect(formatDate('2026-06-19')).toBe('19 Jun 2026');
  });
  it('formats a short date without year', () => {
    expect(formatDateShort('2026-06-19')).toBe('19 Jun');
  });
  it('formats a month/year', () => {
    expect(formatMonth('2026-06-19')).toBe('June 2026');
  });
});

describe('isIsoDate', () => {
  it('accepts a valid date', () => {
    expect(isIsoDate('2026-06-19')).toBe(true);
  });
  it('rejects an invalid day-of-month (Feb 30 in a non-leap-aware way)', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
  });
  it('rejects garbage', () => {
    expect(isIsoDate('not-a-date')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
  });
});

describe('normaliseTime', () => {
  it('pads single-digit hours', () => {
    expect(normaliseTime('9:05')).toBe('09:05');
  });
  it('accepts already-padded times', () => {
    expect(normaliseTime('09:05')).toBe('09:05');
  });
  it('accepts compact HHmm', () => {
    expect(normaliseTime('0905')).toBe('09:05');
  });
  it('rejects an out-of-range time', () => {
    expect(normaliseTime('2460')).toBeNull();
  });
  it('returns null for empty/nullish input', () => {
    expect(normaliseTime(null)).toBeNull();
    expect(normaliseTime(undefined)).toBeNull();
    expect(normaliseTime('')).toBeNull();
  });
});

describe('formatTimeRange', () => {
  it('formats both sides', () => {
    expect(formatTimeRange('14:00', '20:00')).toBe('14:00 → 20:00');
  });
  it('formats check-in only', () => {
    expect(formatTimeRange('14:00', null)).toBe('from 14:00');
  });
  it('formats check-out only', () => {
    expect(formatTimeRange(null, '20:00')).toBe('until 20:00');
  });
  it('returns null when both sides are missing', () => {
    expect(formatTimeRange(null, null)).toBeNull();
  });
});

describe('timeToMinutes', () => {
  it('converts HH:mm to minutes since midnight', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('01:05')).toBe(65);
    expect(timeToMinutes('23:59')).toBe(1439);
  });
  it('throws for an invalid time', () => {
    expect(() => timeToMinutes('bad')).toThrow();
  });
});

describe('today', () => {
  it('rolls over to the next day in Asia/Dubai (UTC+4) near UTC midnight', () => {
    expect(today('Asia/Dubai', new Date('2026-06-19T21:00:00Z'))).toBe('2026-06-20');
  });
  it('stays on the same day just before the rollover', () => {
    expect(today('Asia/Dubai', new Date('2026-06-19T19:59:00Z'))).toBe('2026-06-19');
  });
});

describe('addDays', () => {
  it('rolls over a month end', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });
  it('rolls over a year end', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('subtracts days too', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('daysBetween', () => {
  it('counts whole days b - a', () => {
    expect(daysBetween('2026-06-19', '2026-06-20')).toBe(1);
    expect(daysBetween('2026-06-20', '2026-06-19')).toBe(-1);
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
  });
});

describe('togetherDuration', () => {
  it('reports exactly one day and zero months after 24h', () => {
    const d = togetherDuration(new Date('2026-06-20T23:46:00+04:00'), '2026-06-19T23:46:00+04:00');
    expect(d.totalMs).toBe(86_400_000);
    expect(d.days).toBe(1);
    expect(d.hours).toBe(0);
    expect(d.minutes).toBe(0);
    expect(d.seconds).toBe(0);
    expect(d.months).toBe(0);
    expect(d.monthDays).toBe(1);
  });
});

describe('monthsTogether', () => {
  const since = '2026-06-19T23:46:00+04:00';
  it('is 0 one minute before the monthly anniversary instant', () => {
    expect(monthsTogether(new Date('2026-07-19T23:45:00+04:00'), since)).toBe(0);
  });
  it('is 1 one minute after the monthly anniversary instant', () => {
    expect(monthsTogether(new Date('2026-07-19T23:47:00+04:00'), since)).toBe(1);
  });
  it('is 3 well past the third anniversary', () => {
    expect(monthsTogether(new Date('2026-09-30T12:00:00+04:00'), since)).toBe(3);
  });
});

describe('isMonthAnniversary', () => {
  const since = '2026-06-19T23:46:00+04:00';
  it('is true on the monthly anniversary day', () => {
    expect(isMonthAnniversary('2026-07-19', since)).toBe(true);
  });
  it('is false on the start day itself', () => {
    expect(isMonthAnniversary('2026-06-19', since)).toBe(false);
  });
  it('is false on a nearby non-anniversary day', () => {
    expect(isMonthAnniversary('2026-07-18', since)).toBe(false);
  });
});

describe('anniversaryNumber', () => {
  it('counts the third month anniversary', () => {
    expect(anniversaryNumber('2026-09-19')).toBe(3);
  });
  it('is null off-anniversary', () => {
    expect(anniversaryNumber('2026-09-18')).toBeNull();
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-06-19T12:00:00Z');
  it('says just now for very recent timestamps', () => {
    expect(formatRelative(new Date(now.getTime() - 10_000).toISOString(), now)).toBe('just now');
  });
  it('says minutes ago', () => {
    expect(formatRelative(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe('5 min ago');
  });
  it('says hours ago', () => {
    expect(formatRelative(new Date(now.getTime() - 3 * 3_600_000).toISOString(), now)).toBe('3 h ago');
  });
  it('falls back to a formatted date beyond a day', () => {
    expect(formatRelative(new Date(now.getTime() - 2 * 86_400_000).toISOString(), now)).toBe(formatDate('2026-06-17'));
  });
});
