/** Home-screen FAQ facts (SPEC §3.3). Pure — derives copy from `Stay[]` and stats helpers. */
import { otherPerson, personName } from '@/config/couple';
import type { HomeBase, Stay, Units } from '@/data/types';
import { formatDate } from '@/lib/dates';
import { kmToMiles } from '@/lib/geo';
import { farthestFromHome, firstStay, hoursTogether, mostRevisited, whosePicksRateHigher } from '@/lib/stats';

export type FaqId = 'firstStay' | 'regular' | 'farthest' | 'longest' | 'picks' | 'hours';

export interface FaqItem {
  id: FaqId;
  question: string;
  answer: string;
  empty: boolean;
}

const live = (stays: readonly Stay[]) => stays.filter((s) => !s.visit.deleted && !s.hotel.deleted);

/** Longest stay by nights (ties → most recent). Distinct from `lib/stats#longestStay`, which ranks by hours. */
function longestByNights(stays: readonly Stay[]): Stay | null {
  let best: Stay | null = null;
  for (const s of live(stays)) {
    if (!best || s.visit.nights > best.visit.nights || (s.visit.nights === best.visit.nights && s.visit.date > best.visit.date)) {
      best = s;
    }
  }
  return best;
}

function buildFirstStay(stays: readonly Stay[]): FaqItem {
  const question = 'Where was our first stay?';
  const first = firstStay(stays);
  if (!first) {
    return { id: 'firstStay', question, answer: "Add our first stay and we'll remember it here.", empty: true };
  }
  return {
    id: 'firstStay',
    question,
    answer: `${first.hotel.name} in ${first.hotel.city}, on ${formatDate(first.visit.date)}.`,
    empty: false,
  };
}

function buildRegular(stays: readonly Stay[]): FaqItem {
  const question = 'Which hotel do we keep going back to?';
  const regular = mostRevisited(stays);
  if (!regular) {
    return { id: 'regular', question, answer: 'No regulars yet, one hotel just needs a second visit.', empty: true };
  }
  return { id: 'regular', question, answer: `${regular.name}, ${regular.visits} times and counting.`, empty: false };
}

function buildFarthest(stays: readonly Stay[], home: { lat: number; lng: number }, units: Units): FaqItem {
  const question = "What's the farthest we've been from home?";
  const farthest = farthestFromHome(stays, home);
  if (!farthest || farthest.km < 1) {
    return { id: 'farthest', question, answer: 'Still close to home base, so far.', empty: true };
  }
  const v = units === 'mi' ? kmToMiles(farthest.km) : farthest.km;
  const rounded = Math.round(v).toLocaleString('en-GB');
  return {
    id: 'farthest',
    question,
    answer: `${farthest.stay.hotel.name} in ${farthest.stay.hotel.city}, ${rounded} ${units} from home.`,
    empty: false,
  };
}

function buildLongest(stays: readonly Stay[]): FaqItem {
  const question = 'What was our longest stay?';
  const longest = longestByNights(stays);
  if (!longest || longest.visit.nights <= 0) {
    return { id: 'longest', question, answer: 'No overnight stays yet.', empty: true };
  }
  const { nights } = longest.visit;
  const answer = nights === 1 ? `1 night at ${longest.hotel.name}.` : `${nights} nights at ${longest.hotel.name}.`;
  return { id: 'longest', question, answer, empty: false };
}

function buildPicks(stays: readonly Stay[]): FaqItem {
  const question = 'Whose picks rate higher?';
  const score = whosePicksRateHigher(stays);
  if (score.nirsh.average == null || score.shady.average == null) {
    return { id: 'picks', question, answer: "Rate a few stays and we'll keep score.", empty: true };
  }
  if (score.winner == null) {
    return { id: 'picks', question, answer: 'Dead even. You both pick well.', empty: false };
  }
  const leader = score.winner === 'nirsh' ? score.nirsh : score.shady;
  const other = score.winner === 'nirsh' ? score.shady : score.nirsh;
  const answer = `${personName(score.winner)}'s picks average ${leader.average!.toFixed(1)}, ${personName(otherPerson(score.winner))}'s average ${other.average!.toFixed(1)}.`;
  return { id: 'picks', question, answer, empty: false };
}

function buildHours(stays: readonly Stay[]): FaqItem {
  const question = 'How many hours have we spent in hotels together?';
  const hours = Math.round(hoursTogether(stays));
  if (hours <= 0) {
    return { id: 'hours', question, answer: 'Add check-in and check-out times to start the clock.', empty: true };
  }
  return { id: 'hours', question, answer: `${hours.toLocaleString('en-GB')} hours, and counting.`, empty: false };
}

export function buildFaq(stays: readonly Stay[], home: Pick<HomeBase, 'lat' | 'lng'>, units: Units = 'km'): FaqItem[] {
  return [buildFirstStay(stays), buildRegular(stays), buildFarthest(stays, home, units), buildLongest(stays), buildPicks(stays), buildHours(stays)];
}
