/** Which letters this device may see, and the stats their unlock rules read. */
import { useMemo } from 'react';
import type { PersonId } from '@/config/couple';
import type { Letter } from '@/data/types';
import { useLetters, useMe, useSettings, useStays } from '@/data/store';
import { today } from '@/lib/dates';
import { countriesAbroad, hotelCount, visitCount } from '@/lib/stats';
import { isUnlocked, type UnlockStats } from './unlock';

export interface LetterView {
  letter: Letter;
  /** Written by me (I see it whatever its rule, plus its read receipt). */
  mine: boolean;
  unlocked: boolean;
}

export function useUnlockStats(): UnlockStats {
  const stays = useStays();
  const home = useSettings().home_base;
  return useMemo(
    () => ({ visits: visitCount(stays), hotels: hotelCount(stays), countriesAbroad: countriesAbroad(stays, home).length }),
    [stays, home],
  );
}

export function viewLetters(letters: readonly Letter[], me: PersonId | null, stats: UnlockStats, day: string): LetterView[] {
  return letters
    .filter((l) => !me || l.to === me || l.from === me)
    .map((letter) => ({ letter, mine: letter.from === me && letter.to !== me, unlocked: isUnlocked(letter, stats, day) }));
}

export function useLetterViews(): LetterView[] {
  const letters = useLetters();
  const me = useMe();
  const stats = useUnlockStats();
  return useMemo(() => viewLetters(letters, me, stats, today()), [letters, me, stats]);
}

/** "September 2026" from an ISO timestamp or YYYY-MM-DD. */
export function writtenMonth(writtenAt: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(writtenAt);
  if (!m) return '';
  const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : '';
}
