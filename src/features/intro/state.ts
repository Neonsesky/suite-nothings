/** Whether the intro is on screen, so other first-launch moments (the pillow note) wait. */
import { useSyncExternalStore } from 'react';

let active = false;
const listeners = new Set<() => void>();

export function setIntroActive(v: boolean): void {
  if (active === v) return;
  active = v;
  listeners.forEach((l) => l());
}
export function isIntroActive(): boolean {
  return active;
}
export function useIntroActive(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => active,
    () => false,
  );
}
