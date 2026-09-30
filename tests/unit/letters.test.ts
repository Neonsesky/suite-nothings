import { describe, expect, it } from 'vitest';
import { blockText, parseInline, parseLetter } from '@/features/letters/markdown';
import { viewLetters, writtenMonth } from '@/features/letters/access';
import { buildRule } from '@/features/letters/WriteNoteSheet';
import type { Letter } from '@/data/types';

describe('letter markdown', () => {
  it('splits paragraphs on blank lines and keeps single line breaks', () => {
    const blocks = parseLetter('Hello there,\n\nFirst line\nsecond line\n\n\n\nBye\n');
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toHaveLength(2);
    expect(blockText(blocks[1])).toBe('First line\nsecond line');
  });
  it('parses emphasis and strong without touching the text', () => {
    expect(parseInline('a *soft* and **bold** end')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'em', text: 'soft' },
      { kind: 'text', text: ' and ' },
      { kind: 'strong', text: 'bold' },
      { kind: 'text', text: ' end' },
    ]);
    expect(parseInline('snake_case_word stays')).toEqual([{ kind: 'text', text: 'snake_case_word stays' }]);
  });
  it('treats HTML as plain text', () => {
    const [[line]] = parseLetter('<img src=x onerror=alert(1)>');
    expect(line).toEqual([{ kind: 'text', text: '<img src=x onerror=alert(1)>' }]);
  });
  it('round-trips the text exactly (minus markers)', () => {
    const md = 'One, two.\n\nThree — four!\nFive';
    expect(parseLetter(md).map(blockText).join('\n\n')).toBe(md);
  });
});

describe('letter access', () => {
  const base: Letter = { letter_id: 'L1', title: 't', body_md: 'b', from: 'nirsh', to: 'shady', unlock_rule: 'always', written_at: '2026-09-30', read_at: null, created_at: '2026-09-30T00:00:00Z', updated_at: '2026-09-30T00:00:00Z' };
  const stats = { visits: 12, hotels: 11, countriesAbroad: 2 };
  it('shows the reader unlocked letters and the author everything', () => {
    const locked = { ...base, letter_id: 'L2', unlock_rule: 'hotels>=25' as const };
    const forShady = viewLetters([base, locked], 'shady', stats, '2026-10-01');
    expect(forShady.map((v) => [v.letter.letter_id, v.unlocked, v.mine])).toEqual([['L1', true, false], ['L2', false, false]]);
    const forNirsh = viewLetters([base, locked], 'nirsh', stats, '2026-10-01');
    expect(forNirsh.every((v) => v.mine)).toBe(true);
  });
  it('formats the written-in month', () => {
    expect(writtenMonth('2026-09-30')).toBe('September 2026');
    expect(writtenMonth('2026-06-19T23:46:00+04:00')).toBe('June 2026');
    expect(writtenMonth('')).toBe('');
  });
  it('builds unlock rules', () => {
    expect(buildRule('hotels', 25, '')).toBe('hotels>=25');
    expect(buildRule('visits', 3, '')).toBe('visits>=3');
    expect(buildRule('date', 0, '2027-06-19')).toBe('date>=2027-06-19');
    expect(buildRule('first_abroad', 0, '')).toBe('first_abroad');
  });
});
