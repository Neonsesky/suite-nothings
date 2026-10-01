import { describe, expect, it } from 'vitest';
import { coverTransform } from './overlay';

describe('coverTransform', () => {
  it('fits a wider source by height and crops the sides', () => {
    const t = coverTransform(1000, 1000, 1080, 1920);
    expect(t.scale).toBeCloseTo(1.92);
    expect(t.dy).toBeCloseTo(0);
    expect(t.dx).toBeCloseTo((1080 - 1920) / 2);
  });

  it('fits a taller source by width and crops top and bottom', () => {
    const t = coverTransform(400, 1000, 1080, 1920);
    expect(t.scale).toBeCloseTo(2.7);
    expect(t.dx).toBeCloseTo(0);
    expect(t.dy).toBeCloseTo((1920 - 2700) / 2);
  });

  it('maps a same-aspect source exactly', () => {
    expect(coverTransform(540, 960, 1080, 1920)).toEqual({ scale: 2, dx: 0, dy: 0 });
  });

  it('keeps the source centre at the output centre', () => {
    const t = coverTransform(390, 844, 1080, 1920);
    expect(195 * t.scale + t.dx).toBeCloseTo(540);
    expect(422 * t.scale + t.dy).toBeCloseTo(960);
  });

  it('is an identity for an empty source', () => {
    expect(coverTransform(0, 0, 1080, 1920)).toEqual({ scale: 1, dx: 0, dy: 0 });
  });
});
