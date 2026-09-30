/**
 * House motion language (SPEC §14). Use these constants with Motion (`motion/react`), e.g.
 * `<motion.div transition={SPRING_UI} />`, and `useReducedMotion()` for every animation.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { getDevice, onDeviceChange } from '@/data/device';

/** Default UI: position, size, opacity. */
export const SPRING_UI = { type: 'spring', bounce: 0, duration: 0.38 } as const;
/** Things the user flicked or threw. */
export const SPRING_THROW = { type: 'spring', bounce: 0.2, duration: 0.4 } as const;
/** Bottom sheets (pass the drag velocity as `velocity`). */
export const SPRING_SHEET = { type: 'spring', bounce: 0.15, duration: 0.3 } as const;
/** Instant, used when reduced motion is on. */
export const INSTANT = { duration: 0 } as const;
/** Press feedback on pointer-down. */
export const PRESS_SCALE = 0.97;

const QUERY = '(prefers-reduced-motion: reduce)';

function osPrefersReduced(): boolean {
  return typeof matchMedia === 'function' && matchMedia(QUERY).matches;
}

/** Non-hook check (for imperative animation code). Settings override wins over the OS. */
export function prefersReducedMotion(): boolean {
  const override = getDevice('reducedMotion');
  return override ?? osPrefersReduced();
}

function subscribe(cb: () => void): () => void {
  const mq = typeof matchMedia === 'function' ? matchMedia(QUERY) : null;
  mq?.addEventListener('change', cb);
  const off = onDeviceChange((k) => k === 'reducedMotion' && cb());
  return () => {
    mq?.removeEventListener('change', cb);
    off();
  };
}

/** True when motion should be reduced (OS setting or Settings override). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}

/** Mirrors the override onto <html data-reduced-motion> so global CSS can honour it. Mount once. */
export function useReducedMotionAttribute(): void {
  const reduced = useReducedMotion();
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
  }, [reduced]);
}

/** Picks the reduced alternative when motion is reduced. */
export function motionSafe<T>(reduced: boolean, full: T, fallback: T): T {
  return reduced ? fallback : full;
}
