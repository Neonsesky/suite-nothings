import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeocodeError, nearbyHotels, normalisePhoton, searchPlaces } from '@/lib/geocode';

interface RawPhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, unknown> & { extra?: Record<string, unknown> };
}

function feature(overrides: Partial<RawPhotonFeature['properties']> = {}, coords: [number, number] = [55.190071, 25.11276]): RawPhotonFeature {
  return {
    geometry: { coordinates: coords },
    properties: {
      name: 'Golden Tulip Al Barsha',
      osm_type: 'W',
      osm_id: 91402276,
      osm_key: 'tourism',
      osm_value: 'hotel',
      district: 'Al Barsha 1',
      state: 'Dubai',
      countrycode: 'ae',
      street: '38 Street',
      extra: { stars: '4', website: 'https://x' },
      ...overrides,
    },
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function neverResolvingFetch() {
  return vi.fn((_url: string, init?: RequestInit) => {
    const signal = init?.signal;
    return new Promise((_resolve, reject) => {
      if (!signal) return;
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      signal.addEventListener('abort', () => reject(signal!.reason));
    });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('normalisePhoton', () => {
  it('normalises a sample Photon feature', () => {
    const r = normalisePhoton(feature());
    expect(r.osm_id).toBe('W91402276');
    expect(r.id).toBe('osm:W91402276');
    expect(r.isHotel).toBe(true);
    expect(r.country_code).toBe('AE');
    expect(r.kind).toBe('tourism:hotel');
    expect(r.area).toBe('Al Barsha 1');
    expect(r.region).toBe('Dubai');
    expect(r.street).toBe('38 Street');
    expect(r.tags).toEqual({ stars: '4', website: 'https://x' });
    expect(r.lat).toBeCloseTo(25.11276, 5);
    expect(r.lng).toBeCloseTo(55.190071, 5);
  });
});

describe('searchPlaces', () => {
  it('makes a single strict hotel query when it returns results', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toContain('osm_tag=tourism%3Ahotel');
      return jsonResponse({ features: [feature()] });
    });
    vi.stubGlobal('fetch', fetchMock);
    const results = await searchPlaces('golden tulip');
    expect(results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to a looser query without osm_tag when the strict query is empty', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ features: [] }))
      .mockResolvedValueOnce(jsonResponse({ features: [feature()] }));
    vi.stubGlobal('fetch', fetchMock);
    const results = await searchPlaces('golden tulip');
    expect(results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = String(fetchMock.mock.calls[1]![0]);
    expect(secondUrl).not.toContain('osm_tag');
  });

  it('returns [] without calling fetch for a too-short query', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const results = await searchPlaces('a');
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with a timeout GeocodeError when the request never resolves', async () => {
    vi.stubGlobal('fetch', neverResolvingFetch());
    await expect(searchPlaces('golden tulip', { timeoutMs: 20 })).rejects.toMatchObject({
      name: 'GeocodeError',
      code: 'timeout',
    });
  });

  it('rejects with an aborted GeocodeError when an external signal aborts', async () => {
    vi.stubGlobal('fetch', neverResolvingFetch());
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(searchPlaces('golden tulip', { signal: ctrl.signal })).rejects.toMatchObject({
      name: 'GeocodeError',
      code: 'aborted',
    });
  });

  it('rejects with a bad_response GeocodeError on an HTTP error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    vi.stubGlobal('fetch', fetchMock);
    await expect(searchPlaces('golden tulip')).rejects.toMatchObject({
      name: 'GeocodeError',
      code: 'bad_response',
    });
  });
});

describe('GeocodeError', () => {
  it('carries the error code', () => {
    const e = new GeocodeError('network', 'boom');
    expect(e.code).toBe('network');
    expect(e.message).toBe('boom');
  });
});

describe('nearbyHotels', () => {
  it('sorts results by distance from the query point, nearest first', async () => {
    const near = { lat: 25.11276, lng: 55.190071 };
    const far = feature({ osm_id: 111 }, [55.3, 25.3]);
    const close = feature({ osm_id: 222 }, [55.191, 25.113]);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ features: [far, close] }));
    vi.stubGlobal('fetch', fetchMock);
    const results = await nearbyHotels(near.lat, near.lng);
    expect(results.map((r) => r.osm_id)).toEqual(['W222', 'W111']);
    expect(results[0]!.distanceKm!).toBeLessThan(results[1]!.distanceKm!);
  });
});
