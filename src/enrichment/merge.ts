/**
 * The one merge rule (SPEC §11): enrichment only fills empty fields. With `force` it may also
 * replace a field that enrichment itself filled earlier — never one we typed by hand.
 */
import { parseJsonArray } from '@/data/stays';
import type { Hotel } from '@/data/types';
import type { EnrichmentPatch } from './types';

/** Fields that travel with another one: a description keeps its source, an image its credit. */
const COMPANIONS: Partial<Record<keyof EnrichmentPatch, keyof EnrichmentPatch>> = {
  description: 'description_source',
  image_url: 'image_credit',
};
const PRIMARY: (keyof EnrichmentPatch)[] = ['brand', 'address', 'website', 'phone', 'stars', 'price_level', 'description', 'amenities_json', 'wikidata_id', 'image_url'];

const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || v === '[]';

export function filledFields(hotel: Hotel): string[] {
  return parseJsonArray(hotel.enriched_fields_json);
}

export interface MergeResult {
  /** Only the fields that change; empty when there's nothing new. */
  changes: Partial<Hotel>;
  /** Every field enrichment now owns (the old list plus what this merge filled). */
  filled: string[];
}

export function mergePatch(hotel: Hotel, patch: EnrichmentPatch, opts: { force?: boolean } = {}): MergeResult {
  const filled = new Set(filledFields(hotel));
  const changes: Partial<Hotel> = {};
  const set = <K extends keyof EnrichmentPatch>(k: K, v: EnrichmentPatch[K]) => {
    if (hotel[k] !== v) (changes as Record<string, unknown>)[k] = v ?? null;
    filled.add(k);
  };
  for (const key of PRIMARY) {
    const next = patch[key];
    if (isEmpty(next)) continue;
    const mayReplace = isEmpty(hotel[key]) || (opts.force === true && filled.has(key));
    if (!mayReplace) continue;
    set(key, next);
    const companion = COMPANIONS[key];
    if (companion) set(companion, patch[companion] ?? null);
  }
  return { changes, filled: [...filled].sort() };
}

/** Apply a patch to a hotel in memory (used to chain providers). */
export function applyPatch(hotel: Hotel, patch: EnrichmentPatch, opts: { force?: boolean } = {}): { hotel: Hotel; filled: string[] } {
  const { changes, filled } = mergePatch(hotel, patch, opts);
  return { hotel: { ...hotel, ...changes, enriched_fields_json: JSON.stringify(filled) }, filled };
}
