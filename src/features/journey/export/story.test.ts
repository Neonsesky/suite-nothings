import { describe, expect, it } from 'vitest';
import { projectStops } from './story';

const box = { x: 40, y: 100, w: 800, h: 600 };
const inside = (p: { x: number; y: number }) =>
  p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;

const europe = [
  { lat: 51.5, lng: -0.12 }, // London
  { lat: 48.86, lng: 2.35 }, // Paris
  { lat: 41.9, lng: 12.5 }, // Rome
  { lat: 38.72, lng: -9.14 }, // Lisbon
  { lat: 25.2, lng: 55.27 }, // Dubai
];

describe('projectStops', () => {
  it('returns nothing for no points', () => {
    expect(projectStops([], box)).toEqual([]);
  });

  it('keeps every point inside the box', () => {
    const out = projectStops(europe, box);
    expect(out).toHaveLength(europe.length);
    for (const p of out) expect(inside(p)).toBe(true);
  });

  it('keeps north up and east right', () => {
    const [london, paris, rome] = projectStops(europe, box);
    expect(rome.x).toBeGreaterThan(paris.x);
    expect(london.y).toBeLessThan(rome.y);
  });

  it('keeps the aspect: one scale for both axes', () => {
    const a = projectStops([{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 0 }], box);
    const dx = a[1].x - a[0].x;
    const dy = a[0].y - a[2].y;
    const mercDy = Math.log(Math.tan(Math.PI / 4 + (10 * Math.PI) / 360));
    const mercDx = (10 * Math.PI) / 180;
    expect(dy / dx).toBeCloseTo(mercDy / mercDx, 6);
  });

  it('fits the limiting axis and centres the other', () => {
    const out = projectStops([{ lat: 0, lng: -10 }, { lat: 0, lng: 10 }], box);
    expect(out[0].y).toBeCloseTo(box.y + box.h / 2);
    expect((out[0].x + out[1].x) / 2).toBeCloseTo(box.x + box.w / 2);
    expect(out[1].x - out[0].x).toBeLessThan(box.w);
  });

  it('centres a single point', () => {
    expect(projectStops([{ lat: 25.2, lng: 55.27 }], box)).toEqual([{ x: box.x + box.w / 2, y: box.y + box.h / 2 }]);
  });

  it('centres repeated identical points', () => {
    const p = { lat: 1, lng: 2 };
    for (const q of projectStops([p, p, p], box)) expect(q).toEqual({ x: 440, y: 400 });
  });

  it('keeps antimeridian neighbours together instead of spreading them across the map', () => {
    const fiji = [
      { lat: -17.7, lng: 178.0 },
      { lat: -18.1, lng: -179.2 },
      { lat: -40.0, lng: 175.0 },
      { lat: -37.0, lng: 177.5 },
    ];
    // the same shape shifted 10° west, nowhere near the antimeridian
    const shifted = fiji.map((p) => ({ lat: p.lat, lng: p.lng > 0 ? p.lng - 10 : p.lng + 350 }));
    const a = projectStops(fiji, box);
    const b = projectStops(shifted, box);
    a.forEach((p, i) => {
      expect(p.x).toBeCloseTo(b[i].x, 6);
      expect(p.y).toBeCloseTo(b[i].y, 6);
    });
    // -179.2 sits just east of 178, not at the far left
    expect(a[1].x).toBeGreaterThan(a[0].x);
    expect(a[1].x - a[0].x).toBeLessThan(box.w / 2);
  });

  it('keeps two points straddling ±180 close to each other in the middle', () => {
    const out = projectStops([{ lat: 10, lng: 179 }, { lat: 20, lng: -179 }, { lat: 60, lng: 179.5 }], box);
    for (const p of out) expect(inside(p)).toBe(true);
    expect(Math.abs(out[1].x - out[0].x)).toBeLessThan(box.w * 0.25);
  });
});
