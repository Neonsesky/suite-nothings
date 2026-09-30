/**
 * A tiny, safe markdown subset for letters: paragraphs (blank-line separated), single line
 * breaks, *emphasis* / _emphasis_ and **strong**. It builds React nodes, never HTML strings,
 * so nothing in a letter can inject markup. The text itself is never altered.
 */
import { Fragment, type ReactNode } from 'react';

export type Inline = { kind: 'text' | 'em' | 'strong'; text: string };
/** One paragraph: its lines (single newlines inside a paragraph are kept as line breaks). */
export type Block = Inline[][];

const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;

export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of line.matchAll(INLINE)) {
    const tok = m[0];
    const at = m.index ?? 0;
    // `snake_case_words` are not emphasis: the underscore must sit at a word boundary.
    if (tok.startsWith('_') && ((at > 0 && /\w/.test(line[at - 1])) || /\w/.test(line[at + tok.length] ?? ''))) continue;
    if (at > last) out.push({ kind: 'text', text: line.slice(last, at) });
    const strong = tok.startsWith('**') || tok.startsWith('__');
    out.push({ kind: strong ? 'strong' : 'em', text: tok.slice(strong ? 2 : 1, strong ? -2 : -1) });
    last = at + tok.length;
  }
  if (last < line.length) out.push({ kind: 'text', text: line.slice(last) });
  return out;
}

export function parseLetter(md: string): Block[] {
  return md
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((p) => p.replace(/^\n+|\n+$/g, ''))
    .filter((p) => p.trim() !== '')
    .map((p) => p.split('\n').map(parseInline));
}

/** Plain text of a block (for signature detection and aria). */
export function blockText(block: Block): string {
  return block.map((line) => line.map((i) => i.text).join('')).join('\n');
}

export function renderInline(line: Inline[]): ReactNode {
  return line.map((i, k) =>
    i.kind === 'em' ? <em key={k}>{i.text}</em> : i.kind === 'strong' ? <strong key={k}>{i.text}</strong> : <Fragment key={k}>{i.text}</Fragment>,
  );
}

export function renderBlock(block: Block): ReactNode {
  return block.map((line, k) => (
    <Fragment key={k}>
      {k > 0 ? <br /> : null}
      {renderInline(line)}
    </Fragment>
  ));
}
