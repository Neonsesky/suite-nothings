import { describe, expect, it } from 'vitest';
import { buildSeed, DEMO_LETTER_PLACEHOLDER } from '@/data/seed';
import type { Snapshot } from '@/data/types';
import { legs, type LatLng } from '@/lib/geo';
import { isUlid } from '@/lib/ulid';

function seedSuite(label: string, build: () => Snapshot): void {
  describe(label, () => {
    it('has non-decreasing visit dates within the demo window', () => {
      const snap = build();
      const dates = snap.visits.map((v) => v.date);
      for (let i = 1; i < dates.length; i++) expect(dates[i]! >= dates[i - 1]!).toBe(true);
      for (const d of dates) {
        expect(d >= '2026-06-19').toBe(true);
        expect(d <= '2026-09-30').toBe(true);
      }
    });

    it('starts with the Golden Tulip Al Barsha Dayuse on 2026-06-19', () => {
      const snap = build();
      const first = snap.visits[0]!;
      expect(first.date).toBe('2026-06-19');
      expect(first.booked_via).toBe('Dayuse');
      const hotel = snap.hotels.find((h) => h.hotel_id === first.hotel_id);
      expect(hotel?.name).toBe('Golden Tulip Al Barsha');
    });

    it('gives every hotel finite coordinates and a non-empty osm_id', () => {
      const snap = build();
      for (const h of snap.hotels) {
        expect(Number.isFinite(h.lat)).toBe(true);
        expect(Number.isFinite(h.lng)).toBe(true);
        expect(h.lat).toBeGreaterThanOrEqual(-90);
        expect(h.lat).toBeLessThanOrEqual(90);
        expect(h.lng).toBeGreaterThanOrEqual(-180);
        expect(h.lng).toBeLessThanOrEqual(180);
        expect(h.osm_id).toBeTruthy();
      }
    });

    it('points every visit at a hotel that exists', () => {
      const snap = build();
      const hotelIds = new Set(snap.hotels.map((h) => h.hotel_id));
      for (const v of snap.visits) expect(hotelIds.has(v.hotel_id)).toBe(true);
    });

    it('has exactly one hotel with 2+ visits', () => {
      const snap = build();
      const counts = new Map<string, number>();
      for (const v of snap.visits) counts.set(v.hotel_id, (counts.get(v.hotel_id) ?? 0) + 1);
      const revisited = [...counts.values()].filter((n) => n >= 2);
      expect(revisited).toHaveLength(1);
    });

    it('gives every row a valid, unique ULID', () => {
      const snap = build();
      const ids = [
        ...snap.hotels.map((h) => h.hotel_id),
        ...snap.visits.map((v) => v.visit_id),
        ...snap.wishes.map((w) => w.wish_id),
        ...snap.letters.map((l) => l.letter_id),
      ];
      for (const id of ids) expect(isUlid(id)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('includes a letter from nirsh to shady, always unlocked', () => {
      const snap = build();
      const letter = snap.letters[0]!;
      expect(letter.from).toBe('nirsh');
      expect(letter.to).toBe('shady');
      expect(letter.unlock_rule).toBe('always');
      expect(letter.title).toBe('A note on your pillow');
    });

    it('covers at least 2 countries other than AE', () => {
      const snap = build();
      const abroad = new Set(snap.hotels.map((h) => h.country_code.toUpperCase()).filter((c) => c !== 'AE'));
      expect(abroad.size).toBeGreaterThanOrEqual(2);
    });

    it('includes the expected Dubai areas and other-emirate cities', () => {
      const snap = build();
      const areas = new Set(snap.hotels.map((h) => h.area));
      const cities = new Set(snap.hotels.map((h) => h.city));
      for (const a of ['Dubai Marina', 'Downtown Dubai', 'JBR', 'Palm Jumeirah', 'Al Barsha']) expect(areas.has(a)).toBe(true);
      for (const c of ['Sharjah', 'Abu Dhabi', 'Ras Al Khaimah']) expect(cities.has(c)).toBe(true);
    });

    it('produces legs across all three journey styles in visit order', () => {
      const snap = build();
      const hotelsById = new Map(snap.hotels.map((h) => [h.hotel_id, h]));
      const points: LatLng[] = snap.visits.map((v) => {
        const h = hotelsById.get(v.hotel_id)!;
        return { lat: h.lat, lng: h.lng };
      });
      const styles = new Set(legs(points).map((l) => l.style));
      expect(styles.has('glide')).toBe(true);
      expect(styles.has('hop')).toBe(true);
      expect(styles.has('flight')).toBe(true);
    });
  });
}

seedSuite('buildSeed(null)', () => buildSeed(null));
seedSuite("buildSeed('x')", () => buildSeed('x'));

describe('buildSeed letter body', () => {
  it('defaults to the demo placeholder when letterBody is null', () => {
    expect(buildSeed(null).letters[0]!.body_md).toBe(DEMO_LETTER_PLACEHOLDER);
  });
  it('uses the given body verbatim otherwise', () => {
    expect(buildSeed('x').letters[0]!.body_md).toBe('x');
  });
});
