import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/data/seed';
import { buildStays } from '@/data/stays';
import { aggregate, bubbleIconId, neighbours, requiredImages, stayIconId, WISH_ICON, HOME_ICON } from '@/map/pins';
import { tilesFor, PREWARM_MAX_TILES } from '@/map/prewarm';
import { groupForList } from '@/features/map/MapList';

const seed = buildSeed(null);
const stays = buildStays(seed.visits, new Map(seed.hotels.map((h) => [h.hotel_id, h])), seed.photos);
const home = seed.settings.home_base!;

describe('aggregate', () => {
  const agg = aggregate(stays, seed.wishes, home);

  it('makes one pin per hotel with a revisit count', () => {
    expect(agg.pins.features).toHaveLength(seed.hotels.length);
    const tulip = agg.pins.features.find((f) => f.properties.name === 'Golden Tulip Al Barsha')!;
    expect(tulip.properties.count).toBe(2);
    expect(tulip.properties.icon).toBe(stayIconId(2, tulip.properties.favourite));
    expect(tulip.properties.label).toContain('2 visits');
    // The pin opens the latest visit.
    const latest = stays.filter((s) => s.hotel.hotel_id === tulip.properties.hotelId).at(-1)!;
    expect(tulip.properties.visitId).toBe(latest.visit.visit_id);
  });

  it('bubbles by city and by country, counting visits', () => {
    const total = stays.filter((s) => !s.visit.deleted).length;
    const sum = (fs: { properties: { count: number } }[]) => fs.reduce((a, f) => a + f.properties.count, 0);
    expect(sum(agg.cities.features)).toBe(total);
    expect(sum(agg.countries.features)).toBe(total);
    expect(agg.countries.features.map((f) => f.properties.key).sort()).toEqual(['AE', 'OM', 'TR']);
    const dubai = agg.cities.features.find((f) => f.properties.key === 'AE|Dubai')!;
    expect(dubai.properties.icon).toBe(bubbleIconId(dubai.properties.count));
    const [lng, lat] = dubai.geometry.coordinates;
    expect(lng).toBeGreaterThan(55);
    expect(lng).toBeLessThan(55.4);
    expect(lat).toBeGreaterThan(25);
  });

  it('links consecutive stays with great-circle arcs, skipping same-hotel hops', () => {
    expect(agg.arcs.features.length).toBeGreaterThan(5);
    expect(agg.arcs.features.length).toBeLessThan(stays.length);
    for (const f of agg.arcs.features) expect(f.geometry.coordinates.length).toBeGreaterThan(2);
  });

  it('adds open wishes and the home marker', () => {
    expect(agg.wishes.features).toHaveLength(seed.wishes.length);
    expect(agg.home.features[0].properties.icon).toBe(HOME_ICON);
  });

  it('ignores deleted visits', () => {
    const deleted = stays.map((s, i) => (i === 0 ? { ...s, visit: { ...s.visit, deleted: true } } : s));
    const a = aggregate(deleted, [], home);
    const sum = a.countries.features.reduce((n, f) => n + f.properties.count, 0);
    expect(sum).toBe(stays.length - 1);
  });

  it('lists every image it needs', () => {
    const ids = [...requiredImages(agg).keys()];
    for (const f of agg.pins.features) expect(ids).toContain(f.properties.icon);
    for (const f of agg.countries.features) expect(ids).toContain(f.properties.icon);
    expect(ids).toContain(WISH_ICON);
  });

  it('finds the nearest neighbours of a pin', () => {
    const tulip = agg.pins.features.find((f) => f.properties.name === 'Golden Tulip Al Barsha')!;
    const n = neighbours(agg, tulip.properties.hotelId, 3);
    expect(n).toHaveLength(3);
    expect(n.map((p) => p.city)).toEqual(['Dubai', 'Dubai', 'Dubai']);
    expect(n.some((p) => p.hotelId === tulip.properties.hotelId)).toBe(false);
  });
});

describe('list grouping', () => {
  it('groups by chapter, then city', () => {
    const groups = groupForList(stays, home);
    expect(groups.map((g) => g.title)).toEqual(['Dubai', 'United Arab Emirates', 'The world']);
    expect(groups[2].cities.map((c) => c.city).sort()).toEqual(['Istanbul', 'Muscat']);
    expect(groups[1].cities.map((c) => c.city)).toContain('Sharjah');
  });
});

describe('prewarm tiles', () => {
  it('covers z9–14, lowest zoom first, capped at 300', () => {
    const tiles = tilesFor(home.bbox!, home);
    expect(tiles.length).toBe(PREWARM_MAX_TILES);
    expect(tiles[0].z).toBe(9);
    for (let i = 1; i < tiles.length; i++) expect(tiles[i].z).toBeGreaterThanOrEqual(tiles[i - 1].z);
    expect(new Set(tiles.map((t) => `${t.z}/${t.x}/${t.y}`)).size).toBe(tiles.length);
  });
});
