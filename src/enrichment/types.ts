/** Shared enrichment types (SPEC §11). Kept free of React and the store so providers stay testable. */
import type { Hotel } from '@/data/types';

/** Fields a provider may fill. Our own photos always win as the cover, so no provider touches it. */
export type EnrichmentPatch = Partial<
  Pick<
    Hotel,
    | 'brand'
    | 'address'
    | 'website'
    | 'phone'
    | 'stars'
    | 'price_level'
    | 'description'
    | 'description_source'
    | 'amenities_json'
    | 'wikidata_id'
    | 'image_url'
    | 'image_credit'
  >
>;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** What every provider gets besides the hotel: an injectable fetch (fixtures in tests). */
export interface EnrichmentContext {
  fetch: FetchLike;
}

export interface EnrichmentProvider {
  id: string; // e.g. "osm", "wikidata"
  /** Whether this provider can say anything about the hotel (e.g. needs wikidata_id). */
  canEnrich(hotel: Hotel): boolean;
  enrich(hotel: Hotel, signal: AbortSignal, ctx?: EnrichmentContext): Promise<EnrichmentPatch>;
}

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** GET a JSON document; anything but a 2xx JSON body throws. */
export async function getJson<T = unknown>(ctx: EnrichmentContext, url: string, signal: AbortSignal, init: RequestInit = {}): Promise<T> {
  const res = await ctx.fetch(url, { credentials: 'omit', ...init, signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const defaultContext = (): EnrichmentContext => ({ fetch: (input, init) => globalThis.fetch(input, init) });
