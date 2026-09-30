import { describe, expect, it } from 'vitest';
import { isUlid, ulid, ulidTime } from '@/lib/ulid';

describe('ulid', () => {
  it('produces a 26-character id', () => {
    expect(ulid()).toHaveLength(26);
  });
  it('is recognised by isUlid', () => {
    expect(isUlid(ulid())).toBe(true);
  });
  it('rejects non-ulid strings', () => {
    expect(isUlid('not-a-ulid')).toBe(false);
    expect(isUlid('0123456789ABCDEFGHJKMNPI')).toBe(false); // wrong length + invalid char 'I'
  });

  it('is monotonic (strictly increasing) for repeated calls at the same instant', () => {
    const now = 1_750_000_000_000;
    const a = ulid(now);
    const b = ulid(now);
    const c = ulid(now);
    expect(a < b).toBe(true);
    expect(b < c).toBe(true);
  });

  it('round-trips the timestamp through ulidTime', () => {
    const now = Date.now();
    expect(ulidTime(ulid(now))).toBe(now);
  });

  it('is sortable by time: ids from later instants sort after earlier ones', () => {
    const t1 = 1_700_000_000_000;
    const t2 = 1_700_000_000_001;
    const first = ulid(t1);
    const second = ulid(t2);
    expect([second, first].sort()).toEqual([first, second]);
  });
});
