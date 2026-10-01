/** Pure wishlist helpers (unit-tested in tests/unit/wishlist.test.ts). */
import { FLAP_CHARSET_DEFAULT } from '@/components/SplitFlap';
import type { Wish } from '@/data/types';

export const PRIORITY_LABELS: Record<1 | 2 | 3, string> = { 1: 'Top of the list', 2: 'Soon', 3: 'Someday' };

/** Open wishes (not yet a stay), top priority first, then newest. */
export function openWishes(wishes: readonly Wish[]): Wish[] {
  return wishes
    .filter((w) => !w.deleted && !w.fulfilled_visit_id)
    .sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9) || b.created_at.localeCompare(a.created_at));
}

export function fulfilledWishes(wishes: readonly Wish[]): Wish[] {
  return wishes.filter((w) => !w.deleted && !!w.fulfilled_visit_id).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

/**
 * A random open wish. Top-priority wishes are twice as likely, and the previous pick is skipped
 * when there's another, so "Surprise me" twice in a row feels like a new spin.
 */
export function pickSurprise(wishes: readonly Wish[], previousId: string | null = null, random: () => number = Math.random): Wish | null {
  let pool = openWishes(wishes);
  if (pool.length > 1 && previousId) pool = pool.filter((w) => w.wish_id !== previousId);
  if (!pool.length) return null;
  const weights = pool.map((w) => (w.priority === 1 ? 2 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.min(0.999999, Math.max(0, random())) * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Text for the split-flap board: upper case, flap-safe glyphs only, accents folded, max `len`. */
export function flapText(name: string, len = 14): string {
  const folded = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/&/g, ' ')
    .split('')
    .map((c) => (FLAP_CHARSET_DEFAULT.includes(c) ? c : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (folded.length <= len) return folded;
  const cut = folded.slice(0, len + 1);
  const space = cut.lastIndexOf(' ');
  return (space > len / 2 ? cut.slice(0, space) : folded.slice(0, len)).trim();
}

export function placeLine(w: Pick<Wish, 'city' | 'country'>): string {
  return [w.city, w.country].filter((x) => x && x.trim()).join(', ');
}
