import { describe, expect, it } from 'vitest';
import { classifyLeg, haversineKm, interpolateGreatCircle, type LatLng } from '@/lib/geo';
import {
  bellZoom,
  buildSchedule,
  cameraAt,
  fitCamera,
  legDuration,
  legHeight,
  lerpAngle,
  planJourney,
  planLeg,
  shortestAngleDelta,
  stopIndexAt,
  STOP_PITCH,
  STOP_ZOOM,
  type Camera,
  type LegPlan,
} from './camera';

const KM_PER_DEG = (6371.0088 * Math.PI) / 180;
/** A point `km` due north of the equator/prime meridian origin. */
const north = (km: number): LatLng => ({ lat: km / KM_PER_DEG, lng: 0 });
const ORIGIN: LatLng = { lat: 0, lng: 0 };

const DUBAI: LatLng = { lat: 25.2, lng: 55.27 };
const ISTANBUL: LatLng = { lat: 41.04, lng: 29.02 };
const HOME: LatLng = { lat: 25.2048, lng: 55.2708 };

const SEED: LatLng[] = (
  [
    [25.11276, 55.190071],
    [25.137842, 55.127337],
    [25.080085, 55.135893],
    [25.19404, 55.278912],
    [25.396074, 55.422657],
    [25.085225, 55.143718],
    [24.462386, 54.317475],
    [23.602373, 58.399289],
    [25.11276, 55.190071],
    [25.68537, 55.772719],
    [41.044444, 29.016629],
    [25.141327, 55.185397],
  ] as const
).map(([lat, lng]) => ({ lat, lng }));

function expectSameCamera(a: Camera, b: Camera) {
  expect(Math.abs(a.center[0] - b.center[0])).toBeLessThan(1e-6);
  expect(Math.abs(a.center[1] - b.center[1])).toBeLessThan(1e-6);
  expect(Math.abs(a.zoom - b.zoom)).toBeLessThan(1e-6);
  expect(Math.abs(a.pitch - b.pitch)).toBeLessThan(1e-6);
  expect(Math.abs(shortestAngleDelta(a.bearing, b.bearing))).toBeLessThan(1e-6);
}

function allNumbersFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allNumbersFinite);
  if (value && typeof value === 'object') return Object.values(value).every(allNumbersFinite);
  return true;
}

describe('leg classification and duration', () => {
  it.each([
    [29.9, 'glide', 2.5, 3.5],
    [30.001, 'hop', 4, 5],
    [399, 'hop', 4, 5],
    [400.001, 'flight', 6, 7],
    [8000, 'flight', 6, 7],
  ] as const)('%s km is a %s lasting %s–%s s', (km, style, lo, hi) => {
    const leg = planLeg(ORIGIN, north(km), { index: 0 });
    expect(leg.km).toBeCloseTo(km, 6);
    expect(leg.style).toBe(style);
    expect(leg.duration).toBeGreaterThanOrEqual(lo);
    expect(leg.duration).toBeLessThanOrEqual(hi);
  });

  it('switches style exactly at 30 km and 400 km', () => {
    expect(classifyLeg(30)).toBe('hop');
    expect(classifyLeg(400)).toBe('flight');
    expect(legDuration('glide', 0)).toBe(2.5);
    expect(legDuration('glide', 30)).toBe(3.5);
    expect(legDuration('hop', 30)).toBe(4);
    expect(legDuration('hop', 400)).toBe(5);
    expect(legDuration('flight', 400)).toBe(6);
    expect(legDuration('flight', 8000)).toBeCloseTo(7, 9);
    expect(legDuration('flight', 20000)).toBe(7);
  });
});

describe('great-circle centre', () => {
  it('starts at from and ends at to', () => {
    const leg = planLeg(DUBAI, ISTANBUL, { index: 0 });
    const a = cameraAt(leg, 0);
    const b = cameraAt(leg, 1);
    expect(a.camera.center[0]).toBeCloseTo(DUBAI.lng, 9);
    expect(a.camera.center[1]).toBeCloseTo(DUBAI.lat, 9);
    expect(b.camera.center[0]).toBeCloseTo(ISTANBUL.lng, 9);
    expect(b.camera.center[1]).toBeCloseTo(ISTANBUL.lat, 9);
    expect(a.lineProgress).toBe(0);
    expect(b.lineProgress).toBeCloseTo(1, 9);
    expect(b.position).toEqual(b.camera.center);
  });

  it('follows the great circle, not the naive lat/lng midpoint', () => {
    const leg = planLeg(DUBAI, ISTANBUL, { index: 0 });
    expect(leg.style).toBe('flight');
    const mid = cameraAt(leg, 0.5);
    expect(mid.centreFrac).toBeCloseTo(0.5, 6); // symmetric bell => halfway at half time
    const gc = interpolateGreatCircle(DUBAI, ISTANBUL, mid.centreFrac);
    expect(mid.camera.center[0]).toBeCloseTo(gc.lng, 9);
    expect(mid.camera.center[1]).toBeCloseTo(gc.lat, 9);
    const naive = { lat: (DUBAI.lat + ISTANBUL.lat) / 2, lng: (DUBAI.lng + ISTANBUL.lng) / 2 };
    expect(haversineKm(naive, { lat: mid.camera.center[1], lng: mid.camera.center[0] })).toBeGreaterThan(20);
  });

  it('crosses the antimeridian without longitude jumps', () => {
    const leg = planLeg({ lat: 35, lng: 170 }, { lat: 35, lng: -170 }, { index: 0 });
    for (let i = 1; i < leg.path.length; i++) {
      expect(Math.abs(leg.path[i][0] - leg.path[i - 1][0])).toBeLessThan(5);
    }
    let prev = cameraAt(leg, 0).camera.center[0];
    for (let i = 1; i <= 100; i++) {
      const lng = cameraAt(leg, i / 100).camera.center[0];
      expect(Math.abs(lng - prev)).toBeLessThan(5);
      prev = lng;
    }
  });

  it('builds a monotonic centre LUT from 0 to 1 that rises before travelling on a flight', () => {
    const leg = planLeg(DUBAI, ISTANBUL, { index: 0 });
    expect(leg.centreLUT).toHaveLength(129);
    expect(leg.centreLUT[0]).toBe(0);
    expect(leg.centreLUT[128]).toBe(1);
    for (let i = 1; i < leg.centreLUT.length; i++) expect(leg.centreLUT[i]).toBeGreaterThanOrEqual(leg.centreLUT[i - 1]);
    expect(leg.centreLUT[32]).toBeLessThan(0.25);
    // easeInOutSine(1/3) = 0.25
    expect(cameraAt(leg, 1 / 3).centreFrac).toBeLessThan(0.25);
  });
});

describe('bellZoom', () => {
  it('hits both ends and dips by exactly h at the middle', () => {
    expect(bellZoom(13, 11, 4, 0)).toBe(13);
    expect(bellZoom(13, 11, 4, 1)).toBeCloseTo(11, 12);
    expect(bellZoom(13, 11, 4, 0.5)).toBeCloseTo(12 - 4, 12);
    expect(12 - bellZoom(13, 11, 4, 0.5)).toBeCloseTo(4, 12);
  });
});

describe('angles', () => {
  it('takes the short way across ±180', () => {
    expect(shortestAngleDelta(170, -170)).toBeCloseTo(20, 12);
    expect(shortestAngleDelta(-170, 170)).toBeCloseTo(-20, 12);
    expect(shortestAngleDelta(0, 180)).toBe(180);
    expect(Math.abs(lerpAngle(170, -170, 0.5))).toBeCloseTo(180, 12);
    expect(lerpAngle(170, -170, 0.25)).toBeCloseTo(175, 12);
    expect(lerpAngle(170, -170, 0.75)).toBeCloseTo(-175, 12);
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(0, 12);
  });
});

describe('legHeight', () => {
  const lat = 25;
  const vw = 390;
  it('keeps glides low', () => {
    for (const km of [0, 1, 10, 29.9]) expect(legHeight('glide', 13, 13, km, lat, vw)).toBeLessThanOrEqual(1.3);
  });
  it('lifts hops to a country view', () => {
    for (const km of [30, 125, 399]) {
      const peak = STOP_ZOOM - legHeight('hop', 13, 13, km, lat, vw);
      expect(peak).toBeGreaterThanOrEqual(5.5);
      expect(peak).toBeLessThanOrEqual(9.5);
    }
  });
  it('lifts flights to a globe view', () => {
    for (const km of [400, 2900, 12000]) expect(STOP_ZOOM - legHeight('flight', 13, 13, km, lat, vw)).toBeLessThanOrEqual(4);
  });
});

describe('planJourney', () => {
  const stops: LatLng[] = [
    { lat: 25.11276, lng: 55.190071 },
    { lat: 25.137842, lng: 55.127337 },
    { lat: 24.462386, lng: 54.317475 },
    { lat: 41.044444, lng: 29.016629 },
  ];

  it('is continuous at every boundary, opening through finale', () => {
    const plan = planJourney(stops, { home: HOME, startBearing: 30 });
    const chain = [plan.opening, ...plan.legs, plan.finale].filter((l): l is LegPlan => l !== null);
    expect(chain).toHaveLength(5);
    expect(chain.map((l) => l.style)).toEqual(['flight', 'glide', 'hop', 'flight', 'flight']);
    expect(cameraAt(chain[0], 0).camera.bearing).toBeCloseTo(30, 9);
    for (let i = 1; i < chain.length; i++) expectSameCamera(cameraAt(chain[i - 1], 1).camera, cameraAt(chain[i], 0).camera);
    const stopCam = cameraAt(plan.legs[0], 0).camera;
    expect(stopCam.zoom).toBeCloseTo(STOP_ZOOM, 9);
    expect(stopCam.pitch).toBeCloseTo(STOP_PITCH, 9);
    expectSameCamera(cameraAt(chain[chain.length - 1], 1).camera, plan.finaleCamera!);
  });

  it('is continuous across the antimeridian', () => {
    const plan = planJourney([{ lat: 35, lng: 170 }, { lat: 35, lng: -170 }, { lat: 36, lng: -160 }], {});
    const chain = [plan.opening!, ...plan.legs, plan.finale!];
    for (let i = 1; i < chain.length; i++) expectSameCamera(cameraAt(chain[i - 1], 1).camera, cameraAt(chain[i], 0).camera);
  });

  it('produces no NaN for duplicate consecutive stops', () => {
    const plan = planJourney([stops[0], stops[0], stops[1], stops[1]], { home: HOME });
    const dup = plan.legs[0];
    expect(dup.km).toBe(0);
    expect(dup.style).toBe('glide');
    expect(dup.duration).toBe(2.5);
    expect(dup.path).toHaveLength(2);
    expect(allNumbersFinite(plan)).toBe(true);
    for (const leg of [plan.opening!, ...plan.legs, plan.finale!]) {
      for (let i = 0; i <= 20; i++) expect(allNumbersFinite(cameraAt(leg, i / 20))).toBe(true);
    }
    expect(allNumbersFinite(buildSchedule(plan))).toBe(true);
  });

  it('handles empty and single-stop journeys', () => {
    const empty = planJourney([]);
    expect(empty).toEqual({ opening: null, legs: [], finale: null, finaleCamera: null });
    expect(buildSchedule(empty)).toEqual({ segments: [], total: 0, stopTimes: [] });
    const one = planJourney([stops[0]]);
    expect(one.legs).toHaveLength(0);
    expect(allNumbersFinite(one)).toBe(true);
    expect(buildSchedule(one).segments.map((s) => s.kind)).toEqual(['opening', 'hold', 'finale']);
  });
});

describe('fitCamera', () => {
  it('centres across the antimeridian and clamps zoom', () => {
    const cam = fitCamera([{ lat: 0, lng: 170 }, { lat: 0, lng: -170 }], 390, 844);
    expect(Math.abs(cam.center[0])).toBeCloseTo(180, 9);
    expect(cam.zoom).toBeGreaterThanOrEqual(1.2);
    expect(fitCamera([HOME], 390, 844).zoom).toBe(STOP_ZOOM);
    expect(fitCamera([{ lat: 60, lng: -170 }, { lat: -50, lng: 10 }], 390, 844).zoom).toBe(1.2);
  });
});

describe('seed timeline', () => {
  const plan = planJourney(SEED, { home: HOME });
  const schedule = buildSchedule(plan);

  it('adds up and uses all three leg styles', () => {
    const sum = schedule.segments.reduce((s, seg) => s + seg.duration, 0);
    expect(schedule.total).toBeCloseTo(sum, 9);
    for (let i = 1; i < schedule.segments.length; i++) {
      const prev = schedule.segments[i - 1];
      expect(schedule.segments[i].start).toBeCloseTo(prev.start + prev.duration, 9);
    }
    expect(new Set(plan.legs.map((l) => l.style))).toEqual(new Set(['glide', 'hop', 'flight']));
    expect(schedule.stopTimes).toHaveLength(SEED.length);
    // Seed total at 1x: 85.15 s (85.1518).
    expect(schedule.total).toBeCloseTo(85.15, 1);
    expect(schedule.total).toBeGreaterThanOrEqual(60);
    expect(schedule.total).toBeLessThanOrEqual(120);
  });

  it('reports the last stop reached', () => {
    expect(stopIndexAt(schedule, 0)).toBe(-1);
    expect(stopIndexAt(schedule, schedule.stopTimes[0] - 0.01)).toBe(-1);
    expect(stopIndexAt(schedule, schedule.stopTimes[0])).toBe(0);
    expect(stopIndexAt(schedule, schedule.stopTimes[3] + 0.5)).toBe(3);
    expect(stopIndexAt(schedule, schedule.total)).toBe(SEED.length - 1);
  });
});
