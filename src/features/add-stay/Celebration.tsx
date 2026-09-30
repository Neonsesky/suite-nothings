/**
 * Save celebration (SPEC §8.3, a signature moment): the key card slides into the lock, the light
 * goes green, the split-flap board ticks up, a pin drops on the mini map. ~2 s; a tap skips it.
 * Reduced motion gets the final frame with a calm crossfade.
 */
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SplitFlap } from '@/components/SplitFlap';
import { haptic } from '@/lib/haptics';
import { SPRING_THROW, useReducedMotion } from '@/lib/motion';
import { play } from '@/lib/sound';
import { MiniMap } from '@/map/MiniMap';
import s from './Celebration.module.css';

export interface CelebrationProps {
  /** Board value before and after, e.g. hotel count 27 → 28. */
  from: number;
  to: number;
  /** "hotels together" or "stays together". */
  unit: string;
  stayNumber: number;
  hotelName: string;
  lat: number;
  lng: number;
  onDone(): void;
}

const LINES = ['Checked in. Stay {n} is ours.', "Key's in the lock. Stay {n}, logged.", 'Another one for the board: {n}.'];
export const CELEBRATION_MS = 2100;
const REDUCED_MS = 1600;
/** Key reaches the lock. */
const LOCK_AT = 0.62;

export function Celebration({ from, to, unit, stayNumber, hotelName, lat, lng, onDone }: CelebrationProps) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<'slide' | 'locked' | 'leaving'>(reduced ? 'locked' : 'slide');
  const [board, setBoard] = useState(reduced ? to : from);
  const line = useMemo(() => LINES[stayNumber % LINES.length].replace('{n}', String(stayNumber)), [stayNumber]);
  const done = useRef(false);

  const leave = () => {
    if (done.current) return;
    done.current = true;
    setPhase('leaving');
    setTimeout(onDone, reduced ? 150 : 220);
  };

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!reduced) {
      timers.push(
        setTimeout(() => {
          setPhase('locked');
          play('beep');
          haptic('success');
        }, LOCK_AT * 1000),
        setTimeout(() => setBoard(to), LOCK_AT * 1000 + 80),
      );
    } else haptic('success');
    timers.push(setTimeout(leave, reduced ? REDUCED_MS : CELEBRATION_MS));
    return () => timers.forEach(clearTimeout);
    // Runs once per celebration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locked = phase !== 'slide';
  return createPortal(
    <motion.div
      className={s.root}
      role="status"
      aria-live="polite"
      aria-label={line}
      data-testid="celebration"
      data-phase={phase}
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === 'leaving' ? 0 : 1 }}
      transition={{ duration: reduced ? 0.15 : 0.2, ease: 'easeOut' }}
      onPointerDown={leave}
    >
      <div className={s.lock} aria-hidden="true">
        <div className={s.door}>
          <span className={s.slot} />
          <span className={s.light} data-on={locked} />
        </div>
        <motion.div
          className={s.card}
          initial={reduced ? false : { x: '-7.5rem', rotate: -8, opacity: 0 }}
          animate={{ x: 0, rotate: 0, opacity: 1 }}
          transition={reduced ? { duration: 0 } : { ...SPRING_THROW, delay: 0.12 }}
        >
          <span className={s.cardStripe} />
          <span className={s.cardChip} />
        </motion.div>
      </div>
      <div className={s.board}>
        <SplitFlap value={board} ariaLabel={`${to} ${unit}`} length={Math.max(2, String(to).length)} size="xl" sound={!reduced} />
        <span className={s.unit}>{unit}</span>
      </div>
      <div className={s.map}>{locked ? <MiniMap lat={lat} lng={lng} zoom={13} dropPin={!reduced} label={hotelName} /> : null}</div>
      <p className={s.line}>{line}</p>
      <p className={s.skip}>Tap to skip</p>
    </motion.div>,
    document.body,
  );
}
