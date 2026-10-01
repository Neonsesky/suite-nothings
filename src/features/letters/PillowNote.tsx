/**
 * "A note on your pillow" (SPEC §13). Like turndown service: the first time the letter's
 * reader opens the app on this device, a pillow card with a small chocolate slides in over
 * the home screen. Tapping it lifts and flips the card in 3D, and the letter reveals line by
 * line. Reduced motion gets a calm crossfade.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { IconClose } from '@/components/icons';
import { personName } from '@/config/couple';
import { getDevice, setDevice } from '@/data/device';
import { markLetterRead } from '@/data/store';
import type { Letter } from '@/data/types';
import { useMarkBusy } from '@/lib/busy';
import { SPRING_UI, useReducedMotion } from '@/lib/motion';
import { play } from '@/lib/sound';
import { LetterPaper } from './LetterPaper';
import s from './Letters.module.css';

type Phase = 'arrive' | 'lift' | 'open';

function sizes() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    card: { width: Math.min(w * 0.72, 300), height: Math.min(w * 0.72, 300) * 0.62 },
    letter: { width: Math.min(w - 24, 580), height: Math.min(h - 32, 820) },
  };
}

export function markPillowShown(letterId: string): void {
  const shown = getDevice('pillowShown');
  if (!shown.includes(letterId)) setDevice('pillowShown', [...shown, letterId]);
}

export function PillowNote({ letter, onClose }: { letter: Letter; onClose(): void }) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('arrive');
  const [dims, setDims] = useState(sizes);
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  useMarkBusy(true, 'pillow-note');

  useEffect(() => {
    const onResize = () => setDims(sizes());
    window.addEventListener('resize', onResize);
    cardRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const open = () => {
    if (phase !== 'arrive') return;
    markPillowShown(letter.letter_id);
    void markLetterRead(letter.letter_id);
    play('whoosh');
    if (reduced) return setPhase('open');
    setPhase('lift');
    setTimeout(() => setPhase('open'), 420);
  };
  const close = () => {
    markPillowShown(letter.letter_id);
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const opened = phase === 'open';
  const box = opened ? dims.letter : dims.card;
  const flip = { type: 'spring', bounce: 0.12, duration: 1.1 } as const;

  return (
    <motion.div
      className={s.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.15 : 0.3 }}
      data-phase={phase}
    >
      <div className={s.roomScene} aria-hidden="true">
        <RoomArt />
      </div>
      <div className={s.scrim} onClick={opened ? close : undefined} />
      <button type="button" className={s.overlayClose} onClick={close} aria-label={opened ? 'Close the note' : 'Save it for later'}>
        <IconClose size={20} />
      </button>

      <motion.div
        className={s.stage}
        initial={reduced ? { opacity: 0 } : { y: '70vh' }}
        animate={reduced ? { opacity: 1 } : { y: 0 }}
        transition={reduced ? { duration: 0.15 } : { type: 'spring', bounce: 0.18, duration: 0.9, delay: 0.15 }}
      >
        <AnimatePresence>
          {!opened ? (
            <motion.div
              key="pillow"
              className={s.pillow}
              aria-hidden="true"
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 60, scale: 0.94 }}
              transition={{ duration: reduced ? 0.15 : 0.45 }}
            >
              <PillowArt />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div
          ref={cardRef}
          className={s.card3d}
          role={opened ? undefined : 'button'}
          tabIndex={opened ? -1 : 0}
          aria-label={opened ? undefined : `A note on your pillow from ${personName(letter.from)}. Tap to open`}
          onClick={open}
          onKeyDown={(e) => {
            if (!opened && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              open();
            }
          }}
          initial={false}
          animate={
            reduced
              ? { width: box.width, height: box.height, rotateY: 0, y: 0 }
              : {
                  width: box.width,
                  height: box.height,
                  rotateY: opened ? 180 : 0,
                  y: phase === 'arrive' ? 0 : phase === 'lift' ? -56 : 0,
                  rotateZ: phase === 'arrive' ? -4 : 0,
                  scale: phase === 'lift' ? 1.06 : 1,
                }
          }
          transition={reduced ? { duration: 0 } : phase === 'lift' ? SPRING_UI : flip}
        >
          <div className={s.cardFront} aria-hidden={opened}>
            <span className={s.cardKicker}>Turndown service</span>
            <span className={s.cardTitle}>A note on your pillow</span>
            <span className={s.cardFor}>For {personName(letter.to)}</span>
            <span className={s.cardCta}>Tap to open</span>
          </div>
          <div className={s.cardBack} aria-hidden={!opened}>
            {opened ? (
              <motion.div
                className={s.cardScroll}
                initial={reduced ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                <LetterPaper
                  letter={letter}
                  reveal
                  instant={reduced}
                  titleId={titleId}
                />
                <div className={s.paperActions}>
                  <Button variant="secondary" onClick={close}>
                    Close
                  </Button>
                  <a className={s.textLink} href="#/letters" onClick={() => markPillowShown(letter.letter_id)}>
                    It lives in Us → Letters
                  </a>
                </div>
              </motion.div>
            ) : (
              <span id={titleId} className="sr-only">
                A note on your pillow
              </span>
            )}
          </div>
        </motion.div>

        <AnimatePresence>
          {!opened ? (
            <motion.div
              key="choc"
              className={s.chocolate}
              aria-hidden="true"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -30, rotate: -30 }}
              animate={{ opacity: 1, y: 0, rotate: 14 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={reduced ? { duration: 0.15 } : { type: 'spring', bounce: 0.35, duration: 0.7, delay: 0.75 }}
            >
              <ChocolateArt />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function PillowArt() {
  return (
    <svg viewBox="0 0 360 220" width="100%" height="100%" className={s.pillowSvg}>
      <defs>
        <radialGradient id="pillow-plump" cx="50%" cy="38%" r="75%">
          <stop offset="0" stopColor="var(--color-paper)" />
          <stop offset="1" stopColor="var(--color-cream)" />
        </radialGradient>
      </defs>
      <path
        d="M34 44 C 20 34, 18 20, 34 16 C 120 34, 240 34, 326 16 C 342 20, 340 34, 326 44 C 338 90, 338 130, 326 176 C 340 186, 342 200, 326 204 C 240 186, 120 186, 34 204 C 18 200, 20 186, 34 176 C 22 130, 22 90, 34 44 Z"
        fill="url(#pillow-plump)"
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Corner gathers, like a plumped-up pillow pinched at the seams. */}
      <path d="M34 44 C 44 56, 46 86, 42 112 M326 44 C 316 56, 314 86, 318 112 M34 176 C 44 164, 46 134, 42 108 M326 176 C 316 164, 314 134, 318 108" fill="none" stroke="var(--color-ink)" strokeWidth="1.4" opacity="0.3" strokeLinecap="round" />
      {/* Quilting: a soft diamond grid of stitches. */}
      <g stroke="var(--color-line-strong)" strokeWidth="1.6" strokeDasharray="1.5 6" strokeLinecap="round" opacity="0.8">
        <path d="M70 32 L180 110 L290 32" fill="none" />
        <path d="M70 188 L180 110 L290 188" fill="none" />
        <path d="M48 56 C 130 70, 230 70, 312 56" fill="none" />
        <path d="M48 164 C 130 150, 230 150, 312 164" fill="none" />
      </g>
      {/* Button tufts at the quilting intersections. */}
      {[
        [70, 32], [290, 32], [70, 188], [290, 188], [180, 110],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.2" fill="var(--color-honey-soft)" stroke="var(--color-ink)" strokeWidth="1.2" opacity="0.85" />
      ))}
      <path d="M70 110 C 140 96, 220 96, 290 110" fill="none" stroke="var(--color-paper)" strokeWidth="26" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/** A dimmed hotel-room scene behind the turndown tableau: bed, headboard, a lit nightstand lamp. */
function RoomArt() {
  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className={s.roomSvg}>
      <rect x="-5" y="-5" width="410" height="310" fill="var(--color-honey-soft)" />
      <rect x="-5" y="190" width="410" height="120" fill="var(--color-cream)" />
      <rect x="40" y="30" width="320" height="170" rx="10" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="3" />
      <rect x="30" y="170" width="340" height="60" rx="14" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="3" />
      <rect x="54" y="150" width="90" height="34" rx="12" fill="var(--color-cream)" stroke="var(--color-ink)" strokeWidth="2.2" />
      <rect x="256" y="150" width="90" height="34" rx="12" fill="var(--color-cream)" stroke="var(--color-ink)" strokeWidth="2.2" />
      <rect x="4" y="150" width="26" height="80" rx="4" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="2.2" />
      <path d="M8 150 L22 150 L28 112 L2 112 Z" fill="var(--color-honey)" stroke="var(--color-ink)" strokeWidth="2" />
      <circle cx="15" cy="104" r="7" fill="var(--color-honey-soft)" opacity="0.9" />
    </svg>
  );
}

function ChocolateArt() {
  return (
    <svg viewBox="0 0 96 60" width="100%" height="100%">
      {/* Twisted foil ends, honey. */}
      <path d="M22 30 L4 14 L9 30 L4 46 Z M74 30 L92 14 L87 30 L92 46 Z" fill="var(--color-honey)" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M12 20 L18 30 L12 40 M84 20 L78 30 L84 40" fill="none" stroke="var(--color-ink)" strokeWidth="1.2" opacity="0.4" />
      {/* Ginger foil body with a sheen crease. */}
      <rect x="20" y="14" width="56" height="32" rx="8" fill="var(--color-ginger)" stroke="var(--color-ink)" strokeWidth="2.5" />
      <path d="M30 14 V46 M48 14 V46 M66 14 V46" stroke="var(--color-ink)" strokeWidth="1.5" opacity="0.3" />
      <path d="M26 18 L34 42" stroke="var(--color-paper)" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
      <path d="M48 36 C 40 30, 41 23, 45.5 23 C 47 23, 48 24.5, 48 25.5 C 48 24.5, 49 23, 50.5 23 C 55 23, 56 30, 48 36 Z" fill="var(--color-paper)" />
    </svg>
  );
}

