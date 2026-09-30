/**
 * Milestone engine. Later wave implements the rules (SPEC §12); the signature is the contract.
 */
import type { Stay } from '@/data/types';

export type MilestoneId =
  | 'first-stay'
  | 'hotels-5'
  | 'hotels-10'
  | 'hotels-25'
  | 'hotels-50'
  | 'hotels-100'
  | 'first-outside-home-city'
  | 'first-abroad'
  | 'three-in-a-month'
  | 'anniversary-stay'
  | 'five-star'
  | 'our-regular';

export interface Milestone {
  id: MilestoneId;
  title: string; // e.g. "5 hotels"
  caption: string; // e.g. "Five keys on the ring"
  /** Visit that unlocked it. */
  visitId: string | null;
  /** YYYY-MM-DD */
  achievedOn: string;
}

/** Milestones newly reached by `stays` that are not already in `prev`. Stub returns []. */
export function checkMilestones(_stays: readonly Stay[], _prev: readonly Milestone[]): Milestone[] {
  return [];
}
