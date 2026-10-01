/**
 * The milestone unlock (SPEC §12, §14 signature moment): an ink-outlined ginger stamp slams onto
 * a cream panel, an ink ring spreads behind it and honey/ginger specks burst out. Several
 * milestones queue one after another. Reduced motion: a calm fade, no specks, no haptic.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { haptic } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/motion';
import { play } from '@/lib/sound';
import { milestoneDef, type Milestone, type MilestoneOptions } from './engine';
import s from './MilestoneUnlock.module.css';

/** When the stamp lands, as a share of the slam keyframes (ms). Matches the CSS. */
export const SLAM_MS = 300;
/** Auto-advance to the next stamp in a queue. */
export const ADVANCE_MS = 2600;

const SPECKS = 24;

/** Deterministic burst so every unlock looks equally composed. */
const specks = Array.from({ length: SPECKS }, (_, i) => {
  const angle = (i / SPECKS) * Math.PI * 2 + (i % 3) * 0.17;
  const dist = 96 + ((i * 37) % 70);
  return {
    dx: Math.round(Math.cos(angle) * dist),
    dy: Math.round(Math.sin(angle) * dist * 0.85),
    fall: 24 + ((i * 13) % 30),
    rot: ((i * 71) % 360) - 180,
    delay: (i % 4) * 18,
    tone: i % 3 === 0 ? 'ginger' : i % 3 === 1 ? 'honey' : 'honeyDeep',
    shape: i % 4 === 0 ? 'round' : 'strip',
  };
});

export interface MilestoneUnlockProps {
  queue: readonly Milestone[];
  opts?: MilestoneOptions;
  onDone: () => void;
}

export function MilestoneUnlock({ queue, opts, onDone }: MilestoneUnlockProps) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const m = queue[index];
  const last = index >= queue.length - 1;

  const advance = useCallback(() => {
    if (last) onDone();
    else setIndex((i) => i + 1);
  }, [last, onDone]);

  useEffect(() => {
    button.current?.focus({ preventScroll: true });
    const t = window.setTimeout(() => {
      if (!reduced) haptic('milestone');
      play('stamp');
    }, reduced ? 0 : SLAM_MS);
    const next = last ? 0 : window.setTimeout(advance, ADVANCE_MS);
    return () => {
      window.clearTimeout(t);
      if (next) window.clearTimeout(next);
    };
  }, [index, reduced, last, advance]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDone();
      } else if (e.key === 'Tab') {
        // The continue button is the only control: keep focus inside the dialog.
        e.preventDefault();
        button.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDone]);

  if (!m) return null;
  const def = milestoneDef(m.id, opts);

  return (
    <div
      className={[s.root, reduced ? s.reduced : ''].join(' ')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-unlock-title"
      aria-describedby="milestone-unlock-caption"
      data-testid="milestone-unlock"
      data-milestone-id={m.id}
      data-reduced={reduced || undefined}
      onClick={advance}
    >
      <div className={s.backdrop} aria-hidden="true" />
      <div className={s.panel} key={`${m.id}-${index}`}>
        <div className={s.stage} aria-hidden="true">
          <span className={s.blot} />
          <span className={s.ring} />
          {reduced
            ? null
            : specks.map((p, i) => (
                <span
                  key={i}
                  className={[s.speck, s[p.tone], s[p.shape]].join(' ')}
                  style={{
                    ['--dx' as string]: `${p.dx}px`,
                    ['--dy' as string]: `${p.dy}px`,
                    ['--fall' as string]: `${p.fall}px`,
                    ['--rot' as string]: `${p.rot}deg`,
                    animationDelay: `${SLAM_MS - 20 + p.delay}ms`,
                  }}
                />
              ))}
          <span className={s.stamp}>
            <span className={s.stampRing} />
            <span className={s.short}>{def.short}</span>
            <span className={s.small}>{def.caption}</span>
          </span>
        </div>
        <p className={s.eyebrow}>{queue.length > 1 ? `New stamp · ${index + 1} of ${queue.length}` : 'New stamp'}</p>
        <h2 id="milestone-unlock-title" className={s.title} aria-live="polite">
          {m.title}
        </h2>
        <p id="milestone-unlock-caption" className={s.caption}>
          {m.caption}
        </p>
        <Button
          ref={button}
          variant="celebrate"
          className={s.cta}
          data-testid="milestone-continue"
          onClick={(e) => {
            e.stopPropagation();
            advance();
          }}
        >
          {last ? 'Keep going' : 'Next stamp'}
        </Button>
      </div>
    </div>
  );
}
