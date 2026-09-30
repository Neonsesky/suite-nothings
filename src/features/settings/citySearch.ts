/**
 * Photon (komoot) city search for the home-base picker. Separate from `@/lib/geocode` because
 * it targets cities/localities/districts, not hotels, and maps straight to `HomeBase`.
 */
import { PHOTON_URL } from '@/config/env';
import type { HomeBase } from '@/data/types';

export class CitySearchError extends Error {
  constructor(
    readonly code: 'timeout' | 'network' | 'aborted' | 'bad_response',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'CitySearchError';
  }
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, unknown>;
}

const DEFAULT_TIMEOUT = 8000;
const PAD_KM = 25;
const CITY_LAYERS = ['city', 'locality', 'district'];

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** ~25 km box around a point, used when Photon gives no `extent`. */
function paddedBBox(lat: number, lng: number, km = PAD_KM): [number, number, number, number] {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

/** Maps one Photon feature to a `HomeBase`, or null when it lacks a city/country. Exported for tests. */
export function toHomeBase(f: PhotonFeature): HomeBase | null {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const city = str(p.name);
  const country = str(p.country);
  if (!city || !country) return null;
  const countryCode = str(p.countrycode)?.toUpperCase() ?? '';
  const extent = p.extent;
  let bbox: [number, number, number, number];
  if (Array.isArray(extent) && extent.length === 4 && extent.every((n) => typeof n === 'number')) {
    // Photon's extent is [minLon, maxLat, maxLon, minLat]; HomeBase wants [west, south, east, north].
    const [minLon, maxLat, maxLon, minLat] = extent as number[];
    bbox = [minLon, minLat, maxLon, maxLat];
  } else {
    bbox = paddedBBox(lat, lng);
  }
  return { city, country, countryCode, lat, lng, bbox };
}

function dedupe(list: HomeBase[]): HomeBase[] {
  const seen = new Set<string>();
  return list.filter((h) => {
    const key = `${h.city}|${h.country}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchFeatures(
  params: readonly [string, string][],
  layers: readonly string[],
  opts: { signal?: AbortSignal; timeoutMs?: number },
): Promise<{ features: PhotonFeature[]; status: number }> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(new CitySearchError('timeout')), opts.timeoutMs ?? DEFAULT_TIMEOUT);
  const onAbort = () => ctrl.abort(new CitySearchError('aborted'));
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  if (opts.signal?.aborted) onAbort();
  try {
    const all = [...params, ...layers.map((l): [string, string] => ['layer', l])];
    const qs = all.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const res = await fetch(`${PHOTON_URL}/api/?${qs}`, { signal: ctrl.signal });
    if (!res.ok) return { features: [], status: res.status };
    const json = (await res.json()) as { features?: PhotonFeature[] };
    if (!Array.isArray(json.features)) throw new CitySearchError('bad_response');
    return { features: json.features, status: res.status };
  } catch (e) {
    if (e instanceof CitySearchError) throw e;
    const reason = ctrl.signal.reason;
    if (reason instanceof CitySearchError) throw reason;
    throw new CitySearchError('network', e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Search cities/localities/districts by name. Tries the `city|locality|district` layers first;
 * falls back to an unlayered search when that returns nothing or Photon rejects the layer filter
 * (400). Deduped by city+country.
 */
export async function searchCities(q: string, opts: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<HomeBase[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const params: [string, string][] = [
    ['q', query],
    ['limit', '8'],
    ['lang', 'en'],
  ];
  let { features, status } = await fetchFeatures(params, CITY_LAYERS, opts);
  if (features.length === 0) {
    if (status !== 0 && status !== 200 && status !== 400) {
      throw new CitySearchError('bad_response', `Photon answered ${status}`);
    }
    ({ features, status } = await fetchFeatures(params, [], opts));
    if (features.length === 0 && status !== 200) {
      throw new CitySearchError('bad_response', `Photon answered ${status}`);
    }
  }
  return dedupe(features.map(toHomeBase).filter((h): h is HomeBase => h != null));
}
