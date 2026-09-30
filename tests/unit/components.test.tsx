import { existsSync, readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { body as letterBody } from 'virtual:private-letter';
import { pickSnap } from '@/components/BottomSheet';
import { SplitFlap, toCells } from '@/components/SplitFlap';
import { hashSeed, StayArt } from '@/components/StayArt';
import { buildSeed, DEMO_LETTER_PLACEHOLDER } from '@/data/seed';
import { matchPath, parseHash, href, matchRoute, ROUTES } from '@/app/router';

describe('SplitFlap', () => {
  it('pads numbers left and strings right', () => {
    expect(toCells(7, 3)).toEqual([' ', ' ', '7']);
    expect(toCells('AB', 4)).toEqual(['A', 'B', ' ', ' ']);
    expect(toCells('LONGER', 2)).toHaveLength(6);
  });
  it('exposes its accessible text once', () => {
    render(<SplitFlap value={12} ariaLabel="12 hotels together" />);
    expect(screen.getAllByText('12 hotels together')).toHaveLength(1);
  });
});

describe('BottomSheet pickSnap', () => {
  // two snaps: low (y=400) and high (y=0); closed at 1000
  const snaps = [400, 0];
  it('flick down from the low snap closes', () => expect(pickSnap(420, 1500, snaps, 1000)).toBe(-1));
  it('flick down from the high snap goes to the low snap', () => expect(pickSnap(20, 1500, snaps, 1000)).toBe(0));
  it('flick up goes higher', () => expect(pickSnap(380, -1500, snaps, 1000)).toBe(1));
  it('slow release picks the nearest', () => expect(pickSnap(150, 0, snaps, 1000)).toBe(1));
  it('slow release far below the low snap closes', () => expect(pickSnap(800, 0, snaps, 1000)).toBe(-1));
});

describe('StayArt', () => {
  it('is deterministic per seed', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    const a = render(<StayArt seed="hotel-1" />).container.innerHTML;
    const b = render(<StayArt seed="hotel-1" />).container.innerHTML;
    expect(a.replace(/sa-sky-[^")]+/g, '')).toBe(b.replace(/sa-sky-[^")]+/g, ''));
  });
});

describe('router', () => {
  it('parses hash paths and queries', () => {
    const loc = parseHash('#/map?city=Dubai&focus=X');
    expect(loc.path).toBe('/map');
    expect(loc.query.get('city')).toBe('Dubai');
    expect(parseHash('').path).toBe('/');
  });
  it('matches params', () => {
    expect(matchPath('/stay/:visitId', '/stay/01ABC')).toEqual({ visitId: '01ABC' });
    expect(matchRoute('/letters/abc')?.route.name).toBe('letter');
    expect(matchRoute('/nope')).toBeNull();
  });
  it('builds hrefs', () => expect(href('/map', { city: 'Abu Dhabi', x: null })).toBe('#/map?city=Abu%20Dhabi'));
  it('registers every route from the brief', () => {
    const names = ROUTES.map((r) => r.name);
    for (const n of ['stays', 'stay', 'add', 'map', 'journey', 'us', 'letters', 'letter', 'settings', 'join', 'welcome', 'wishlist']) expect(names).toContain(n);
  });
});

describe('private letter', () => {
  const file = 'private/letter.md';
  it.runIf(existsSync(file))('is seeded exactly as written', () => {
    const expected = readFileSync(file, 'utf8');
    // Compare without printing the text on failure.
    expect(letterBody === expected).toBe(true);
    expect(buildSeed().letters[0].body_md === expected).toBe(true);
  });
  it('falls back to the demo note when absent', () => {
    expect(buildSeed(null).letters[0].body_md).toBe(DEMO_LETTER_PLACEHOLDER);
  });
});
