import { describe, expect, it } from 'vitest';
import type { Hotel, Wish } from '@/data/types';
import { agoLabel, anniversary, anniversaryCopy, onThisDay } from '@/features/moments/logic';
import { formatScore, pickBoard } from '@/features/us/logic';
import { hotelChoiceForWish } from '@/features/wishlist/convert';
import { flapText, openWishes, pickSurprise } from '@/features/wishlist/logic';
import { makeHotel, makeStay, makeVisit } from './factories';

const HOME = { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', lat: 25.2, lng: 55.27 };

function stay(date: string, v: Parameters<typeof makeVisit>[1] = {}, h: Partial<Hotel> = {}) {
  const hotel = makeHotel(h);
  return makeStay(hotel, makeVisit(hotel, { date, ...v }));
}

function wish(o: Partial<Wish> = {}): Wish {
  return {
    wish_id: o.wish_id ?? `w${Math.random()}`,
    name: 'Rooftop Hotel',
    lat: 24.4,
    lng: 54.4,
    city: 'Abu Dhabi',
    country: 'United Arab Emirates',
    note: null,
    added_by: 'shady',
    priority: 2,
    fulfilled_visit_id: null,
    created_at: '2026-08-01T10:00:00.000Z',
    updated_at: '2026-08-01T10:00:00.000Z',
    deleted: false,
    ...o,
  };
}

describe('pick score', () => {
  it('names the leader with both averages', () => {
    const b = pickBoard([
      stay('2026-07-01', { picked_by: 'nirsh', rating_nirsh: 4, rating_shady: 4 }),
      stay('2026-07-02', { picked_by: 'shady', rating_nirsh: 5, rating_shady: 4 }),
    ]);
    expect(b.state).toBe('leader');
    expect(b.line).toBe("Shady's picks average 4.5, Nirsh's average 4.0.");
    expect(b.rows.find((r) => r.person === 'shady')).toMatchObject({ leader: true, fill: 0.9, picks: 1 });
  });
  it('calls a tie when the shown scores match', () => {
    const b = pickBoard([
      stay('2026-07-01', { picked_by: 'nirsh', rating_nirsh: 4, rating_shady: 5 }),
      stay('2026-07-02', { picked_by: 'shady', rating_nirsh: 5, rating_shady: 4 }),
    ]);
    expect(b.state).toBe('tie');
    expect(b.line).toBe('Dead even. You both pick well.');
  });
  it('asks for ratings when there are none', () => {
    expect(pickBoard([stay('2026-07-01', { picked_by: 'both', rating_nirsh: null, rating_shady: null })]).state).toBe('empty');
  });
  it('formats one decimal', () => {
    expect(formatScore(4)).toBe('4.0');
    expect(formatScore(4.333)).toBe('4.3');
  });
});

describe('on this day', () => {
  it('finds the same day in earlier months and years, years first', () => {
    const r = onThisDay(
      [stay('2026-08-01', {}, { name: 'B' }), stay('2025-10-01', {}, { name: 'Y' }), stay('2026-09-01', {}, { name: 'A' }), stay('2026-09-02'), stay('2026-10-01')],
      '2026-10-01',
    );
    expect(r.map((m) => [m.stay.hotel.name, m.when])).toEqual([
      ['Y', '1 year ago today'],
      ['A', '1 month ago today'],
      ['B', '2 months ago today'],
    ]);
  });
  it('ignores deleted stays and today', () => {
    expect(onThisDay([stay('2026-09-01', { deleted: true }), stay('2026-10-01')], '2026-10-01')).toEqual([]);
  });
  it('labels', () => {
    expect(agoLabel(24)).toBe('2 years ago today');
    expect(agoLabel(3)).toBe('3 months ago today');
  });
});

describe('monthly anniversary', () => {
  it('uses the copy from design/copy.md', () => {
    expect(anniversaryCopy(4, 15)).toEqual({ title: '4 months together', body: '4 months together, 15 hotels in.' });
    expect(anniversaryCopy(12, 1).body).toBe('1 year together, 1 hotel in.');
  });
  it('is today on the 19th and counts hotels up to that day', () => {
    const a = anniversary([stay('2026-09-01'), stay('2026-10-19'), stay('2026-10-20')], '2026-10-19', new Date('2026-10-19T12:00:00Z'));
    expect(a).toMatchObject({ months: 4, isToday: true, hotels: 2, body: '4 months together, 2 hotels in.' });
  });
  it('falls back to the last one, or nothing before our first month', () => {
    expect(anniversary([], '2026-10-01', new Date('2026-10-01T08:00:00Z'))).toMatchObject({ months: 3, date: '2026-09-19', isToday: false });
    expect(anniversary([], '2026-10-01', new Date('2026-10-01T08:00:00Z'), false)).toBeNull();
    expect(anniversary([], '2026-07-01', new Date('2026-07-01T08:00:00Z'))).toBeNull();
  });
});

describe('wishlist', () => {
  it('surprise skips the previous pick and fulfilled wishes', () => {
    const a = wish({ wish_id: 'a' });
    const b = wish({ wish_id: 'b' });
    const c = wish({ wish_id: 'c', fulfilled_visit_id: 'v1' });
    for (const r of [0, 0.5, 0.99]) expect(pickSurprise([a, b, c], 'a', () => r)?.wish_id).toBe('b');
    expect(pickSurprise([a], 'a')?.wish_id).toBe('a');
    expect(pickSurprise([c])).toBeNull();
  });
  it('weights top priority double', () => {
    const top = wish({ wish_id: 'top', priority: 1 });
    const other = wish({ wish_id: 'other', priority: 3 });
    expect(pickSurprise([top, other], null, () => 0.6)?.wish_id).toBe('top');
    expect(pickSurprise([top, other], null, () => 0.7)?.wish_id).toBe('other');
  });
  it('orders open wishes by priority', () => {
    expect(openWishes([wish({ wish_id: 'x', priority: 3 }), wish({ wish_id: 'y', priority: 1 }), wish({ wish_id: 'z', deleted: true })]).map((w) => w.wish_id)).toEqual(['y', 'x']);
  });
  it('makes flap-safe board text', () => {
    expect(flapText('Café & Spa Résidence')).toBe('CAFE SPA');
    expect(flapText('Atlantis')).toBe('ATLANTIS');
  });
  it('converts a wish into a hotel choice', () => {
    const existing = makeHotel({ name: 'Rooftop  Hotel', city: 'Abu Dhabi' });
    expect(hotelChoiceForWish(wish(), [existing], HOME)).toEqual({ kind: 'existing', hotel_id: existing.hotel_id });
    const fresh = hotelChoiceForWish(wish({ country: 'Oman', city: 'Muscat' }), [], HOME);
    expect(fresh).toMatchObject({ kind: 'new', hotel: { name: 'Rooftop Hotel', country_code: 'OM', lat: 24.4, source: 'wishlist' } });
    expect(hotelChoiceForWish(wish({ lat: null, lng: null }), [], HOME)).toBeNull();
  });
});
