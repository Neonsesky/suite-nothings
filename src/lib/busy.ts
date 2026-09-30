/**
 * Busy registry. Forms register while open so the "fresh version is ready" update flow never
 * reloads the page under someone's fingers.
 */
import { useEffect } from 'react';

const keys = new Map<string, number>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Mark `key` busy; returns a release function (safe to call twice). */
export function markBusy(key: string): () => void {
  keys.set(key, (keys.get(key) ?? 0) + 1);
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const n = (keys.get(key) ?? 1) - 1;
    if (n <= 0) keys.delete(key);
    else keys.set(key, n);
    emit();
  };
}

export function isBusy(): boolean {
  return keys.size > 0;
}

/** Subscribe to busy changes (e.g. to reload once forms close). */
export function onBusyChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Hook: while `active`, `key` is busy. */
export function useMarkBusy(active: boolean, key: string): void {
  useEffect(() => {
    if (!active) return;
    return markBusy(key);
  }, [active, key]);
}
