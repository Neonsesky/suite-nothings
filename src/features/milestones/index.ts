/**
 * Milestones public API. A later wave adds the unlock animation; callers can already use it.
 */
import type { Milestone } from './engine';

export { checkMilestones } from './engine';
export type { Milestone, MilestoneId } from './engine';

/** Show the unlock moment for newly reached milestones. No-op until the unlock UI lands. */
export function showMilestoneUnlock(_milestones: readonly Milestone[]): void {}
