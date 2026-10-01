/**
 * Hotel enrichment (SPEC §11). Runs once per hotel in the background, merges only into empty
 * fields, writes through `upsertHotel` (so it syncs to the Sheet) and always ends on a final
 * `enrichment_status`. Offline hotels stay `pending` and are picked up when we're back online.
 */
import { useSyncExternalStore } from 'react';
import { getAdapter, getState, upsertHotel, whenReady } from '@/data/store';
import type { Hotel } from '@/data/types';
import { appsScriptAI, buildPrompt, factsOf, ollamaAI, webllmAI, type AIProvider, type Invoke } from './ai';
import { mergePatch } from './merge';
import { createOsmProvider } from './osm';
import { createPlacesProvider } from './places';
import { getPrefs } from './prefs';
import type { EnrichmentPatch, EnrichmentProvider } from './types';
import { createWikidataProvider } from './wikidata';

export type { EnrichmentPatch, EnrichmentProvider } from './types';
export type EnrichmentRunStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped';
export type RunOutcome = 'done' | 'failed' | 'skipped';

/** Wraps an AIProvider: writes a description only where none came from a real source. */
export function createAIDescriptionProvider(ai: AIProvider): EnrichmentProvider {
  return {
    id: `ai:${ai.id}`,
    canEnrich: (h) => !h.description || h.description_source === 'ai',
    async enrich(hotel, signal) {
      if (!(await ai.available(signal))) return {};
      const out = await ai.describe(buildPrompt(factsOf(hotel)), signal);
      const patch: EnrichmentPatch = { description: out.description, description_source: 'ai' };
      if (out.tags.length) patch.amenities_json = JSON.stringify(out.tags);
      return patch;
    },
  };
}

export interface ChainResult {
  hotel: Hotel;
  changes: Partial<Hotel>;
  outcome: RunOutcome;
  errors: { provider: string; message: string }[];
}

/**
 * Run providers in order, each seeing what the previous ones filled. One failing provider never
 * stops the rest; the run only counts as failed when every provider that tried failed.
 */
export async function runProviders(start: Hotel, providers: EnrichmentProvider[], signal: AbortSignal, opts: { force?: boolean } = {}): Promise<ChainResult> {
  let hotel = start;
  const changes: Partial<Hotel> = {};
  const errors: ChainResult['errors'] = [];
  const touched = new Set<string>();
  let tried = 0;
  for (const p of providers) {
    if (signal.aborted) break;
    if (!p.canEnrich(hotel)) continue;
    tried++;
    try {
      const patch = await p.enrich(hotel, signal);
      // In a forced run a field may be refreshed once; the first provider to refill it wins.
      const allowed = Object.fromEntries(Object.entries(patch).filter(([k]) => !touched.has(k))) as EnrichmentPatch;
      const r = mergePatch(hotel, allowed, opts);
      Object.keys(r.changes).forEach((k) => touched.add(k));
      Object.assign(changes, r.changes);
      changes.enriched_fields_json = JSON.stringify(r.filled);
      hotel = { ...hotel, ...r.changes, enriched_fields_json: changes.enriched_fields_json };
    } catch (e) {
      errors.push({ provider: p.id, message: e instanceof Error ? e.message : String(e) });
    }
  }
  const outcome: RunOutcome = tried === 0 ? 'skipped' : errors.length === tried ? 'failed' : 'done';
  return { hotel, changes, outcome, errors };
}

// ---- The enricher (store-agnostic so tests can drive it) ----------------------------------------

export interface EnricherDeps {
  getHotel(id: string): Hotel | undefined;
  saveHotel(hotel: Hotel): Promise<unknown>;
  providers(): EnrichmentProvider[];
  isOnline(): boolean;
  now?(): string;
}

const FINAL = new Set(['done', 'failed', 'skipped']);

export function createEnricher(deps: EnricherDeps) {
  const status = new Map<string, EnrichmentRunStatus>();
  const listeners = new Set<() => void>();
  const inFlight = new Map<string, Promise<void>>();
  const queued = new Set<string>();
  const setStatus = (id: string, s: EnrichmentRunStatus) => {
    status.set(id, s);
    listeners.forEach((l) => l());
  };

  async function run(id: string, force: boolean): Promise<void> {
    const start = deps.getHotel(id);
    if (!start || start.deleted) return;
    // Enrich once: a hotel with a final status is only fetched again on "Refresh info".
    if (!force && FINAL.has(start.enrichment_status)) return;
    if (!deps.isOnline()) {
      queued.add(id);
      setStatus(id, 'skipped'); // No skeleton while offline; the hotel itself stays pending.
      if (start.enrichment_status !== 'pending') await deps.saveHotel({ ...start, enrichment_status: 'pending' });
      return;
    }
    queued.delete(id);
    setStatus(id, 'running');
    let outcome: RunOutcome = 'failed';
    let changes: Partial<Hotel> = {};
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45_000);
      const r = await runProviders(start, deps.providers(), ctrl.signal, { force }).finally(() => clearTimeout(timer));
      outcome = r.outcome;
      changes = r.changes;
    } catch {
      outcome = 'failed';
    }
    if (outcome === 'failed' && !deps.isOnline()) {
      // We dropped offline mid-run: try again later rather than giving up.
      queued.add(id);
      setStatus(id, 'skipped');
      return;
    }
    const latest = deps.getHotel(id) ?? start;
    // Never clobber an edit made while we were fetching.
    const safe = Object.fromEntries(
      Object.entries(changes).filter(([k]) => k === 'enriched_fields_json' || latest[k as keyof Hotel] === start[k as keyof Hotel]),
    ) as Partial<Hotel>;
    try {
      await deps.saveHotel({ ...latest, ...safe, enrichment_status: outcome, enriched_at: deps.now?.() ?? new Date().toISOString() });
    } catch {
      outcome = 'failed';
    }
    setStatus(id, outcome);
  }

  function request(id: string, opts: { force?: boolean } = {}): Promise<void> {
    const existing = inFlight.get(id);
    if (existing) return existing;
    const p = run(id, opts.force === true)
      .catch(() => setStatus(id, 'failed'))
      .finally(() => inFlight.delete(id));
    inFlight.set(id, p);
    return p;
  }

  /** Work through queued and still-pending hotels one at a time (polite to the open APIs). */
  async function drain(pendingIds: string[] = []): Promise<void> {
    const ids = [...new Set([...queued, ...pendingIds])];
    for (const id of ids) {
      if (!deps.isOnline()) return;
      await request(id);
    }
  }

  return {
    request,
    drain,
    status: (id: string) => status.get(id) ?? 'idle',
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

// ---- The app's enricher, wired to the store ----------------------------------------------------

function invoker(): Invoke | null {
  try {
    const adapter = getAdapter();
    return adapter.invoke ? (action, payload) => adapter.invoke!(action, payload) : null;
  } catch {
    return null;
  }
}

function aiProvider(): AIProvider | null {
  const prefs = getPrefs();
  if (prefs.ai === 'apps-script') return appsScriptAI(invoker());
  if (prefs.ai === 'ollama') return ollamaAI(prefs.ollamaModel);
  if (prefs.ai === 'webllm') return webllmAI();
  return null;
}

export function defaultProviders(): EnrichmentProvider[] {
  const list: EnrichmentProvider[] = [createOsmProvider(), createWikidataProvider()];
  if (getPrefs().places) list.push(createPlacesProvider(invoker()));
  const ai = aiProvider();
  if (ai) list.push(createAIDescriptionProvider(ai));
  return list;
}

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

const app = createEnricher({
  getHotel: (id) => getState().hotels.get(id),
  saveHotel: (h) => upsertHotel(h),
  providers: defaultProviders,
  isOnline,
});

/** Enrich a hotel once (or again with `force`, from "Refresh info"). Never throws. */
export async function requestEnrichment(hotelId: string, opts: { force?: boolean } = {}): Promise<void> {
  await whenReady().catch(() => undefined);
  return app.request(hotelId, opts);
}

let started = false;
/** Pick up hotels left `pending` (closed mid-run, or added offline), now and whenever we're back online. */
export function startEnrichmentQueue(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const pick = () =>
    void whenReady()
      .then(() => app.drain([...getState().hotels.values()].filter((h) => h.enrichment_status === 'pending' && !h.deleted).map((h) => h.hotel_id)))
      .catch(() => undefined);
  window.addEventListener('online', pick);
  pick();
}

export function useEnrichmentStatus(hotelId: string | null | undefined): EnrichmentRunStatus {
  return useSyncExternalStore(
    app.subscribe,
    () => (hotelId ? app.status(hotelId) : 'idle'),
    () => 'idle',
  );
}
