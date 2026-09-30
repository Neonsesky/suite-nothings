/**
 * Hotel enrichment API (SPEC §11). A later wave implements providers; callers can already use
 * these. `requestEnrichment` is a no-op for now and resolves immediately.
 */
import { useSyncExternalStore } from 'react';
import type { Hotel } from '@/data/types';

export type EnrichmentRunStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped';

/** Fields a provider may fill. Our own photos always win as the cover. */
export type EnrichmentPatch = Partial<
  Pick<Hotel, 'brand' | 'address' | 'website' | 'phone' | 'stars' | 'price_level' | 'description' | 'description_source' | 'amenities_json' | 'wikidata_id'>
>;

export interface EnrichmentProvider {
  id: string; // e.g. "osm", "wikidata"
  /** Whether this provider can say anything about the hotel (e.g. needs wikidata_id). */
  canEnrich(hotel: Hotel): boolean;
  enrich(hotel: Hotel, signal: AbortSignal): Promise<EnrichmentPatch>;
}

const status = new Map<string, EnrichmentRunStatus>();
const listeners = new Set<() => void>();

/** Enrich a hotel once (or again with `force`). No-op until providers land. */
export async function requestEnrichment(hotelId: string, _opts: { force?: boolean } = {}): Promise<void> {
  if (!status.has(hotelId)) {
    status.set(hotelId, 'skipped');
    listeners.forEach((l) => l());
  }
}

export function useEnrichmentStatus(hotelId: string | null | undefined): EnrichmentRunStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (hotelId ? status.get(hotelId) ?? 'idle' : 'idle'),
    () => 'idle',
  );
}
