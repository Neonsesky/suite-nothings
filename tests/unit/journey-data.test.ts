import { describe, expect, it } from 'vitest';
import type { HomeBase } from '@/data/types';
import { boardDate, finaleStats, journeyStays, monthTicks, postcardLine } from '@/features/journey/data';
import { makeHotel, makeStay, makeVisit } from './factories';

const HOME: HomeBase = { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', lat: 25.2048, lng: 55.2708 };

const golden = makeHotel({ hotel_id: 'H1', name: 'Golden Tulip', city: 'Dubai', country_code: 'AE', lat: 25.11276, lng: 55.190071 });
const chedi = makeHotel({ hotel_id: 'H2', name: 'The Chedi Muscat', city: 'Muscat', country: 'Oman', country_code: 'OM', lat: 23.602373, lng: 58.399289 });

const stay1 = makeStay(golden, makeVisit(golden, { visit_id: 'V1', date: '2026-06-19' }), { stayNumber: 1 });
const stay2 = makeStay(chedi, makeVisit(chedi, { visit_id: 'V2', date: '2026-08-14' }), { stayNumber: 2 });
const stay3 = makeStay(golden, makeVisit(golden, { visit_id: 'V3', date: '2026-09-19', deleted: false }), { stayNumber: 3, visitNumber: 2 });
const deletedStay = makeStay(golden, makeVisit(golden, { visit_id: 'V4', date: '2026-07-01', deleted: true }), { stayNumber: 4 });

describe('journeyStays', () => {
  const all = [stay3, stay1, deletedStay, stay2]; // out of order, on purpose

  it('drops deleted visits and sorts chronologically', () => {
    expect(journeyStays(all, 'all', HOME, '2026-10-01').map((s) => s.visit.visit_id)).toEqual(['V1', 'V2', 'V3']);
  });

  it('filters to the given year', () => {
    expect(journeyStays(all, 'year', HOME, '2026-10-01').map((s) => s.visit.visit_id)).toEqual(['V1', 'V2', 'V3']);
    expect(journeyStays(all, 'year', HOME, '2027-01-01').map((s) => s.visit.visit_id)).toEqual([]);
  });

  it('filters to the home city', () => {
    expect(journeyStays(all, 'home', HOME, '2026-10-01').map((s) => s.visit.visit_id)).toEqual(['V1', 'V3']);
  });
});

describe('boardDate', () => {
  it('formats and upper-cases', () => {
    expect(boardDate('2026-06-19')).toBe('19 JUN 2026');
  });
  it('pads a single-digit day so the board keeps its width', () => {
    expect(boardDate('2026-06-01')).toHaveLength(11);
  });
});

describe('monthTicks', () => {
  it('ticks once per month at the first arrival, not every stop', () => {
    const stops = [stay1, stay2, stay3]; // Jun, Aug, Sep
    const stopTimes = [10, 40, 70];
    const ticks = monthTicks(stops, stopTimes, 100);
    expect(ticks).toEqual([
      { at: 0.1, label: 'Jun' },
      { at: 0.4, label: 'Aug' },
      { at: 0.7, label: 'Sep' },
    ]);
  });

  it('returns nothing for a zero-length timeline', () => {
    expect(monthTicks([stay1], [0], 0)).toEqual([]);
  });
});

describe('finaleStats', () => {
  it('counts hotels, cities and countries, and the km travelled from home', () => {
    const stats = finaleStats([stay1, stay2, stay3], HOME);
    expect(stats).toEqual({ hotels: 2, cities: 2, countries: 2, km: expect.any(Number) });
    expect(stats.km).toBeGreaterThan(0);
  });

  it('is zero without a home base to measure from', () => {
    expect(finaleStats([stay1]).km).toBe(0);
  });
});

describe('postcardLine', () => {
  it('prefers the favourite moment over the note', () => {
    const s = makeStay(golden, makeVisit(golden, { favourite_moment: 'The sunset.', note: 'A long note instead.' }));
    expect(postcardLine(s)).toBe('The sunset.');
  });

  it('falls back to the note’s first sentence', () => {
    const s = makeStay(golden, makeVisit(golden, { note: 'We got lost. Then we found the pool.' }));
    expect(postcardLine(s)).toBe('We got lost.');
  });

  it('returns null with nothing to quote', () => {
    const s = makeStay(golden, makeVisit(golden, { note: null, favourite_moment: null }));
    expect(postcardLine(s)).toBeNull();
  });

  it('trims an overlong sentence at a word boundary with an ellipsis', () => {
    const long = 'A'.repeat(50) + ' ' + 'b'.repeat(50) + '.';
    const s = makeStay(golden, makeVisit(golden, { note: long }));
    const line = postcardLine(s, 90);
    expect(line!.length).toBeLessThanOrEqual(91);
    expect(line!.endsWith('…')).toBe(true);
  });
});
