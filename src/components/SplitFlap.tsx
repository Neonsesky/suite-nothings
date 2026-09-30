/**
 * SplitFlap — airport-board text (SPEC §14). Per-character flaps with a top/bottom fold, a slight
 * random stagger and a soft click. Only characters that changed animate; each changed character
 * riffles through a few intermediate glyphs before landing. Reduced motion → instant change.
 * The accessible text is exposed once (flaps are aria-hidden).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from '@/lib/motion';
import { play } from '@/lib/sound';
import s from './SplitFlap.module.css';

export const FLAP_CHARSET_DEFAULT = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const FLAP_CHARSET_DIGITS = ' 0123456789';

export interface SplitFlapProps {
  value: string | number;
  /** Pad to this many cells (numbers pad left, strings pad right). */
  length?: number;
  /** Glyphs used for the riffle. */
  charset?: string;
  /** 'sm' | 'md' | 'lg' | 'xl', or a CSS font-size. Default 'md'. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | (string & {});
  /** Accessible text (e.g. "12 hotels together"). */
  ariaLabel: string;
  /** Flip in from blanks on first mount (e.g. journey opening date). */
  animateOnMount?: boolean;
  /** Intermediate glyphs per changed cell (default 3). */
  riffle?: number;
  sound?: boolean;
  /** Announce changes politely to screen readers. */
  live?: boolean;
  className?: string;
  /** Called when every cell has settled after a change. */
  onSettled?(): void;
}

/** Split a value into cells, padded to `length`. Exported for tests. */
export function toCells(value: string | number, length?: number): string[] {
  const str = String(value);
  const chars = Array.from(str);
  if (!length || chars.length >= length) return chars;
  const pad = Array.from({ length: length - chars.length }, () => ' ');
  return typeof value === 'number' ? [...pad, ...chars] : [...chars, ...pad];
}

const STEP_MS = 70; // one intermediate flip
const LAND_MS = 200; // final flip (two halves)

interface CellProps {
  char: string;
  delay: number;
  reduced: boolean;
  charset: string;
  riffle: number;
  sound: boolean;
  onSettled(): void;
  initial: string;
}

function FlapCell({ char, delay, reduced, charset, riffle, sound, onSettled, initial }: CellProps) {
  const [shown, setShown] = useState(initial);
  const [prev, setPrev] = useState(initial);
  const [flip, setFlip] = useState<{ k: number; dur: number } | null>(null);
  const shownRef = useRef(initial);
  const settledCb = useRef(onSettled);
  useEffect(() => {
    settledCb.current = onSettled;
  });

  useEffect(() => {
    if (char === shownRef.current) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (reduced) {
      timers.push(
        setTimeout(() => {
          shownRef.current = char;
          setPrev(char);
          setShown(char);
          setFlip(null);
          settledCb.current();
        }, 0),
      );
      return () => timers.forEach(clearTimeout);
    }
    const seq: string[] = [];
    const pool = charset.replace(char, '').replace(shownRef.current, '');
    for (let i = 0; i < riffle && pool.length > 0; i++) seq.push(pool[Math.floor(Math.random() * pool.length)]);
    seq.push(char);
    let t = delay;
    seq.forEach((next, i) => {
      const last = i === seq.length - 1;
      const dur = last ? LAND_MS : STEP_MS;
      timers.push(
        setTimeout(() => {
          setPrev(shownRef.current);
          shownRef.current = next;
          setShown(next);
          setFlip((f) => ({ k: (f?.k ?? 0) + 1, dur }));
          if (sound) play('flap');
        }, t),
      );
      t += dur;
    });
    timers.push(
      setTimeout(() => {
        setFlip(null);
        setPrev(shownRef.current);
        settledCb.current();
      }, t + 10),
    );
    return () => timers.forEach(clearTimeout);
  }, [char, delay, reduced, charset, riffle, sound]);

  const glyph = (c: string) => (c === ' ' ? ' ' : c);
  const style = flip ? ({ '--flap-dur': `${flip.dur}ms` } as CSSProperties) : undefined;
  return (
    <span className={s.cell} style={style} data-flipping={flip ? 'true' : undefined}>
      <span className={`${s.half} ${s.top}`}>
        <span className={s.glyph}>{glyph(shown)}</span>
      </span>
      <span className={`${s.half} ${s.bottom}`}>
        <span className={s.glyph}>{glyph(flip ? prev : shown)}</span>
      </span>
      {flip ? (
        <>
          <span key={`t${flip.k}`} className={`${s.half} ${s.top} ${s.flapTop}`}>
            <span className={s.glyph}>{glyph(prev)}</span>
          </span>
          <span key={`b${flip.k}`} className={`${s.half} ${s.bottom} ${s.flapBottom}`}>
            <span className={s.glyph}>{glyph(shown)}</span>
          </span>
        </>
      ) : null}
      <span className={s.hinge} />
    </span>
  );
}

export function SplitFlap({
  value,
  length,
  charset = FLAP_CHARSET_DEFAULT,
  size = 'md',
  ariaLabel,
  animateOnMount = false,
  riffle = 3,
  sound = true,
  live = false,
  className,
  onSettled,
}: SplitFlapProps) {
  const reduced = useReducedMotion();
  const cells = toCells(value, length);
  const [initialCells] = useState(() => (animateOnMount && !reduced ? cells.map(() => ' ') : cells));
  const [jitterSeed] = useState(() => Math.random() * 1000);
  const pending = useRef(0);
  const settledRef = useRef(onSettled);
  const prevCells = useRef(initialCells);
  const cellKey = cells.join('\u0000');
  useEffect(() => {
    settledRef.current = onSettled;
  });
  useEffect(() => {
    const next = cellKey.split('\u0000');
    pending.current = next.filter((c, i) => c !== prevCells.current[i]).length;
    prevCells.current = next;
  }, [cellKey]);
  // Slight, stable per-instance random stagger.
  const delayFor = (i: number) => {
    const x = Math.sin(jitterSeed + i * 12.9898) * 43758.5453;
    return i * 28 + Math.round((x - Math.floor(x)) * 45);
  };
  const sized = ['sm', 'md', 'lg', 'xl'].includes(size);
  return (
    <span
      className={[s.root, sized ? s[size] : '', className ?? ''].join(' ')}
      style={sized ? undefined : ({ fontSize: size } as CSSProperties)}
      data-value={String(value)}
    >
      <span className="sr-only" aria-live={live ? 'polite' : undefined}>
        {ariaLabel}
      </span>
      <span className={s.board} aria-hidden="true">
        {cells.map((c, i) => (
          <FlapCell
            key={i}
            char={c}
            initial={initialCells[i] ?? ' '}
            delay={delayFor(i)}
            reduced={reduced}
            charset={charset}
            riffle={riffle}
            sound={sound}
            onSettled={() => {
              pending.current = Math.max(0, pending.current - 1);
              if (pending.current === 0) settledRef.current?.();
            }}
          />
        ))}
      </span>
    </span>
  );
}
