/** Haptics: Android `navigator.vibrate`; silently a no-op elsewhere (iOS Safari has no API). */
import { prefersReducedMotion } from './motion';

export type HapticKind = 'tap' | 'success' | 'milestone' | 'chapter';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 10,
  success: [12, 40, 18],
  milestone: [20, 60, 20, 60, 40],
  chapter: 8,
};

export function haptic(kind: HapticKind = 'tap'): boolean {
  if (prefersReducedMotion() && kind !== 'success') return false;
  const nav = globalThis.navigator as Navigator | undefined;
  if (!nav || typeof nav.vibrate !== 'function') return false;
  try {
    return nav.vibrate(PATTERNS[kind]);
  } catch {
    return false;
  }
}
