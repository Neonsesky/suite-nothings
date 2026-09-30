/**
 * Card → detail shared-element transition (SPEC §14). Uses the View Transitions API where the
 * browser has it; elsewhere the navigation just happens and the detail header fades in.
 * The card photo and the detail header carry the same `view-transition-name`, and only one of
 * them is ever mounted, so the browser morphs one into the other (and back on "Back").
 */
import { goBack, navigate } from '@/app/router';
import { prefersReducedMotion } from '@/lib/motion';

export function photoTransitionName(visitId: string): string {
  return `stay-photo-${visitId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

type Doc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> } };

export function canViewTransition(): boolean {
  return typeof document !== 'undefined' && typeof (document as Doc).startViewTransition === 'function' && !prefersReducedMotion();
}

/** Resolves once `selector` is in the DOM (the lazily loaded route has rendered), or after `ms`. */
function waitFor(selector: string, ms = 900): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      if (document.querySelector(selector) || performance.now() - start > ms) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function run(update: () => void, selector: string): void {
  if (!canViewTransition()) return update();
  (document as Doc).startViewTransition!(() => {
    update();
    return waitFor(selector);
  });
}

/** Opens a stay from a card with the shared-element transition. */
export function openStay(visitId: string): void {
  run(() => navigate(`/stay/${visitId}`), `[data-stay-header="${visitId}"]`);
}

/** Leaves the detail back to wherever we came from, morphing the header back into the card. */
export function closeStay(visitId: string): void {
  run(() => goBack('/'), `[data-visit-id="${visitId}"]`);
}
