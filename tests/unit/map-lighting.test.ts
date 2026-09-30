import { describe, expect, it } from 'vitest';
import {
  LIGHTING_REFRESH_MS,
  lookFor,
  phaseAt,
  phaseForSun,
  resolvePhase,
  solarPosition,
  type LightingPhase,
} from '@/map/lighting';

const DUBAI = { lat: 25.2048, lng: 55.2708 };
const LONDON = { lat: 51.5074, lng: -0.1278 };
const SINGAPORE = { lat: 1.3521, lng: 103.8198 };
const PHASES: LightingPhase[] = ['dawn', 'day', 'golden', 'sunset', 'night'];

const at = (iso: string, p = DUBAI) => solarPosition(new Date(iso), p.lat, p.lng);
const phase = (iso: string, p = DUBAI) => phaseAt(new Date(iso), p.lat, p.lng);

/** First minute (UTC ISO) in [from, from + 24h) where the sun crosses the −0.833° horizon in the given direction. */
function crossing(fromIso: string, p: { lat: number; lng: number }, rising: boolean): string {
  const start = Date.parse(fromIso);
  let prev = solarPosition(new Date(start), p.lat, p.lng).altitude;
  for (let m = 1; m < 1440; m++) {
    const t = new Date(start + m * 60_000);
    const alt = solarPosition(t, p.lat, p.lng).altitude;
    if (rising ? prev < -0.833 && alt >= -0.833 : prev >= -0.833 && alt < -0.833) return t.toISOString();
    prev = alt;
  }
  throw new Error('no crossing');
}

const minutesBetween = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 60_000;

describe('solarPosition', () => {
  it('matches almanac sunrise/sunset for Dubai on 21 Jun 2026 (05:29 / 19:12 GST)', () => {
    const sunrise = crossing('2026-06-20T20:00:00Z', DUBAI, true);
    const sunset = crossing('2026-06-21T08:00:00Z', DUBAI, false);
    expect(minutesBetween(sunrise, '2026-06-21T01:29:00Z')).toBeLessThanOrEqual(3);
    expect(minutesBetween(sunset, '2026-06-21T15:12:00Z')).toBeLessThanOrEqual(3);
  });

  it('puts the Dubai midsummer midday sun near the zenith', () => {
    expect(at('2026-06-21T08:00:00Z').altitude).toBeGreaterThan(70);
  });

  it('London winter solstice noon: low sun due south', () => {
    const sun = at('2026-12-21T12:00:00Z', LONDON);
    expect(sun.altitude).toBeCloseTo(15.05, 0);
    expect(Math.abs(sun.azimuth - 180)).toBeLessThan(2);
  });

  it('Singapore equinox local noon: sun almost overhead', () => {
    expect(at('2026-03-20T05:08:00Z', SINGAPORE).altitude).toBeGreaterThan(85);
  });

  it('rises in the east and sets in the west, azimuth within 0..360', () => {
    const morning = at('2026-06-21T02:00:00Z');
    const evening = at('2026-06-21T14:40:00Z');
    expect(morning.azimuth).toBeGreaterThan(45);
    expect(morning.azimuth).toBeLessThan(90);
    expect(evening.azimuth).toBeGreaterThan(270);
    expect(evening.azimuth).toBeLessThan(315);
    for (let h = 0; h < 24; h++) {
      const { azimuth } = at(`2026-06-21T${String(h).padStart(2, '0')}:00:00Z`);
      expect(azimuth).toBeGreaterThanOrEqual(0);
      expect(azimuth).toBeLessThan(360);
    }
  });
});

describe('phaseForSun', () => {
  it('applies the morning rules', () => {
    expect(phaseForSun({ altitude: -7, azimuth: 60 }, true)).toBe('night');
    expect(phaseForSun({ altitude: -3, azimuth: 60 }, true)).toBe('dawn');
    expect(phaseForSun({ altitude: 7.9, azimuth: 60 }, true)).toBe('dawn');
    expect(phaseForSun({ altitude: 8, azimuth: 60 }, true)).toBe('day');
  });

  it('applies the evening rules', () => {
    expect(phaseForSun({ altitude: 30, azimuth: 280 }, false)).toBe('day');
    expect(phaseForSun({ altitude: 14.9, azimuth: 280 }, false)).toBe('golden');
    expect(phaseForSun({ altitude: 4, azimuth: 280 }, false)).toBe('golden');
    expect(phaseForSun({ altitude: 3.9, azimuth: 280 }, false)).toBe('sunset');
    expect(phaseForSun({ altitude: -6, azimuth: 280 }, false)).toBe('sunset');
    expect(phaseForSun({ altitude: -6.1, azimuth: 280 }, false)).toBe('night');
  });
});

describe('phaseAt (Dubai, 21 Jun 2026)', () => {
  it.each([
    ['2026-06-21T08:00:00Z', 'day'], // 12:00 GST
    ['2026-06-21T14:40:00Z', 'golden'], // 18:40 GST, ~32 min before sunset
    ['2026-06-21T15:22:00Z', 'sunset'], // ~10 min after sunset
    ['2026-06-21T20:00:00Z', 'night'], // 00:00 GST
    ['2026-06-21T01:09:00Z', 'dawn'], // ~20 min before sunrise
    ['2026-06-21T02:00:00Z', 'dawn'], // sun low in the east
    ['2026-06-21T03:00:00Z', 'day'],
  ] as const)('%s → %s', (iso, expected) => {
    expect(phase(iso)).toBe(expected);
  });

  it('works elsewhere too', () => {
    expect(phase('2026-03-20T05:08:00Z', SINGAPORE)).toBe('day');
    expect(phase('2026-12-21T12:00:00Z', LONDON)).toBe('day');
    expect(phase('2026-12-21T22:00:00Z', LONDON)).toBe('night');
  });
});

describe('resolvePhase', () => {
  const midnight = new Date('2026-06-21T20:00:00Z');
  const noon = new Date('2026-06-21T08:00:00Z');

  it('fixed modes override the sun', () => {
    expect(resolvePhase('day', midnight, DUBAI.lat, DUBAI.lng)).toBe('day');
    expect(resolvePhase('golden', midnight, DUBAI.lat, DUBAI.lng)).toBe('golden');
    expect(resolvePhase('night', noon, DUBAI.lat, DUBAI.lng)).toBe('night');
  });

  it("'auto' follows the sun", () => {
    expect(resolvePhase('auto', noon, DUBAI.lat, DUBAI.lng)).toBe('day');
    expect(resolvePhase('auto', midnight, DUBAI.lat, DUBAI.lng)).toBe('night');
  });
});

describe('lookFor', () => {
  it('returns distinct palettes per phase', () => {
    const looks = PHASES.map((p) => lookFor(p));
    for (const key of ['buildingColor', 'landColor', 'waterColor'] as const) {
      expect(new Set(looks.map((l) => l[key])).size).toBe(PHASES.length);
    }
    expect(new Set(looks.map((l) => l.sky['sky-color'])).size).toBe(PHASES.length);
    expect(new Set(looks.map((l) => l.sky['horizon-color'])).size).toBe(PHASES.length);
    looks.forEach((l, i) => expect(l.phase).toBe(PHASES[i]));
  });

  it('keeps the light polar angle within [20, 80] and anchored to the map', () => {
    const suns = [undefined, { altitude: 89, azimuth: 120 }, { altitude: -3, azimuth: 290 }, { altitude: 40, azimuth: 200 }];
    for (const p of PHASES) {
      for (const sun of suns) {
        const { light } = lookFor(p, sun);
        expect(light.anchor).toBe('map');
        const [radial, , polar] = light.position as [number, number, number];
        expect(radial).toBe(1.15);
        expect(polar).toBeGreaterThanOrEqual(20);
        expect(polar).toBeLessThanOrEqual(80);
      }
    }
  });

  it('aims the light at the sun by day and uses a fixed moon at night', () => {
    expect(lookFor('golden', { altitude: 10, azimuth: 290 }).light.position).toEqual([1.15, 290, 80]);
    expect(lookFor('day', { altitude: 50, azimuth: 150 }).light.position).toEqual([1.15, 150, 40]);
    expect(lookFor('night', { altitude: -30, azimuth: 10 }).light.position).toEqual([1.15, 210, 60]);
  });

  it('sets intensities, label colours and HUD tone', () => {
    const intensity = Object.fromEntries(PHASES.map((p) => [p, lookFor(p).light.intensity]));
    expect(intensity).toEqual({ dawn: 0.4, day: 0.45, golden: 0.5, sunset: 0.5, night: 0.25 });
    const night = lookFor('night');
    expect(night).toMatchObject({ hudTone: 'dark', labelColor: '#E9E6F2', labelHalo: '#1E2238' });
    expect(lookFor('day')).toMatchObject({ hudTone: 'light', labelColor: '#292935', labelHalo: '#FFFFFF' });
  });

  it('only shows the atmosphere on the globe', () => {
    expect(lookFor('day').sky['atmosphere-blend']).toEqual(['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0]);
  });
});

it('refreshes every five minutes', () => {
  expect(LIGHTING_REFRESH_MS).toBe(300_000);
});
