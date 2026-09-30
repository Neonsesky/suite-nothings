import { useSyncExternalStore } from 'react';

/** Reactive `matchMedia`. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof matchMedia !== 'function') return () => undefined;
      const mq = matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => (typeof matchMedia === 'function' ? matchMedia(query).matches : false),
    () => false,
  );
}

/** Desktop layout breakpoint (64rem = 1024px). */
export const DESKTOP_QUERY = '(min-width: 64rem)';
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
