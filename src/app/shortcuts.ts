/** Desktop keyboard shortcuts: N new stay, M map, J journey, / search. */
import { useEffect } from 'react';
import { navigate } from './router';

/** Window event the Stays screen listens for to focus its search field. */
export const FOCUS_SEARCH_EVENT = 'sn:focus-search';

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

export function useShortcuts(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      switch (e.key) {
        case 'n':
        case 'N':
          navigate('/add');
          break;
        case 'm':
        case 'M':
          navigate('/map');
          break;
        case 'j':
        case 'J':
          navigate('/journey');
          break;
        case '/':
          e.preventDefault();
          if (!/^#?\/?$/.test(location.hash)) navigate('/');
          requestAnimationFrame(() => window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT)));
          break;
        default:
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
