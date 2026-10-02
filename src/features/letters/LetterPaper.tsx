/**
 * The letter itself: brand type, generous leading, revealed gently line by line. Each
 * paragraph is unveiled by a soft mask that sweeps down one visual line at a time, so the
 * text is in the DOM (and read by screen readers) from the start. Tap to show it all.
 */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { COUPLE, personName } from '@/config/couple';
import { Avatar } from '@/components/brand/Avatar';
import type { Letter } from '@/data/types';
import { IconHeart } from '@/components/icons';
import { blockText, parseLetter, renderBlock } from './markdown';
import { writtenMonth } from './access';
import s from './Letters.module.css';

/** ms per visual line of the reveal. */
const LINE_MS = 380;
const GAP_MS = 180;

export interface LetterPaperProps {
  letter: Letter;
  /** Start the line-by-line reveal (false keeps the text hidden, ready to reveal). */
  reveal: boolean;
  /** Skip the choreography (reduced motion, or a re-read). */
  instant?: boolean;
  titleId?: string;
  onRevealed?(): void;
}

export function LetterPaper({ letter, reveal, instant = false, titleId, onRevealed }: LetterPaperProps) {
  const blocks = useMemo(() => parseLetter(letter.body_md), [letter.body_md]);
  const author = personName(letter.from);
  // The signature is part of the text when the last paragraph is just the author's name.
  const signed = blocks.length > 1 && blockText(blocks[blocks.length - 1]).trim().replace(/[.,!]$/, '') === author;
  const body = signed ? blocks.slice(0, -1) : blocks;
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [timing, setTiming] = useState<{ delay: number; dur: number }[] | null>(null);
  const [done, setDone] = useState(instant);
  const onRevealedRef = useRef(onRevealed);
  useLayoutEffect(() => {
    onRevealedRef.current = onRevealed;
  });

  // Measure each paragraph's line count, then chain the sweeps.
  useLayoutEffect(() => {
    if (!reveal || instant) return;
    let t = 350;
    const out = refs.current.slice(0, body.length + 2).map((el) => {
      const lh = el ? parseFloat(getComputedStyle(el).lineHeight) || 28 : 28;
      const lines = el ? Math.max(1, Math.round(el.getBoundingClientRect().height / lh)) : 1;
      const cur = { delay: t, dur: lines * LINE_MS };
      t += cur.dur + GAP_MS;
      return cur;
    });
    setTiming(out);
    const end = setTimeout(() => setDone(true), t);
    return () => clearTimeout(end);
  }, [reveal, instant, body.length]);

  useLayoutEffect(() => {
    if (done && reveal) onRevealedRef.current?.();
  }, [done, reveal]);

  const state = instant || done ? 'shown' : reveal && timing ? 'revealing' : 'hidden';
  const style = (i: number): CSSProperties | undefined =>
    state === 'revealing' && timing?.[i] ? ({ '--reveal-delay': `${timing[i].delay}ms`, '--reveal-dur': `${timing[i].dur}ms` } as CSSProperties) : undefined;
  const month = writtenMonth(letter.written_at);

  return (
    <div className={s.paper} data-reveal={state} onClick={() => state === 'revealing' && setDone(true)}>
      <p className={s.paperKicker}>
        <IconHeart size={14} aria-hidden="true" /> {letter.title}
      </p>
      <h2 id={titleId} className="sr-only">
        {letter.title}, from {author}
      </h2>
      <div className={s.letterBody}>
        {body.map((b, i) => (
          <p key={i} ref={(el) => void (refs.current[i] = el)} className={s.line} style={style(i)}>
            {renderBlock(b)}
          </p>
        ))}
      </div>
      <footer className={s.signoff}>
        <p ref={(el) => void (refs.current[body.length] = el)} className={`${s.line} ${s.signature} ${s.signatureRow}`} style={style(body.length)}>
          <Avatar person={letter.from} size={28} />
          {signed ? renderBlock(blocks[blocks.length - 1]) : author}
        </p>
        {month ? (
          <p ref={(el) => void (refs.current[body.length + 1] = el)} className={`${s.line} ${s.writtenIn}`} style={style(body.length + 1)}>
            Written in {COUPLE.defaultHomeBase.city}, {month}
          </p>
        ) : null}
      </footer>
    </div>
  );
}
