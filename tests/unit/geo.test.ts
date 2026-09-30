import { describe, expect, it } from 'vitest';
import {
  bbox,
  bearing,
  classifyLeg,
  formatKm,
  greatCircle,
  inBBox,
  interpolateGreatCircle,
  haversineKm,
  kmToMiles,
  legs,
  padBBox,
  pathKm,
  type LatLng,
} from '@/lib/geo';

const DUBAI: LatLng = { lat: 25.2048, lng: 55.2708 };
const ABU_DHABI: LatLng = { lat: 24.4539, lng: 54.3773 };

describe('haversineKm', () => {
  it('measures Dubai to Abu Dhabi at roughly 125km', () => {
    expect(haversineKm(DUBAI, ABU_DHABI)).toBeGreaterThan(115);
    expect(haversineKm(DUBAI, ABU_DHABI)).toBeLessThan(135);
  });
  it('is zero for the same point', () => {
    expect(haversineKm(DUBAI, DUBAI)).toBe(0);
  });
});

describe('classifyLeg', () => {
  it('classifies below the glide threshold as glide', () => {
    expect(classifyLeg(29.9)).toBe('glide');
  });
  it('classifies exactly the glide threshold as hop', () => {
    expect(classifyLeg(30)).toBe('hop');
  });
  it('classifies just under the hop threshold as hop', () => {
    expect(classifyLeg(399)).toBe('hop');
  });
  it('classifies exactly the hop threshold as flight', () => {
    expect(classifyLeg(400)).toBe('flight');
  });
});

describe('bearing', () => {
  it('is ~0 due north', () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 1);
  });
  it('is ~90 due east', () => {
    expect(bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 1);
  });
});

describe('interpolateGreatCircle', () => {
  it('returns the start point at t=0', () => {
    const p = interpolateGreatCircle(DUBAI, ABU_DHABI, 0);
    expect(p.lat).toBeCloseTo(DUBAI.lat, 6);
    expect(p.lng).toBeCloseTo(DUBAI.lng, 6);
  });
  it('returns the end point at t=1', () => {
    const p = interpolateGreatCircle(DUBAI, ABU_DHABI, 1);
    expect(p.lat).toBeCloseTo(ABU_DHABI.lat, 6);
    expect(p.lng).toBeCloseTo(ABU_DHABI.lng, 6);
  });
  it('returns a midpoint between two symmetric points on the equator', () => {
    const p = interpolateGreatCircle({ lat: 0, lng: -10 }, { lat: 0, lng: 10 }, 0.5);
    expect(p.lat).toBeCloseTo(0, 6);
    expect(p.lng).toBeCloseTo(0, 6);
  });
});

describe('greatCircle', () => {
  it('returns steps + 1 points', () => {
    expect(greatCircle(DUBAI, ABU_DHABI, 10)).toHaveLength(11);
  });
  it('never jumps more than 180 degrees of longitude across the antimeridian', () => {
    const a: LatLng = { lat: 0, lng: 170 };
    const b: LatLng = { lat: 0, lng: -170 };
    const pts = greatCircle(a, b, 8);
    for (let i = 1; i < pts.length; i++) {
      expect(Math.abs(pts[i].lng - pts[i - 1].lng)).toBeLessThanOrEqual(180);
    }
    // The path should progress monotonically past 180 rather than snapping back to -170.
    expect(pts[pts.length - 1].lng).toBeCloseTo(190, 0);
  });
});

describe('bbox / padBBox / inBBox', () => {
  it('is null for an empty list', () => {
    expect(bbox([])).toBeNull();
  });
  it('bounds a set of points', () => {
    expect(bbox([DUBAI, ABU_DHABI])).toEqual([
      Math.min(DUBAI.lng, ABU_DHABI.lng),
      Math.min(DUBAI.lat, ABU_DHABI.lat),
      Math.max(DUBAI.lng, ABU_DHABI.lng),
      Math.max(DUBAI.lat, ABU_DHABI.lat),
    ]);
  });
  it('padBBox grows every side', () => {
    const box = bbox([DUBAI, ABU_DHABI])!;
    const padded = padBBox(box, 50);
    expect(padded[0]).toBeLessThan(box[0]);
    expect(padded[1]).toBeLessThan(box[1]);
    expect(padded[2]).toBeGreaterThan(box[2]);
    expect(padded[3]).toBeGreaterThan(box[3]);
  });
  it('inBBox reports containment', () => {
    const box = padBBox(bbox([DUBAI, ABU_DHABI])!, 5);
    expect(inBBox(DUBAI, box)).toBe(true);
    expect(inBBox({ lat: 0, lng: 0 }, box)).toBe(false);
  });
});

describe('legs / pathKm', () => {
  it('builds consecutive legs with style and bearing', () => {
    const l = legs([DUBAI, ABU_DHABI]);
    expect(l).toHaveLength(1);
    expect(l[0].km).toBeCloseTo(haversineKm(DUBAI, ABU_DHABI), 6);
    expect(l[0].style).toBe('hop');
  });
  it('sums leg distances for the total path', () => {
    const points = [DUBAI, ABU_DHABI, DUBAI];
    expect(pathKm(points)).toBeCloseTo(2 * haversineKm(DUBAI, ABU_DHABI), 6);
  });
});

describe('formatKm', () => {
  it('shows one decimal under 10 km', () => {
    expect(formatKm(3.44)).toBe('3.4 km');
  });
  it('rounds to a whole number at 10km and above', () => {
    expect(formatKm(12.4)).toBe('12 km');
  });
  it('converts to miles', () => {
    expect(formatKm(100, 'mi')).toBe(`${Math.round(kmToMiles(100))} mi`);
  });
});
