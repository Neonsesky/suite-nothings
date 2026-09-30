import { describe, expect, it } from 'vitest';
import type { HomeBase } from '@/data/types';
import { DUBAI_BBOX } from '@/data/seed';
import {
  chapterForZoom,
  chapterTitle,
  computeBreakpoints,
  fitZoom,
  flapText,
  framingFor,
  globeZoom,
  onVisibleHemisphere,
  settleTarget,
  SETTLE_RANGE,
} from '@/map/chapters';

const DUBAI: HomeBase = { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', lat: 25.2048, lng: 55.2708, bbox: DUBAI_BBOX };
const LONDON: HomeBase = { city: 'London', country: 'United Kingdom', countryCode: 'GB', lat: 51.5074, lng: -0.1278 };
const SINGAPORE: HomeBase = { city: 'Singapore', country: 'Singapore', countryCode: 'SG', lat: 1.3521, lng: 103.8198 };
const PHONE = { width: 390, height: 760 };

describe('breakpoints', () => {
  it('lands Dubai at City ≥ ~9.5 and World < ~5.5', () => {
    const bp = computeBreakpoints(DUBAI);
    expect(bp.city).toBeCloseTo(9.5, 0);
    expect(bp.country).toBeCloseTo(5.5, 0);
  });

  it('adapts to London → UK → World (a bigger country breaks earlier)', () => {
    const bp = computeBreakpoints(LONDON);
    expect(bp.city).toBeGreaterThan(8.5);
    expect(bp.city).toBeLessThan(10.5);
    expect(bp.country).toBeLessThan(computeBreakpoints(DUBAI).country);
    expect(bp.country).toBeGreaterThan(3);
  });

  it('keeps a usable Country chapter for a city-state like Singapore', () => {
    const bp = computeBreakpoints(SINGAPORE);
    expect(bp.city - bp.country).toBeGreaterThanOrEqual(1.2 - 1e-9);
    expect(bp.city).toBeGreaterThan(9);
  });

  it('falls back sensibly for an unknown country code', () => {
    const bp = computeBreakpoints({ ...LONDON, countryCode: 'ZZ' });
    expect(bp.country).toBeGreaterThan(2);
    expect(bp.country).toBeLessThan(bp.city);
  });

  it('chapterForZoom splits exactly at the breakpoints', () => {
    for (const home of [DUBAI, LONDON, SINGAPORE]) {
      const bp = computeBreakpoints(home);
      expect(chapterForZoom(bp.city, bp)).toBe('city');
      expect(chapterForZoom(bp.city - 0.01, bp)).toBe('country');
      expect(chapterForZoom(bp.country, bp)).toBe('country');
      expect(chapterForZoom(bp.country - 0.01, bp)).toBe('world');
      expect(chapterForZoom(18, bp)).toBe('city');
      expect(chapterForZoom(0, bp)).toBe('world');
    }
  });
});

describe('framing', () => {
  it('frames every chapter inside its own zoom range', () => {
    for (const home of [DUBAI, LONDON, SINGAPORE]) {
      const bp = computeBreakpoints(home);
      for (const vp of [PHONE, { width: 1440, height: 820 }]) {
        expect(chapterForZoom(framingFor('city', home, bp, vp).zoom, bp)).toBe('city');
        expect(chapterForZoom(framingFor('country', home, bp, vp).zoom, bp)).toBe('country');
        expect(chapterForZoom(framingFor('world', home, bp, vp).zoom, bp)).toBe('world');
      }
    }
  });

  it('pitches the city and looks straight at the globe', () => {
    const bp = computeBreakpoints(DUBAI);
    expect(framingFor('city', DUBAI, bp, PHONE).pitch).toBeGreaterThanOrEqual(50);
    expect(framingFor('world', DUBAI, bp, PHONE)).toMatchObject({ pitch: 0, bearing: 0 });
    expect(framingFor('city', DUBAI, bp, PHONE).center).toEqual([DUBAI.lng, DUBAI.lat]);
  });

  it('fitZoom grows by one per halving of the bbox', () => {
    const a = fitZoom([0, 0, 10, 10]);
    const b = fitZoom([0, 0, 5, 5]);
    expect(b - a).toBeCloseTo(1, 1);
  });

  it('globeZoom scales with the viewport', () => {
    expect(globeZoom({ width: 1440, height: 900 })).toBeGreaterThan(globeZoom(PHONE));
  });
});

describe('titles', () => {
  it('uses the home base names on the board', () => {
    expect(chapterTitle('city', DUBAI)).toBe('DUBAI');
    expect(chapterTitle('country', DUBAI)).toBe('UNITED ARAB EMIRATES');
    expect(chapterTitle('world', DUBAI)).toBe('THE WORLD');
    expect(chapterTitle('country', LONDON)).toBe('UNITED KINGDOM');
  });

  it('flapText strips accents and punctuation', () => {
    expect(flapText('Türkiye')).toBe('TURKIYE');
    expect(flapText('Çırağan')).toBe('CIRAGAN');
    expect(flapText("Côte d'Ivoire")).toBe('COTE D IVOIRE');
  });
});

describe('settle', () => {
  const bp = computeBreakpoints(DUBAI);
  it('does nothing away from breakpoints', () => {
    expect(settleTarget(bp.city + 2, bp)).toBeNull();
    expect(settleTarget((bp.city + bp.country) / 2, bp)).toBeNull();
  });
  it('eases into the chapter the gesture ended in', () => {
    const inCity = settleTarget(bp.city + 0.1, bp)!;
    expect(inCity.chapter).toBe('city');
    expect(inCity.zoom).toBeGreaterThan(bp.city + SETTLE_RANGE);
    expect(inCity.pitch).toBe(55);
    const inCountry = settleTarget(bp.city - 0.1, bp)!;
    expect(inCountry.chapter).toBe('country');
    expect(inCountry.zoom).toBeLessThan(bp.city - SETTLE_RANGE);
    const inWorld = settleTarget(bp.country - 0.2, bp)!;
    expect(inWorld.chapter).toBe('world');
    expect(inWorld.pitch).toBe(0);
  });
});

it('onVisibleHemisphere hides the far side of the globe', () => {
  expect(onVisibleHemisphere({ lat: 25, lng: 55 }, { lat: 41, lng: 29 })).toBe(true);
  expect(onVisibleHemisphere({ lat: 25, lng: 55 }, { lat: -25, lng: -125 })).toBe(false);
});
