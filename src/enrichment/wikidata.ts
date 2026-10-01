/**
 * Provider 2: Wikidata → Wikipedia summary, official site and a Wikimedia Commons image with its
 * licence and attribution (SPEC §11.2). Every call uses the CORS-friendly `origin=*` endpoints.
 */
import type { Hotel } from '@/data/types';
import { haversineKm } from '@/lib/geo';
import { defaultContext, getJson, type EnrichmentContext, type EnrichmentPatch, type EnrichmentProvider } from './types';

export const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
export const WIKIPEDIA_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

/** The bits of a Wikidata entity we read. */
export interface WikidataEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
  sitelinks?: Record<string, { title: string }>;
}

export interface EntityFacts {
  id: string;
  label: string | null;
  website: string | null;
  phone: string | null;
  imageFile: string | null;
  enwikiTitle: string | null;
  coords: { lat: number; lng: number } | null;
}

function claim(e: WikidataEntity, prop: string): unknown {
  return e.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
}

/** Pure mapping: P856 official website, P1329 phone, P18 image, P625 coordinates, enwiki sitelink. */
export function entityFacts(e: WikidataEntity): EntityFacts {
  const site = claim(e, 'P856');
  const phone = claim(e, 'P1329');
  const image = claim(e, 'P18');
  const coord = claim(e, 'P625') as { latitude?: number; longitude?: number } | undefined;
  return {
    id: e.id,
    label: e.labels?.en?.value ?? null,
    website: typeof site === 'string' && /^https?:\/\//.test(site) ? site : null,
    phone: typeof phone === 'string' ? phone : null,
    imageFile: typeof image === 'string' ? image : null,
    enwikiTitle: e.sitelinks?.enwiki?.title ?? null,
    coords: coord && typeof coord.latitude === 'number' && typeof coord.longitude === 'number' ? { lat: coord.latitude, lng: coord.longitude } : null,
  };
}

const wd = (params: Record<string, string>) => `${WIKIDATA_API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;

async function getEntities(ids: string[], signal: AbortSignal, ctx: EnrichmentContext): Promise<WikidataEntity[]> {
  const body = await getJson<{ entities?: Record<string, WikidataEntity & { missing?: string }> }>(
    ctx,
    wd({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels|claims|sitelinks', languages: 'en', sitefilter: 'enwiki' }),
    signal,
  );
  return Object.values(body.entities ?? {}).filter((e) => e && e.missing === undefined);
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['hotel', 'the', 'and', 'resort', 'spa'].includes(w));

/** Share of the hotel's distinctive words that the candidate label also has. */
export function nameSimilarity(a: string, b: string): number {
  const wa = words(a);
  const wb = new Set(words(b));
  if (!wa.length) return 0;
  return wa.filter((w) => wb.has(w)).length / wa.length;
}

/** Careful search: a candidate only counts if it's within 400 m and shares most of the name. */
export async function findEntity(hotel: Hotel, signal: AbortSignal, ctx: EnrichmentContext): Promise<WikidataEntity | null> {
  const found = await getJson<{ search?: { id: string }[] }>(ctx, wd({ action: 'wbsearchentities', search: hotel.name, language: 'en', type: 'item', limit: '5' }), signal);
  const ids = (found.search ?? []).map((s) => s.id).filter((id) => /^Q\d+$/.test(id));
  if (!ids.length) return null;
  const entities = await getEntities(ids, signal, ctx);
  let best: { e: WikidataEntity; km: number } | null = null;
  for (const e of entities) {
    const f = entityFacts(e);
    if (!f.coords || !f.label || nameSimilarity(hotel.name, f.label) < 0.6) continue;
    const km = haversineKm(hotel, f.coords);
    if (km <= 0.4 && (!best || km < best.km)) best = { e, km };
  }
  return best?.e ?? null;
}

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

export interface CommonsImage {
  url: string;
  credit: string;
}

/** Image URL plus "Artist · Licence · Wikimedia Commons". Unlicensed files are skipped. */
export async function fetchCommonsImage(file: string, signal: AbortSignal, ctx: EnrichmentContext): Promise<CommonsImage | null> {
  const url = `${COMMONS_API}?${new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '960',
    titles: `File:${file}`,
  })}`;
  const body = await getJson<{ query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string; extmetadata?: Record<string, { value?: string }> }[] }> } }>(ctx, url, signal);
  const info = Object.values(body.query?.pages ?? {})[0]?.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const licence = stripHtml(meta.LicenseShortName?.value ?? '');
  const src = info?.thumburl ?? info?.url;
  if (!src || !licence) return null;
  const artist = stripHtml(meta.Artist?.value ?? '') || 'Unknown author';
  return { url: src, credit: `${artist} · ${licence} · Wikimedia Commons` };
}

/** The Commons page for a stored image URL, for the attribution link. */
export function commonsPageFor(imageUrl: string): string | null {
  const m = /\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/.exec(imageUrl);
  return m ? `https://commons.wikimedia.org/wiki/File:${m[1]}` : null;
}

export async function fetchSummary(title: string, signal: AbortSignal, ctx: EnrichmentContext): Promise<string | null> {
  const body = await getJson<{ type?: string; extract?: string }>(ctx, WIKIPEDIA_SUMMARY + encodeURIComponent(title.replace(/ /g, '_')), signal);
  if (body.type === 'disambiguation') return null;
  const text = body.extract?.trim();
  return text ? text : null;
}

export function createWikidataProvider(ctx: EnrichmentContext = defaultContext()): EnrichmentProvider {
  return {
    id: 'wikidata',
    canEnrich: (hotel) => Boolean(hotel.wikidata_id || hotel.name),
    async enrich(hotel, signal, c = ctx) {
      const entity = hotel.wikidata_id ? (await getEntities([hotel.wikidata_id], signal, c))[0] ?? null : await findEntity(hotel, signal, c);
      if (!entity) return {};
      const f = entityFacts(entity);
      const patch: EnrichmentPatch = { wikidata_id: f.id };
      if (f.website) patch.website = f.website;
      if (f.phone) patch.phone = f.phone;
      // Each extra lookup is optional: a missing summary or image doesn't sink the rest.
      const [summary, image] = await Promise.all([
        f.enwikiTitle ? fetchSummary(f.enwikiTitle, signal, c).catch(() => null) : null,
        f.imageFile ? fetchCommonsImage(f.imageFile, signal, c).catch(() => null) : null,
      ]);
      if (summary) {
        patch.description = summary;
        patch.description_source = 'wikipedia';
      }
      if (image) {
        patch.image_url = image.url;
        patch.image_credit = image.credit;
      }
      return patch;
    },
  };
}
