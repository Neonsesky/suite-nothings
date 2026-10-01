/**
 * Awarded milestones, per namespace, in IndexedDB meta (`milestones.awarded`). A milestone is
 * recorded the moment its unlock is shown, so it's never celebrated twice (even if a stay is
 * deleted and the milestone reached again). On the first load of a namespace that already has
 * stays (e.g. the demo seed) everything already reached is recorded silently, without animation.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { buildStays } from '@/data/stays';
import { getState, readMeta, subscribe as subscribeStore, useSettings, whenReady, writeMeta } from '@/data/store';
import type { Stay } from '@/data/types';
import { today } from '@/lib/dates';
import { allMilestones, milestoneDefs, type Milestone, type MilestoneDef, type MilestoneId } from './engine';

export const AWARDED_META_KEY = 'milestones.awarded';

export interface AwardedMilestone extends Milestone {
  /** YYYY-MM-DD the unlock was shown (or, when backfilled, the day it was reached). */
  awardedAt: string;
  /** Recorded silently on first load rather than celebrated. */
  backfilled?: boolean;
}

type AwardedMap = ReadonlyMap<MilestoneId, AwardedMilestone>;

const EMPTY: AwardedMap = new Map();
let awarded: AwardedMap = EMPTY;
let loaded: Promise<void> | null = null;
let epoch = 0;
let watching = false;
let lastNs: string | null = null;
let lastReady = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Forget the cache when the store re-initialises (Demo ↔ Live, clear demo data). */
function watchStore() {
  if (watching) return;
  watching = true;
  const s = getState();
  lastNs = s.ns;
  lastReady = s.ready;
  subscribeStore(() => {
    const st = getState();
    if (st.ns !== lastNs || (lastReady && !st.ready)) {
      epoch++;
      loaded = null;
      awarded = EMPTY;
      emit();
    }
    const becameReady = !lastReady && st.ready;
    lastNs = st.ns;
    lastReady = st.ready;
    if (becameReady && listeners.size && !loaded) void backfillMilestones();
  });
}

function liveStays(): Stay[] {
  const s = getState();
  return buildStays([...s.visits.values()], s.hotels, [...s.photos.values()]);
}

function homeOpts() {
  return { home: getState().settings.home_base };
}

async function persist(map: AwardedMap): Promise<void> {
  await writeMeta(AWARDED_META_KEY, [...map.values()]);
}

/**
 * Load the awarded set for the current namespace; on first ever load, backfill silently.
 * `exclude` are milestones about to be celebrated, so the backfill doesn't swallow them.
 */
export function backfillMilestones(exclude: readonly MilestoneId[] = []): Promise<void> {
  watchStore();
  if (loaded) return loaded;
  const my = epoch;
  loaded = (async () => {
    await whenReady();
    if (my !== epoch) return;
    const stored = await readMeta<AwardedMilestone[]>(AWARDED_META_KEY);
    if (my !== epoch) return;
    if (stored) {
      awarded = new Map(stored.map((m) => [m.id, m]));
    } else {
      const skip = new Set(exclude);
      const back = allMilestones(liveStays(), homeOpts()).filter((m) => !skip.has(m.id));
      awarded = new Map(back.map((m) => [m.id, { ...m, awardedAt: m.achievedOn, backfilled: true }]));
      await persist(awarded);
    }
    emit();
  })();
  return loaded;
}

/** Ids already awarded (load first with `backfillMilestones`). */
export function getAwarded(): AwardedMap {
  return awarded;
}

/** Record milestones as awarded today. Returns the ones that weren't recorded before. */
export async function recordAwarded(ms: readonly Milestone[]): Promise<Milestone[]> {
  await backfillMilestones(ms.map((m) => m.id));
  const fresh = ms.filter((m, i) => !awarded.has(m.id) && ms.findIndex((x) => x.id === m.id) === i);
  if (!fresh.length) return [];
  const day = today();
  const next = new Map(awarded);
  for (const m of fresh) next.set(m.id, { ...m, awardedAt: day });
  awarded = next;
  emit();
  await persist(next);
  return fresh;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** The awarded milestones for this namespace, reactive. */
export function useAwardedMilestones(): AwardedMap {
  const map = useSyncExternalStore(subscribe, getAwarded, getAwarded);
  useEffect(() => {
    void backfillMilestones();
  }, []);
  return map;
}

export interface MilestoneState {
  /** Catalogue in display order, with the current home city filled in. */
  defs: MilestoneDef[];
  /** Everything `stays` has reached, with the day it was awarded (or reached, if never shown). */
  earned: Map<MilestoneId, Milestone & { awardedAt: string }>;
}

/** For the Us screen's stamp grid. */
export function useMilestoneState(stays: readonly Stay[]): MilestoneState {
  const home = useSettings().home_base;
  const map = useAwardedMilestones();
  return useMemo(() => {
    const earned = new Map<MilestoneId, Milestone & { awardedAt: string }>();
    for (const m of allMilestones(stays, { home })) earned.set(m.id, { ...m, awardedAt: map.get(m.id)?.awardedAt ?? m.achievedOn });
    return { defs: milestoneDefs({ home }), earned };
  }, [stays, home, map]);
}
