/**
 * Provider 1: place data from OSM tags (SPEC §11.1). Add-stay already copies the Photon tags it
 * had into the hotel; this fills the gaps with one polite Overpass lookup by `osm_id`, cached.
 */
import type { Hotel, PriceLevel } from '@/data/types';
import { getJson, ProviderError, type EnrichmentContext, type EnrichmentPatch, type EnrichmentProvider, defaultContext } from './types';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_PREFIX = 'sn:overpass:';

const clean = (v: string | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/** OSM sometimes holds several values separated by ";" — we keep the first. */
const first = (v: string | undefined): string | null => clean(v?.split(';')[0]);

function normaliseWebsite(v: string | null): string | null {
  if (!v) return null;
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

function priceLevelOf(tags: Record<string, string>): PriceLevel | null {
  const raw = clean(tags.price_level ?? tags['price:level'] ?? tags.price_range ?? tags['price:range']);
  if (!raw) return null;
  const n = /^[$€£¤]+$/.test(raw) ? raw.length : Number.parseInt(raw, 10);
  return n >= 1 && n <= 4 ? (n as PriceLevel) : null;
}

const AMENITY_TAGS: [string, (v: string) => boolean, string][] = [
  ['swimming_pool', (v) => v !== 'no', 'Pool'],
  ['leisure:swimming_pool', (v) => v !== 'no', 'Pool'],
  ['internet_access', (v) => /wlan|yes|wifi/.test(v), 'Wi-Fi'],
  ['spa', (v) => v !== 'no', 'Spa'],
  ['sauna', (v) => v !== 'no', 'Sauna'],
  ['fitness_centre', (v) => v !== 'no', 'Gym'],
  ['gym', (v) => v !== 'no', 'Gym'],
  ['restaurant', (v) => v !== 'no', 'Restaurant'],
  ['bar', (v) => v !== 'no', 'Bar'],
  ['beach', (v) => v !== 'no', 'Beach'],
  ['parking', (v) => v !== 'no', 'Parking'],
  ['wheelchair', (v) => v === 'yes', 'Step-free access'],
];

/** Pure mapping from raw OSM tags to hotel fields. Unknown or malformed values are dropped. */
export function mapOsmTags(tags: Record<string, string>): EnrichmentPatch {
  const patch: EnrichmentPatch = {};
  const brand = clean(tags.brand) ?? clean(tags.operator);
  if (brand) patch.brand = brand;
  const stars = Number.parseFloat(tags.stars ?? '');
  if (Number.isFinite(stars) && stars >= 1 && stars <= 5) patch.stars = Math.round(stars);
  const website = normaliseWebsite(first(tags.website ?? tags['contact:website'] ?? tags.url));
  if (website) patch.website = website;
  const phone = first(tags.phone ?? tags['contact:phone']);
  if (phone) patch.phone = phone;
  const wikidata = clean(tags.wikidata);
  if (wikidata && /^Q\d+$/.test(wikidata)) patch.wikidata_id = wikidata;
  const street = [clean(tags['addr:housenumber']), clean(tags['addr:street'])].filter(Boolean).join(' ');
  const line = [street || null, clean(tags['addr:suburb']), clean(tags['addr:city'])].filter(Boolean);
  if (street && line.length) patch.address = line.join(', ');
  const price = priceLevelOf(tags);
  if (price) patch.price_level = price;
  const amenities = [...new Set(AMENITY_TAGS.filter(([k, ok]) => tags[k] !== undefined && ok(tags[k]!.toLowerCase())).map(([, , label]) => label))];
  if (amenities.length) patch.amenities_json = JSON.stringify(amenities);
  return patch;
}

const OSM_TYPES: Record<string, string> = { N: 'node', W: 'way', R: 'relation' };

export function overpassQuery(osmId: string): string | null {
  const m = /^([NWR])(\d+)$/.exec(osmId.trim().toUpperCase());
  if (!m) return null;
  return `[out:json][timeout:10];${OSM_TYPES[m[1]!]}(${m[2]});out tags;`;
}

function readCache(osmId: string): Record<string, string> | null {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_PREFIX + osmId);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

function writeCache(osmId: string, tags: Record<string, string>) {
  try {
    globalThis.localStorage?.setItem(CACHE_PREFIX + osmId, JSON.stringify(tags));
  } catch {
    // A full or blocked localStorage only costs us the cache.
  }
}

/** One Overpass request per OSM id, ever (cached in localStorage). */
export async function fetchOsmTags(osmId: string, signal: AbortSignal, ctx: EnrichmentContext = defaultContext()): Promise<Record<string, string>> {
  const cached = readCache(osmId);
  if (cached) return cached;
  const q = overpassQuery(osmId);
  if (!q) throw new ProviderError('osm', `Not an OSM id: ${osmId}`);
  const body = await getJson<{ elements?: { tags?: Record<string, string> }[] }>(ctx, `${OVERPASS_URL}?data=${encodeURIComponent(q)}`, signal);
  const tags = body.elements?.[0]?.tags ?? {};
  writeCache(osmId, tags);
  return tags;
}

export function createOsmProvider(ctx: EnrichmentContext = defaultContext()): EnrichmentProvider {
  return {
    id: 'osm',
    canEnrich: (hotel: Hotel) => Boolean(hotel.osm_id && overpassQuery(hotel.osm_id)),
    async enrich(hotel, signal, c = ctx) {
      return mapOsmTags(await fetchOsmTags(hotel.osm_id!, signal, c));
    },
  };
}
