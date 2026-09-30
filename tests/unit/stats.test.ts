import { describe, expect, it } from 'vitest';
import type { HomeBase, Stay } from '@/data/types';
import { haversineKm } from '@/lib/geo';
import {
  awaitingRating,
  cities,
  countries,
  countriesAbroad,
  farthestFromHome,
  favouriteStay,
  firstStay,
  hotelCount,
  hoursTogether,
  kmTravelled,
  latestStay,
  longestStay,
  mostRevisited,
  stayHours,
  summary,
  visitCount,
  whosePicksRateHigher,
} from '@/lib/stats';
import { makeHotel, makeStay, makeVisit } from './factories';

const HOME: Pick<HomeBase, 'countryCode'> & { lat: number; lng: number } = {
  countryCode: 'AE',
  lat: 25.2048,
  lng: 55.2708,
};

describe('stayHours', () => {
  it('counts a day stay from check-in/out', () => {
    expect(stayHours({ check_in: '14:00', check_out: '20:00', nights: 0 })).toBe(6);
  });
  it('counts an overnight stay including nights', () => {
    expect(stayHours({ check_in: '15:00', check_out: '12:00', nights: 1 })).toBe(21);
  });
  it('falls back to nights * 24 when times are missing', () => {
    expect(stayHours({ check_in: null, check_out: null, nights: 2 })).toBe(48);
  });
  it('handles a day stay that crosses midnight', () => {
    expect(stayHours({ check_in: '20:00', check_out: '01:00', nights: 0 })).toBe(5);
  });
});

describe('stays fixture', () => {
  const golden = makeHotel({ hotel_id: 'H1', name: 'Golden Tulip', city: 'Dubai', country_code: 'AE', lat: 25.11276, lng: 55.190071 });
  const atlantis = makeHotel({ hotel_id: 'H2', name: 'Atlantis', city: 'Dubai', country_code: 'AE', lat: 25.137842, lng: 55.127337 });
  const chedi = makeHotel({ hotel_id: 'H3', name: 'The Chedi Muscat', city: 'Muscat', country_code: 'OM', lat: 23.602373, lng: 58.399289 });

  const v1 = makeVisit(golden, {
    visit_id: 'V1',
    date: '2026-06-19',
    check_in: '14:00',
    check_out: '20:00',
    nights: 0,
    rating_nirsh: 5,
    rating_shady: 5,
    picked_by: 'nirsh',
  });
  const v2 = makeVisit(atlantis, {
    visit_id: 'V2',
    date: '2026-06-27',
    check_in: '15:00',
    check_out: '12:00',
    nights: 1,
    rating_nirsh: 4,
    rating_shady: 5,
    picked_by: 'shady',
  });
  const v3 = makeVisit(golden, {
    visit_id: 'V3',
    date: '2026-07-19',
    check_in: null,
    check_out: null,
    nights: 2,
    rating_nirsh: null,
    rating_shady: 4,
    picked_by: 'nirsh',
  });
  const v4 = makeVisit(chedi, {
    visit_id: 'V4',
    date: '2026-08-14',
    check_in: '20:00',
    check_out: '01:00',
    nights: 0,
    rating_nirsh: 5,
    rating_shady: null,
    picked_by: 'both',
  });
  const v5Deleted = makeVisit(golden, {
    visit_id: 'V5',
    date: '2026-09-01',
    rating_nirsh: 1,
    rating_shady: 1,
    deleted: true,
  });

  const stays: Stay[] = [
    makeStay(golden, v1),
    makeStay(atlantis, v2),
    makeStay(golden, v3),
    makeStay(chedi, v4),
    makeStay(golden, v5Deleted),
  ];

  it('hoursTogether sums stayHours over live stays only', () => {
    expect(hoursTogether(stays)).toBe(6 + 21 + 48 + 5);
  });

  it('hotelCount counts distinct hotels; visitCount counts live visits (deleted ignored)', () => {
    expect(hotelCount(stays)).toBe(3);
    expect(visitCount(stays)).toBe(4);
  });

  it('cities lists distinct hotel cities among live stays', () => {
    expect(cities(stays).sort()).toEqual(['Dubai', 'Muscat']);
  });

  it('countries / countriesAbroad', () => {
    expect(countries(stays).sort()).toEqual(['AE', 'OM']);
    expect(countriesAbroad(stays, { countryCode: 'AE' })).toEqual(['OM']);
  });

  it('kmTravelled sums the chronological path including home as the starting point', () => {
    const expected =
      haversineKm(HOME, { lat: golden.lat, lng: golden.lng }) +
      haversineKm({ lat: golden.lat, lng: golden.lng }, { lat: atlantis.lat, lng: atlantis.lng }) +
      haversineKm({ lat: atlantis.lat, lng: atlantis.lng }, { lat: golden.lat, lng: golden.lng }) +
      haversineKm({ lat: golden.lat, lng: golden.lng }, { lat: chedi.lat, lng: chedi.lng });
    expect(kmTravelled(stays, HOME)).toBeCloseTo(expected, 6);
  });

  it('farthestFromHome picks the hotel furthest away', () => {
    const result = farthestFromHome(stays, HOME);
    expect(result?.stay.hotel.hotel_id).toBe('H3');
  });

  it('longestStay picks the stay with the most hours', () => {
    const result = longestStay(stays);
    expect(result?.stay.visit.visit_id).toBe('V3');
    expect(result?.hours).toBe(48);
  });

  it('mostRevisited finds the hotel with 2+ visits', () => {
    const result = mostRevisited(stays);
    expect(result).toEqual({ hotelId: 'H1', name: 'Golden Tulip', visits: 2 });
  });

  it('mostRevisited is null when no hotel has a revisit', () => {
    const noRevisit: Stay[] = [makeStay(golden, v1), makeStay(atlantis, v2), makeStay(chedi, v4)];
    expect(mostRevisited(noRevisit)).toBeNull();
  });

  it('firstStay / latestStay pick the chronological ends (ignoring deleted)', () => {
    expect(firstStay(stays)?.visit.visit_id).toBe('V1');
    expect(latestStay(stays)?.visit.visit_id).toBe('V4');
  });

  it('favouriteStay picks the highest average rating, ties going to the more recent stay', () => {
    // v1 avg 5, v2 avg 4.5, v3 avg 4, v4 avg 5 (only nirsh rated) -> tie between v1 & v4, v4 wins.
    expect(favouriteStay(stays)?.visit.visit_id).toBe('V4');
  });

  it('whosePicksRateHigher computes per-person averages and a winner', () => {
    const result = whosePicksRateHigher(stays);
    expect(result.nirsh.picks).toBe(2); // v1, v3
    expect(result.shady.picks).toBe(1); // v2
    expect(result.nirsh.average).toBeCloseTo((5 + 5 + 4) / 3, 6);
    expect(result.shady.average).toBeCloseTo((4 + 5) / 2, 6);
    expect(result.winner).toBe('nirsh');
  });

  it('whosePicksRateHigher returns a null winner on a tie', () => {
    const a = makeHotel({ hotel_id: 'TA' });
    const b = makeHotel({ hotel_id: 'TB' });
    const tieStays: Stay[] = [
      makeStay(a, makeVisit(a, { rating_nirsh: 5, rating_shady: 5, picked_by: 'nirsh' })),
      makeStay(b, makeVisit(b, { rating_nirsh: 5, rating_shady: 5, picked_by: 'shady' })),
    ];
    expect(whosePicksRateHigher(tieStays).winner).toBeNull();
  });

  it('awaitingRating lists stays missing that person’s rating', () => {
    expect(awaitingRating(stays, 'nirsh').map((s) => s.visit.visit_id)).toEqual(['V3']);
    expect(awaitingRating(stays, 'shady').map((s) => s.visit.visit_id)).toEqual(['V4']);
  });

  it('summary rolls everything up', () => {
    const s = summary(stays, HOME);
    expect(s.hotels).toBe(3);
    expect(s.visits).toBe(4);
    expect(s.hours).toBe(Math.round(6 + 21 + 48 + 5));
    expect(s.cities).toBe(2);
    expect(s.countries).toBe(2);
    expect(s.km).toBe(Math.round(kmTravelled(stays, HOME)));
  });
});
