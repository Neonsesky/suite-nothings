import { describe, expect, it } from 'vitest';
import type { UnlockRule } from '@/data/types';
import { isUnlocked, parseUnlockRule, unlockHint } from '@/features/letters/unlock';

describe('parseUnlockRule', () => {
  it('parses always (including empty string)', () => {
    expect(parseUnlockRule('always')).toEqual({ kind: 'always' });
    expect(parseUnlockRule('')).toEqual({ kind: 'always' });
    expect(parseUnlockRule(null)).toEqual({ kind: 'always' });
    expect(parseUnlockRule(undefined)).toEqual({ kind: 'always' });
  });
  it('parses first_abroad', () => {
    expect(parseUnlockRule('first_abroad')).toEqual({ kind: 'first_abroad' });
  });
  it('parses visits>=N', () => {
    expect(parseUnlockRule('visits>=3')).toEqual({ kind: 'visits', n: 3 });
  });
  it('parses hotels>=N', () => {
    expect(parseUnlockRule('hotels>=10')).toEqual({ kind: 'hotels', n: 10 });
  });
  it('parses date>=YYYY-MM-DD', () => {
    expect(parseUnlockRule('date>=2026-09-19')).toEqual({ kind: 'date', date: '2026-09-19' });
  });
  it('tolerates whitespace and case from hand-edited Sheets', () => {
    expect(parseUnlockRule('  Visits >= 3 ')).toEqual({ kind: 'visits', n: 3 });
    expect(parseUnlockRule('HOTELS>=5')).toEqual({ kind: 'hotels', n: 5 });
    expect(parseUnlockRule('  ALWAYS ')).toEqual({ kind: 'always' });
  });
  it('marks unrecognised rules invalid, preserving the raw text', () => {
    expect(parseUnlockRule('visits>=')).toEqual({ kind: 'invalid', raw: 'visits>=' });
    expect(parseUnlockRule('nonsense')).toEqual({ kind: 'invalid', raw: 'nonsense' });
  });
});

describe('isUnlocked', () => {
  const stats = { visits: 5, hotels: 3, countriesAbroad: 0 };

  it('always unlocks', () => {
    expect(isUnlocked({ unlock_rule: 'always' }, stats, '2026-06-19')).toBe(true);
  });
  it('visits>=N unlocks once the threshold is met', () => {
    expect(isUnlocked({ unlock_rule: 'visits>=5' }, stats, '2026-06-19')).toBe(true);
    expect(isUnlocked({ unlock_rule: 'visits>=6' }, stats, '2026-06-19')).toBe(false);
  });
  it('hotels>=N unlocks once the threshold is met', () => {
    expect(isUnlocked({ unlock_rule: 'hotels>=3' }, stats, '2026-06-19')).toBe(true);
    expect(isUnlocked({ unlock_rule: 'hotels>=4' }, stats, '2026-06-19')).toBe(false);
  });
  it('first_abroad unlocks once at least one country abroad is visited', () => {
    expect(isUnlocked({ unlock_rule: 'first_abroad' }, stats, '2026-06-19')).toBe(false);
    expect(isUnlocked({ unlock_rule: 'first_abroad' }, { ...stats, countriesAbroad: 1 }, '2026-06-19')).toBe(true);
  });
  it('date>=YYYY-MM-DD unlocks on or after the date (boundary is inclusive)', () => {
    expect(isUnlocked({ unlock_rule: 'date>=2026-09-19' }, stats, '2026-09-19')).toBe(true);
    expect(isUnlocked({ unlock_rule: 'date>=2026-09-19' }, stats, '2026-09-18')).toBe(false);
    expect(isUnlocked({ unlock_rule: 'date>=2026-09-19' }, stats, '2026-09-20')).toBe(true);
  });
  it('invalid rules always stay locked', () => {
    expect(isUnlocked({ unlock_rule: 'nonsense' as unknown as UnlockRule }, stats, '2026-09-19')).toBe(false);
  });
});

describe('unlockHint', () => {
  it('gives copy for each rule kind', () => {
    expect(unlockHint('always')).toBe('Ready to read');
    expect(unlockHint('visits>=5')).toBe('Opens on our stay number 5');
    expect(unlockHint('hotels>=3')).toBe('Opens at 3 hotels');
    expect(unlockHint('first_abroad')).toBe('Opens on our first stay abroad');
    expect(unlockHint('date>=2026-09-19')).toBe('Opens on 19 Sep 2026');
    expect(unlockHint('garbage')).toBe('Sealed for now');
  });
});
