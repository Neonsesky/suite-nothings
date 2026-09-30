/**
 * Photon (komoot) geocoding client. Returns normalised `PlaceResult`s.
 * Owned by foundation; w1-add-stay may extend additively.
 */
import { PHOTON_URL } from '@/config/env';
import type { LatLng } from './geo';

export interface PlaceResult {
  /** Stable id: `osm:<W|N|R><id>` when from OSM, else `<source>:<hash>`. */
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** OSM id in `W123` / `N123` / `R123` form, if any. */
  osm_id: string | null;
  /** e.g. `tourism:hotel` */
  kind: string | null;
  isHotel: boolean;
  street: string | null;
  housenumber: string | null;
  area: string | null; // district / locality
  city: string | null;
  region: string | null; // state / emirate
  country: string | null;
  country_code: string | null; // upper-case alpha-2
  postcode: string | null;
  /** One-line human address. */
  address: string | null;
  /** Raw OSM tags when present (Photon `extra`), e.g. brand, stars, website, phone, wikidata. */
  tags: Record<string, string>;
  source: 'photon' | 'server';
  /** Distance from `near` in km, when a bias point was given. */
  distanceKm?: number;
}

export interface SearchOptions {
  near?: LatLng;
  hotelsOnly?: boolean;
  limit?: number;
  lang?: 'en';
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class GeocodeError extends Error {
  constructor(
    readonly code: 'timeout' | 'network' | 'aborted' | 'bad_response',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'GeocodeError';
  }
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, unknown> & { extra?: Record<string, unknown> };
}

const DEFAULT_TIMEOUT = 8000;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function haversine(a: LatLng, b: LatLng): number {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Normalise one Photon GeoJSON feature. Exported for tests. */
export function normalisePhoton(f: PhotonFeature, near?: LatLng): PlaceResult {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const osmType = str(p.osm_type);
  const osmId = p.osm_id != null ? String(p.osm_id) : null;
  const osm_id = osmType && osmId ? `${osmType.toUpperCase()}${osmId}` : null;
  const key = str(p.osm_key);
  const value = str(p.osm_value);
  const tags: Record<string, string> = {};
  if (p.extra && typeof p.extra === 'object') {
    for (const [k, v] of Object.entries(p.extra)) if (v != null) tags[k] = String(v);
  }
  const street = str(p.street);
  const housenumber = str(p.housenumber);
  const area = str(p.district) ?? str(p.locality);
  const city = str(p.city) ?? str(p.county);
  const region = str(p.state);
  const country = str(p.country);
  const addressParts = [street ? [housenumber, street].filter(Boolean).join(' ') : null, area, city, country].filter(
    (x, i, arr): x is string => !!x && arr.indexOf(x) === i,
  );
  const name = str(p.name) ?? addressParts[0] ?? 'Unnamed place';
  const result: PlaceResult = {
    id: osm_id ? `osm:${osm_id}` : `photon:${lat.toFixed(5)},${lng.toFixed(5)}`,
    name,
    lat,
    lng,
    osm_id,
    kind: key && value ? `${key}:${value}` : null,
    isHotel: key === 'tourism' && (value === 'hotel' || value === 'motel' || value === 'guest_house' || value === 'resort'),
    street,
    housenumber,
    area,
    city,
    region,
    country,
    country_code: str(p.countrycode)?.toUpperCase() ?? null,
    postcode: str(p.postcode),
    address: addressParts.length ? addressParts.join(', ') : null,
    tags,
    source: 'photon',
  };
  if (near) result.distanceKm = haversine(near, { lat, lng });
  return result;
}

async function photonFetch(path: string, params: [string, string][], opts: { signal?: AbortSignal; timeoutMs?: number }) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(new GeocodeError('timeout')), opts.timeoutMs ?? DEFAULT_TIMEOUT);
  const onAbort = () => ctrl.abort(new GeocodeError('aborted'));
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  if (opts.signal?.aborted) onAbort();
  try {
    const qs = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const res = await fetch(`${PHOTON_URL}${path}?${qs}`, { signal: ctrl.signal });
    if (!res.ok) throw new GeocodeError('bad_response', `Photon answered ${res.status}`);
    const json = (await res.json()) as { features?: PhotonFeature[] };
    if (!Array.isArray(json.features)) throw new GeocodeError('bad_response');
    return json.features;
  } catch (e) {
    if (e instanceof GeocodeError) throw e;
    const reason = ctrl.signal.reason;
    if (reason instanceof GeocodeError) throw reason;
    throw new GeocodeError('network', e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

function dedupe(results: PlaceResult[]): PlaceResult[] {
  const seen = new Set<string>();
  return results.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/**
 * Search places. With `hotelsOnly` (default true) it tries `osm_tag=tourism:hotel` first, then
 * falls back to a looser search (any tourism/building) if nothing comes back.
 */
export async function searchPlaces(q: string, opts: SearchOptions = {}): Promise<PlaceResult[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const limit = opts.limit ?? 8;
  const base: [string, string][] = [
    ['q', query],
    ['limit', String(limit)],
    ['lang', opts.lang ?? 'en'],
  ];
  if (opts.near) base.push(['lat', String(opts.near.lat)], ['lon', String(opts.near.lng)]);
  const hotelsOnly = opts.hotelsOnly ?? true;
  if (hotelsOnly) {
    const strict = await photonFetch('/api/', [...base, ['osm_tag', 'tourism:hotel']], opts);
    if (strict.length > 0) return dedupe(strict.map((f) => normalisePhoton(f, opts.near)));
  }
  const loose = await photonFetch('/api/', base, opts);
  const results = dedupe(loose.map((f) => normalisePhoton(f, opts.near)));
  // Hotels first in the looser fallback.
  return results.sort((a, b) => Number(b.isHotel) - Number(a.isHotel));
}

/** Reverse-geocode a point to its nearest address/place. */
export async function reverse(lat: number, lng: number, opts: Pick<SearchOptions, 'signal' | 'timeoutMs'> = {}): Promise<PlaceResult | null> {
  const features = await photonFetch('/reverse', [['lat', String(lat)], ['lon', String(lng)], ['lang', 'en'], ['limit', '1']], opts);
  return features[0] ? normalisePhoton(features[0], { lat, lng }) : null;
}

/** Hotels near a point, nearest first. Uses reverse with a hotel tag filter and radius. */
export async function nearbyHotels(
  lat: number,
  lng: number,
  opts: Pick<SearchOptions, 'signal' | 'timeoutMs' | 'limit'> & { radiusKm?: number } = {},
): Promise<PlaceResult[]> {
  const near = { lat, lng };
  const features = await photonFetch(
    '/reverse',
    [
      ['lat', String(lat)],
      ['lon', String(lng)],
      ['lang', 'en'],
      ['limit', String(opts.limit ?? 10)],
      ['radius', String(opts.radiusKm ?? 1.5)],
      ['osm_tag', 'tourism:hotel'],
    ],
    opts,
  );
  return dedupe(features.map((f) => normalisePhoton(f, near))).sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}
