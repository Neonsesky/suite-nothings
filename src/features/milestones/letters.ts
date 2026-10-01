/** "A new note is waiting": tell me when a stay unlocks a letter addressed to me. */
import { navigate } from '@/app/router';
import { getDevice } from '@/data/device';
import { getState } from '@/data/store';
import type { HomeBase, Letter, PersonId, Stay } from '@/data/types';
import { isUnlocked, type UnlockStats } from '@/features/letters/unlock';
import { today } from '@/lib/dates';
import { countriesAbroad, hotelCount, visitCount } from '@/lib/stats';
import { toast } from '@/lib/toast';

export const NEW_LETTER_COPY = 'A new note is waiting in Letters';

function statsOf(stays: readonly Stay[], home: Pick<HomeBase, 'countryCode'>): UnlockStats {
  return { visits: visitCount(stays), hotels: hotelCount(stays), countriesAbroad: countriesAbroad(stays, home).length };
}

/** Unread letters to `me` that `after` unlocks and `before` didn't. Pure. */
export function newlyUnlockedLetters(
  letters: readonly Letter[],
  me: PersonId | null,
  before: readonly Stay[],
  after: readonly Stay[],
  home: Pick<HomeBase, 'countryCode'>,
  day: string = today(),
): Letter[] {
  if (!me) return [];
  const a = statsOf(before, home);
  const b = statsOf(after, home);
  return letters.filter((l) => l.to === me && l.from !== me && !l.read_at && !isUnlocked(l, a, day) && isUnlocked(l, b, day));
}

let deferred: (() => void) | null = null;
let isBusy: () => boolean = () => false;

/** The unlock overlay registers itself so the toast waits until the stamps are done. */
export function setLetterToastGate(busy: () => boolean): void {
  isBusy = busy;
}

/** Called when the unlock overlay closes. */
export function flushLetterToast(): void {
  const run = deferred;
  deferred = null;
  run?.();
}

/** Show the "new note" toast if `after` unlocks a letter for me. Returns how many unlocked. */
export function notifyNewLetters(before: readonly Stay[], after: readonly Stay[]): number {
  const s = getState();
  const fresh = newlyUnlockedLetters([...s.letters.values()], getDevice('me'), before, after, s.settings.home_base);
  if (!fresh.length) return 0;
  const show = () =>
    toast.show({
      id: 'new-letter',
      tone: 'love',
      message: NEW_LETTER_COPY,
      action: { label: 'Open', onClick: () => navigate(fresh.length === 1 ? `/letters/${encodeURIComponent(fresh[0].letter_id)}` : '/letters') },
    });
  if (isBusy()) deferred = show;
  else show();
  return fresh.length;
}
