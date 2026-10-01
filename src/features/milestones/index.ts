/**
 * Milestones public API: the rules (engine.ts), what's been awarded (awarded.ts), and the stamp
 * unlock moment. The overlay mounts into its own React root on <body>, so no shell changes.
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getState } from '@/data/store';
import type { Stay } from '@/data/types';
import { recordAwarded } from './awarded';
import { checkMilestones as check, type Milestone, type MilestoneOptions } from './engine';
import { flushLetterToast, setLetterToastGate } from './letters';
import { MilestoneUnlock } from './MilestoneUnlock';

export {
  allMilestones,
  milestoneDef,
  milestoneDefs,
  milestoneToast,
  MILESTONE_DEFS,
  MILESTONE_IDS,
  OUTSIDE_HOME_KM,
} from './engine';
export type { Milestone, MilestoneDef, MilestoneIcon, MilestoneId, MilestoneOptions } from './engine';
export { AWARDED_META_KEY, backfillMilestones, getAwarded, recordAwarded, useAwardedMilestones, useMilestoneState } from './awarded';
export type { AwardedMilestone, MilestoneState } from './awarded';
export { NEW_LETTER_COPY, newlyUnlockedLetters, notifyNewLetters } from './letters';

/** `checkMilestones` from the engine, defaulting `home` to the current Settings home base. */
export function checkMilestones(stays: readonly Stay[], prev: readonly Pick<Milestone, 'id'>[], opts: MilestoneOptions = {}): Milestone[] {
  return check(stays, prev, { home: opts.home ?? getState().settings.home_base });
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let queue: Milestone[] = [];
let pending = 0;
let showing = false;
let session = 0;

setLetterToastGate(() => showing || pending > 0);

function render() {
  if (!root) return;
  if (!queue.length) {
    root.render(null);
    showing = false;
    flushLetterToast();
    return;
  }
  showing = true;
  root.render(
    createElement(MilestoneUnlock, {
      key: session,
      queue,
      opts: { home: getState().settings.home_base },
      onDone: close,
    }),
  );
}

let restoreFocus: HTMLElement | null = null;

function close() {
  queue = [];
  render();
  if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
  restoreFocus = null;
}

function mount() {
  if (root) return;
  host = document.createElement('div');
  host.dataset.milestoneHost = '';
  document.body.appendChild(host);
  root = createRoot(host);
}

/**
 * Show the unlock moment for newly reached milestones, one after another. Ids already awarded
 * on this device are skipped (never celebrated twice); the rest are recorded as awarded.
 */
export function showMilestoneUnlock(milestones: readonly Milestone[]): void {
  if (!milestones.length || typeof document === 'undefined') return;
  pending++;
  void recordAwarded(milestones)
    .catch(() => [] as Milestone[])
    .then((fresh) => {
      pending--;
      if (!fresh.length) {
        if (!showing) flushLetterToast();
        return;
      }
      mount();
      if (!showing) session++;
      if (!showing) restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      queue = showing ? [...queue, ...fresh.filter((m) => !queue.some((q) => q.id === m.id))] : [...fresh];
      render();
    });
}
