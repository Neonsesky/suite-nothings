/** Letter unlock rules (SPEC §5): always | visits>=N | hotels>=N | first_abroad | date>=YYYY-MM-DD. */
import type { Letter, UnlockRule } from '@/data/types';

export interface UnlockStats {
  visits: number;
  hotels: number;
  /** Countries other than the home-base country with at least one stay. */
  countriesAbroad: number;
}

export type ParsedRule =
  | { kind: 'always' }
  | { kind: 'visits'; n: number }
  | { kind: 'hotels'; n: number }
  | { kind: 'first_abroad' }
  | { kind: 'date'; date: string }
  | { kind: 'invalid'; raw: string };

/** Parse a rule string, tolerating whitespace and case from hand-edited Sheets. */
export function parseUnlockRule(raw: string | null | undefined): ParsedRule {
  const r = (raw ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (r === '' || r === 'always') return { kind: 'always' };
  if (r === 'first_abroad') return { kind: 'first_abroad' };
  let m = /^(visits|hotels)>=(\d+)$/.exec(r);
  if (m) return { kind: m[1] as 'visits' | 'hotels', n: Number(m[2]) };
  m = /^date>=(\d{4}-\d{2}-\d{2})$/.exec(r);
  if (m) return { kind: 'date', date: m[1] };
  return { kind: 'invalid', raw: raw ?? '' };
}

/** Is `letter` readable now? `today` is YYYY-MM-DD (use lib/dates today()). Invalid rules stay locked. */
export function isUnlocked(letter: Pick<Letter, 'unlock_rule'>, stats: UnlockStats, today: string): boolean {
  const rule = parseUnlockRule(letter.unlock_rule);
  switch (rule.kind) {
    case 'always':
      return true;
    case 'visits':
      return stats.visits >= rule.n;
    case 'hotels':
      return stats.hotels >= rule.n;
    case 'first_abroad':
      return stats.countriesAbroad >= 1;
    case 'date':
      return today >= rule.date;
    case 'invalid':
      return false;
  }
}

/** Human hint for a locked letter, e.g. "Opens at 25 hotels". */
export function unlockHint(rule: UnlockRule | string): string {
  const r = parseUnlockRule(rule);
  switch (r.kind) {
    case 'always':
      return 'Ready to read';
    case 'visits':
      return `Opens on our stay number ${r.n}`;
    case 'hotels':
      return `Opens at ${r.n} hotels`;
    case 'first_abroad':
      return 'Opens on our first stay abroad';
    case 'date': {
      const [y, m, d] = r.date.split('-').map(Number);
      const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
      return `Opens on ${d} ${mon} ${y}`;
    }
    case 'invalid':
      return 'Sealed for now';
  }
}
