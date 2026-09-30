import { afterEach, describe, expect, it, vi } from 'vitest';
import { CitySearchError, searchCities, toHomeBase } from '@/features/settings/citySearch';

interface RawFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, unknown>;
}

function feature(overrides: Record<string, unknown> = {}, coords: [number, number] = [55.2708, 25.2048]): RawFeature {
  return {
    geometry: { coordinates: coords },
    properties: {
      name: 'Dubai',
      country: 'United Arab Emirates',
      countrycode: 'ae',
      ...overrides,
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toHomeBase', () => {
  it('maps a Photon feature to a HomeBase', () => {
    const home = toHomeBase(feature());
    expect(home).toEqual({
      city: 'Dubai',
      country: 'United Arab Emirates',
      countryCode: 'AE',
      lat: 25.2048,
      lng: 55.2708,
      bbox: expect.any(Array),
    });
  });

  it('converts Photon extent [minLon, maxLat, maxLon, minLat] into [west, south, east, north]', () => {
    const home = toHomeBase(feature({ extent: [54.9, 25.4, 55.6, 24.8] }));
    expect(home?.bbox).toEqual([54.9, 24.8, 55.6, 25.4]);
  });

  it('pads a ~25km box around the point when there is no extent', () => {
    const home = toHomeBase(feature());
    const [west, south, east, north] = home!.bbox!;
    expect(east - west).toBeGreaterThan(0.3);
    expect(north - south).toBeCloseTo(2 * (25 / 111), 2);
  });

  it('returns null when the feature has no city name or country', () => {
    expect(toHomeBase(feature({ name: undefined }))).toBeNull();
    expect(toHomeBase(feature({ country: undefined }))).toBeNull();
  });
});

describe('searchCities', () => {
  it('returns [] for queries under 2 characters without fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await searchCities('d')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requests the city/locality/district layers first and maps results', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      expect(url).toContain('layer=city');
      expect(url).toContain('layer=locality');
      expect(url).toContain('layer=district');
      return jsonResponse({ features: [feature(), feature({ name: 'Dubai' })] });
    });
    vi.stubGlobal('fetch', fetchSpy);
    const results = await searchCities('dubai');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Deduped by city+country.
    expect(results).toHaveLength(1);
    expect(results[0].city).toBe('Dubai');
  });

  it('falls back to an unlayered search when the layered call returns nothing', async () => {
    let call = 0;
    const fetchSpy = vi.fn(async (url: string) => {
      call++;
      if (call === 1) {
        expect(url).toContain('layer=city');
        return jsonResponse({ features: [] });
      }
      expect(url).not.toContain('layer=');
      return jsonResponse({
        features: [feature({ name: 'London', country: 'United Kingdom', countrycode: 'gb' }, [-0.1276, 51.5072])],
      });
    });
    vi.stubGlobal('fetch', fetchSpy);
    const results = await searchCities('london');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(results).toEqual([{ city: 'London', country: 'United Kingdom', countryCode: 'GB', lat: 51.5072, lng: -0.1276, bbox: expect.any(Array) }]);
  });

  it('falls back to an unlayered search when Photon rejects the layer filter with 400', async () => {
    let call = 0;
    const fetchSpy = vi.fn(async () => {
      call++;
      if (call === 1) return jsonResponse({}, 400);
      return jsonResponse({ features: [feature()] });
    });
    vi.stubGlobal('fetch', fetchSpy);
    const results = await searchCities('dubai');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(1);
  });

  it('throws a typed network error when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(searchCities('dubai')).rejects.toBeInstanceOf(CitySearchError);
    await expect(searchCities('dubai')).rejects.toMatchObject({ code: 'network' });
  });

  it('aborts cleanly via an external signal', async () => {
    const ctrl = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        const signal = init?.signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(signal.reason));
        });
      }),
    );
    const promise = searchCities('dubai', { signal: ctrl.signal });
    ctrl.abort();
    await expect(promise).rejects.toMatchObject({ code: 'aborted' });
  });
});
