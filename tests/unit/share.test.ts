import { describe, expect, it } from 'vitest';
import {
  balanceLines,
  clusterOf,
  clusterPoints,
  coverFit,
  ellipsize,
  fitProjection,
  fitText,
  mixHex,
  placeRect,
  rectsOverlap,
  resolveCssVars,
  routeCaption,
  routeLegs,
  slugify,
  statsCaption,
  stayCaption,
  wrapText,
} from '@/features/share/layout';

const charWidth = (text: string) => text.length * 10;

describe('share card captions (design/copy.md §12)', () => {
  it('builds the stay postcard caption', () => {
    expect(stayCaption(3, 12, 'Burj Al Arab', '2026-07-19')).toBe('Stay 3 of 12: Burj Al Arab, 19 Jul 2026');
  });
  it('builds the stats card caption with correct pluralisation', () => {
    expect(statsCaption({ hotels: 1, cities: 1, countries: 2 })).toBe('1 hotel, 1 city, 2 countries together');
    expect(statsCaption({ hotels: 11, cities: 6, countries: 3 })).toBe('11 hotels, 6 cities, 3 countries together');
  });
  it('builds the route caption', () => {
    expect(routeCaption(7090, 11)).toBe('Our journey so far: 7,090 km, 11 hotels');
    expect(routeCaption(12, 1)).toBe('Our journey so far: 12 km, 1 hotel');
  });
});

describe('slugify', () => {
  it('folds accents and punctuation into a file-name-safe slug', () => {
    expect(slugify('Çırağan Palace Kempinski')).toBe('ciragan-palace-kempinski');
    expect(slugify("Nirsh & Shady's Hotel!!")).toBe('nirsh-shady-s-hotel');
  });
  it('falls back to "card" for an empty result', () => {
    expect(slugify('***')).toBe('card');
  });
});

describe('text fitting', () => {
  it('wraps greedily and gives a lone wide word its own line', () => {
    expect(wrapText('a short line of words', 1000, charWidth)).toEqual(['a short line of words']);
    expect(wrapText('one two three four', 90, charWidth)).toEqual(['one two', 'three', 'four']);
  });
  it('ellipsizes to fit', () => {
    expect(ellipsize('hello', 1000, charWidth)).toBe('hello');
    expect(ellipsize('hello world', 60, charWidth)).toBe('hello…');
  });
  it('picks the largest size that fits within maxLines and width', () => {
    const measureAt = (size: number) => (text: string) => text.length * size;
    const r = fitText('short headline', { maxWidth: 200, maxLines: 2, sizes: [40, 24, 16] }, measureAt);
    // "short headline" is 14 chars: at 40px/char a single word still overflows 200px, so it drops
    // down to 24px (6 chars × 24 = 144 fits one line; both words together don't, so it wraps to 2).
    expect(r.size).toBe(24);
    expect(r.truncated).toBe(false);
    expect(r.lines.length).toBeLessThanOrEqual(2);
  });
  it('truncates at the smallest size when nothing fits', () => {
    const measureAt = () => (text: string) => text.length * 1000;
    const r = fitText('way too long for any size', { maxWidth: 50, maxLines: 1, sizes: [40, 24] }, measureAt);
    expect(r.truncated).toBe(true);
    expect(r.size).toBe(24);
    expect(r.lines).toHaveLength(1);
  });
  it('balances two lines more evenly', () => {
    const lines = ['Our journey so', 'far'];
    const balanced = balanceLines(lines, charWidth);
    const widest = Math.max(...balanced.map(charWidth));
    expect(widest).toBeLessThanOrEqual(Math.max(...lines.map(charWidth)));
  });
  it('leaves a single line alone', () => {
    expect(balanceLines(['one line'], charWidth)).toEqual(['one line']);
  });
});

describe('cover fit', () => {
  it('centres a crop that covers the destination box', () => {
    expect(coverFit(1000, 500, 200, 200)).toMatchObject({ sx: 250, sy: 0, sw: 500, sh: 500 });
    expect(coverFit(400, 1000, 200, 200)).toMatchObject({ sx: 0, sy: 300, sw: 400, sh: 400 });
  });
});

describe('route projection and layout', () => {
  it('fits points to a box with padding, flipping latitude to screen y', () => {
    const proj = fitProjection(
      [
        { lat: 25.2, lng: 55.3 },
        { lat: 41.0, lng: 29.0 },
      ],
      { x: 0, y: 0, w: 1000, h: 1000 },
      40,
    );
    const south = proj.project({ lat: 25.2, lng: 55.3 });
    const north = proj.project({ lat: 41.0, lng: 29.0 });
    expect(north.y).toBeLessThan(south.y);
    expect(south.x).toBeGreaterThan(north.x);
  });
  it('grows a single point to the minimum span instead of zooming to the street', () => {
    const proj = fitProjection([{ lat: 25.2, lng: 55.3 }], { x: 0, y: 0, w: 500, h: 500 }, 20, 0.1);
    expect(proj.spanLat).toBeGreaterThanOrEqual(0.1);
  });

  it('clusters nearby points and tracks membership', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 2, y: 1 },
      { x: 500, y: 500 },
    ];
    const clusters = clusterPoints(pts, 10);
    expect(clusters).toHaveLength(2);
    expect(clusterOf(clusters, 3)).toEqual([0, 0, 1]);
  });

  it('bows route legs on alternating sides', () => {
    const legs = routeLegs([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
    ]);
    expect(legs).toHaveLength(2);
    expect(legs[0].cp.y).not.toBe(0);
    expect(Math.sign(legs[0].cp.y)).not.toBe(Math.sign(legs[1].cp.y));
  });

  it('places a label rect that avoids overlap, else returns null', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 100 };
    const taken = [{ x: 0, y: 0, w: 50, h: 50 }];
    const candidates = [
      { x: 0, y: 0, w: 50, h: 50 },
      { x: 60, y: 60, w: 30, h: 30 },
    ];
    expect(placeRect(candidates, taken, bounds)).toEqual(candidates[1]);
    expect(placeRect([candidates[0]], taken, bounds)).toBeNull();
  });
  it('detects rect overlap with a gap', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 })).toBe(false);
  });
});

describe('css var resolution for rasterised svg', () => {
  it('replaces var() with tokens, honouring fallbacks and nesting', () => {
    const tokens = { 'color-ink': '#292935' };
    expect(resolveCssVars('fill="var(--color-ink)"', tokens)).toBe('fill="#292935"');
    expect(resolveCssVars('fill="var(--missing, #ffffff)"', tokens)).toBe('fill="#ffffff"');
    expect(resolveCssVars('fill="var(--missing)"', tokens)).toBe('fill="currentColor"');
  });
  it('resolves color-mix to a flat hex', () => {
    expect(mixHex('#000000', 50, '#ffffff')).toBe('#808080');
    expect(resolveCssVars('color-mix(in srgb, #000000 50%, #ffffff)', {})).toBe('#808080');
  });
});
