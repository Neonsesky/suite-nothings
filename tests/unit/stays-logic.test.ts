import { describe, expect, it } from 'vitest';
import { otherPerson, personName } from '@/config/couple';
import { averageRating, buildStays } from '@/data/stays';
import type { HomeBase, Stay } from '@/data/types';
import {
  ALL_TAB,
  activeFilterCount,
  applyFilters,
  brandsList,
  buildFaq,
  cityTabs,
  filterOptions,
  HEADLINE_COPY,
  matchesQuery,
  pickHeadline,
  pickMoment,
} from '@/features/stays/logic';
import { dayNumber } from '@/lib/dates';
import { kmToMiles } from '@/lib/geo';
import { buildSeed } from '@/data/seed';
import { farthestFromHome, hotelCount, hoursTogether, whosePicksRateHigher } from '@/lib/stats';
import { makeHotel, makeStay, makeVisit } from './factories';

const HOME: Pick<HomeBase, 'countryCode' | 'lat' | 'lng'> = { countryCode: 'AE', lat: 25.2048, lng: 55.2708 };

function seedStays(): Stay[] {
  const snap = buildSeed(null);
  const hotels = new Map(snap.hotels.map((h) => [h.hotel_id, h]));
  return buildStays(snap.visits, hotels, snap.photos);
}

// ---------------------------------------------------------------------------
// headline
// ---------------------------------------------------------------------------

describe('pickHeadline', () => {
  it('is the default tagline with no live stays', () => {
    const result = pickHeadline([], { today: '2026-07-01', monthsTogether: 0 });
    expect(result).toEqual({ kind: 'default', text: HEADLINE_COPY.default });
  });

  it('ignores deleted-only stays like zero stays', () => {
    const hotel = makeHotel();
    const visit = makeVisit(hotel, { date: '2026-07-01', deleted: true });
    const result = pickHeadline([makeStay(hotel, visit)], { today: '2026-07-05', monthsTogether: 0 });
    expect(result.kind).toBe('default');
  });

  it('prefers an explicit milestone over everything else', () => {
    const hotel = makeHotel();
    const visit = makeVisit(hotel, { date: '2026-07-01' });
    const result = pickHeadline([makeStay(hotel, visit)], { today: '2026-07-19', monthsTogether: 3, milestoneHotels: 10 });
    expect(result).toEqual({ kind: 'byMilestone', text: "Hotel number 10. We're keeping count." });
  });

  it('celebrates a monthly anniversary window (day 18-20) ahead of a recent stay', () => {
    const hotel1 = makeHotel({ hotel_id: 'H1' });
    const hotel2 = makeHotel({ hotel_id: 'H2' });
    const stays = [makeStay(hotel1, makeVisit(hotel1, { visit_id: 'V1', date: '2026-06-19' })), makeStay(hotel2, makeVisit(hotel2, { visit_id: 'V2', date: '2026-07-18' }))];
    // "today" is also within 7 days of the latest stay, but anniversary wins.
    const result = pickHeadline(stays, { today: '2026-07-19', monthsTogether: 1 });
    expect(result).toEqual({ kind: 'byAnniversary', text: HEADLINE_COPY.byAnniversary(1, hotelCount(stays)) });
  });

  it('does not fire the anniversary branch when monthsTogether is 0', () => {
    const hotel = makeHotel();
    const visit = makeVisit(hotel, { date: '2026-06-01' });
    const result = pickHeadline([makeStay(hotel, visit)], { today: '2026-06-19', monthsTogether: 0 });
    expect(result.kind).not.toBe('byAnniversary');
  });

  it('calls out a brand-new hotel checked into within the last week', () => {
    const hotel = makeHotel({ hotel_id: 'H1', name: 'Rixos Premium Dubai JBR', city: 'Dubai' });
    const visit = makeVisit(hotel, { visit_id: 'V1', date: '2026-07-10' });
    const result = pickHeadline([makeStay(hotel, visit)], { today: '2026-07-13', monthsTogether: 0 });
    expect(result).toEqual({ kind: 'byLatest', text: 'Last stop: Rixos Premium Dubai JBR in Dubai.' });
  });

  it('calls out a revisit checked into within the last week', () => {
    const hotel = makeHotel({ hotel_id: 'H1', name: 'Golden Tulip Al Barsha' });
    const v1 = makeVisit(hotel, { visit_id: 'V1', date: '2026-06-01', created_at: '2026-06-01T00:00:00.000Z' });
    const v2 = makeVisit(hotel, { visit_id: 'V2', date: '2026-07-10', created_at: '2026-07-10T00:00:00.000Z' });
    const stays = buildStays([v1, v2], new Map([[hotel.hotel_id, hotel]]), []);
    const result = pickHeadline(stays, { today: '2026-07-13', monthsTogether: 0 });
    expect(result).toEqual({ kind: 'byLatestRevisit', text: 'Back at Golden Tulip Al Barsha. We know the way now.' });
  });

  it('falls back to the plain hotel count after a long gap since the last stay', () => {
    const hotel = makeHotel();
    const visit = makeVisit(hotel, { date: '2026-06-01' });
    const stays = [makeStay(hotel, visit)];
    const result = pickHeadline(stays, { today: '2026-07-15', monthsTogether: 0 }); // 44 days
    expect(result).toEqual({ kind: 'byCountPlain', text: HEADLINE_COPY.byCountPlain(hotelCount(stays)) });
  });

  it('alternates byCount/byCountPlain deterministically by day number outside the other windows', () => {
    const hotel = makeHotel();
    const visit = makeVisit(hotel, { date: '2026-06-20' });
    const stays = [makeStay(hotel, visit)];
    // Gap of 11-12 days: not "recent" (<=7), not "long" (>21), day-of-month not 18-20.
    const a = pickHeadline(stays, { today: '2026-07-01', monthsTogether: 0 });
    const b = pickHeadline(stays, { today: '2026-07-02', monthsTogether: 0 });
    expect(a.kind).toBe(dayNumber('2026-07-01') % 2 === 0 ? 'byCount' : 'byCountPlain');
    expect(b.kind).toBe(dayNumber('2026-07-02') % 2 === 0 ? 'byCount' : 'byCountPlain');
    expect(a.kind).not.toBe(b.kind);
  });
});

// ---------------------------------------------------------------------------
// faq
// ---------------------------------------------------------------------------

describe('buildFaq', () => {
  it('returns every question, empty, when there are no stays', () => {
    const faq = buildFaq([], HOME);
    expect(faq.map((f) => f.id)).toEqual(['firstStay', 'regular', 'farthest', 'longest', 'picks', 'hours']);
    expect(faq.every((f) => f.empty)).toBe(true);
    expect(faq.find((f) => f.id === 'firstStay')?.answer).toBe("Add our first stay and we'll remember it here.");
    expect(faq.find((f) => f.id === 'regular')?.answer).toBe('No regulars yet, one hotel just needs a second visit.');
    expect(faq.find((f) => f.id === 'farthest')?.answer).toBe('Still close to home base, so far.');
    expect(faq.find((f) => f.id === 'longest')?.answer).toBe('No overnight stays yet.');
    expect(faq.find((f) => f.id === 'picks')?.answer).toBe("Rate a few stays and we'll keep score.");
    expect(faq.find((f) => f.id === 'hours')?.answer).toBe('Add check-in and check-out times to start the clock.');
  });

  it('treats a hotel right at home as still "close to home" for the farthest FAQ', () => {
    const hotel = makeHotel({ lat: HOME.lat, lng: HOME.lng });
    const visit = makeVisit(hotel, {});
    const item = buildFaq([makeStay(hotel, visit)], HOME).find((f) => f.id === 'farthest')!;
    expect(item.empty).toBe(true);
    expect(item.answer).toBe('Still close to home base, so far.');
  });

  it('reports a day-use-only history as no overnight stays yet', () => {
    const hotel = makeHotel();
    const visit = makeVisit(hotel, { nights: 0 });
    const item = buildFaq([makeStay(hotel, visit)], HOME).find((f) => f.id === 'longest')!;
    expect(item.empty).toBe(true);
    expect(item.answer).toBe('No overnight stays yet.');
  });

  it('leaves the picks FAQ empty when only one person has rated', () => {
    const hotel = makeHotel();
    const visit = makeVisit(hotel, { rating_nirsh: 5, rating_shady: null, picked_by: 'nirsh' });
    const item = buildFaq([makeStay(hotel, visit)], HOME).find((f) => f.id === 'picks')!;
    expect(item.empty).toBe(true);
    expect(item.answer).toBe("Rate a few stays and we'll keep score.");
  });

  it('calls a tied picks score dead even', () => {
    const h1 = makeHotel({ hotel_id: 'HA' });
    const h2 = makeHotel({ hotel_id: 'HB' });
    const stays = [
      makeStay(h1, makeVisit(h1, { rating_nirsh: 5, rating_shady: 5, picked_by: 'nirsh' })),
      makeStay(h2, makeVisit(h2, { rating_nirsh: 5, rating_shady: 5, picked_by: 'shady' })),
    ];
    const item = buildFaq(stays, HOME).find((f) => f.id === 'picks')!;
    expect(item.empty).toBe(false);
    expect(item.answer).toBe('Dead even. You both pick well.');
  });

  it('names the leader when picks are not tied', () => {
    const h1 = makeHotel({ hotel_id: 'HA' });
    const h2 = makeHotel({ hotel_id: 'HB' });
    const stays = [
      makeStay(h1, makeVisit(h1, { rating_nirsh: 5, rating_shady: 5, picked_by: 'nirsh' })),
      makeStay(h2, makeVisit(h2, { rating_nirsh: 3, rating_shady: 3, picked_by: 'shady' })),
    ];
    const item = buildFaq(stays, HOME).find((f) => f.id === 'picks')!;
    const score = whosePicksRateHigher(stays);
    expect(item.answer).toBe(`${personName('nirsh')}'s picks average ${score.nirsh.average!.toFixed(1)}, ${personName('shady')}'s average ${score.shady.average!.toFixed(1)}.`);
    expect(personName(otherPerson('nirsh'))).toBe('Shady');
  });

  it('answers every question with real facts from the demo seed', () => {
    const stays = seedStays();
    const faq = buildFaq(stays, HOME);

    const first = faq.find((f) => f.id === 'firstStay')!;
    expect(first.empty).toBe(false);
    expect(first.answer).toBe('Golden Tulip Al Barsha in Dubai, on 19 Jun 2026.');

    const regular = faq.find((f) => f.id === 'regular')!;
    expect(regular.empty).toBe(false);
    expect(regular.answer).toBe('Golden Tulip Al Barsha, 2 times and counting.');

    const farthest = faq.find((f) => f.id === 'farthest')!;
    const expectedFarthest = farthestFromHome(stays, HOME)!;
    expect(farthest.empty).toBe(false);
    expect(farthest.answer).toBe(`${expectedFarthest.stay.hotel.name} in ${expectedFarthest.stay.hotel.city}, ${Math.round(expectedFarthest.km).toLocaleString('en-GB')} km from home.`);
    expect(expectedFarthest.stay.hotel.city).toBe('Istanbul');

    const farthestMiles = buildFaq(stays, HOME, 'mi').find((f) => f.id === 'farthest')!;
    expect(farthestMiles.answer).toBe(`${expectedFarthest.stay.hotel.name} in ${expectedFarthest.stay.hotel.city}, ${Math.round(kmToMiles(expectedFarthest.km)).toLocaleString('en-GB')} mi from home.`);

    const longest = faq.find((f) => f.id === 'longest')!;
    expect(longest.empty).toBe(false);
    expect(longest.answer).toBe('4 nights at Çırağan Palace Kempinski Istanbul.');

    const hours = faq.find((f) => f.id === 'hours')!;
    const expectedHours = Math.round(hoursTogether(stays));
    expect(hours.empty).toBe(false);
    expect(hours.answer).toBe(`${expectedHours.toLocaleString('en-GB')} hours, and counting.`);
  });
});

// ---------------------------------------------------------------------------
// filters
// ---------------------------------------------------------------------------

describe('cityTabs', () => {
  it('orders home-country cities by count then name, Abroad next, All last, and every stay is reachable', () => {
    const stays = seedStays();
    const tabs = cityTabs(stays, HOME);
    expect(tabs.map((t) => t.value)).toEqual(['Dubai', 'Abu Dhabi', 'Ras Al Khaimah', 'Sharjah', 'Abroad', 'All']);
    expect(tabs.find((t) => t.value === 'Dubai')?.count).toBe(7);
    expect(tabs.find((t) => t.value === 'Ras Al Khaimah')?.count).toBe(1);
    expect(tabs.find((t) => t.value === 'Abroad')?.count).toBe(2);
    expect(tabs.find((t) => t.value === 'All')?.count).toBe(stays.length);

    const tabValues = new Set(tabs.filter((t) => t.value !== ALL_TAB).map((t) => t.value));
    for (const stay of stays) {
      const reachable = stay.hotel.country_code.toUpperCase() === HOME.countryCode.toUpperCase() ? stay.hotel.city : 'Abroad';
      expect(tabValues.has(reachable)).toBe(true);
    }
  });
});

describe('filterOptions', () => {
  it('only lists values actually present in the data', () => {
    const stays = seedStays();
    const options = filterOptions(stays, HOME);
    expect(options.cities).toEqual(['Abu Dhabi', 'Dubai', 'Ras Al Khaimah', 'Sharjah', 'Abroad']);
    expect(options.years).toEqual([2026]);
    expect(options.pickedBy).toEqual(['nirsh', 'shady', 'both']);
    expect(options.types.length).toBeGreaterThan(0);
    expect(options.ratings).toEqual(options.ratings.filter((r) => [3, 4, 5].includes(r)));
  });
});

describe('applyFilters / matchesQuery / activeFilterCount', () => {
  const stays = seedStays();

  it('filters by tab, including the Abroad grouping, newest first', () => {
    const dubai = applyFilters(stays, { tab: 'Dubai' }, HOME);
    expect(dubai.length).toBe(7);
    expect(dubai.every((s) => s.hotel.city === 'Dubai')).toBe(true);
    for (let i = 1; i < dubai.length; i++) expect(dubai[i - 1]!.visit.date >= dubai[i]!.visit.date).toBe(true);

    const abroad = applyFilters(stays, { tab: 'Abroad' }, HOME);
    expect(abroad.map((s) => s.hotel.city)).toEqual(['Istanbul', 'Muscat']);

    const all = applyFilters(stays, { tab: ALL_TAB }, HOME);
    expect(all.length).toBe(stays.length);
  });

  it('filters by year', () => {
    expect(applyFilters(stays, { year: 2026 }, HOME).length).toBe(stays.length);
    expect(applyFilters(stays, { year: 2025 }, HOME).length).toBe(0);
  });

  it('filters by visit type', () => {
    const spa = applyFilters(stays, { type: 'Spa' }, HOME);
    expect(spa.length).toBe(1);
    expect(spa[0]!.hotel.name).toBe('Grosvenor House Dubai');
  });

  it('filters by minimum average rating', () => {
    const result = applyFilters(stays, { minRating: 5 }, HOME);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((s) => (averageRating(s.visit) ?? 0) >= 5)).toBe(true);
  });

  it('filters by pickedBy', () => {
    const both = applyFilters(stays, { pickedBy: 'both' }, HOME);
    expect(both.length).toBe(1);
    expect(both[0]!.hotel.name).toBe('Sheraton Sharjah Beach Resort & Spa');
  });

  it('searches notes and favourite moments via matchesQuery', () => {
    const result = applyFilters(stays, { query: 'sandcastle' }, HOME);
    expect(result.length).toBe(1);
    expect(result[0]!.hotel.name).toBe('Sheraton Sharjah Beach Resort & Spa');
    expect(matchesQuery(result[0]!, 'SUITE ONE')).toBe(true);
    expect(matchesQuery(result[0]!, 'nonexistent phrase')).toBe(false);
  });

  it('ignores deleted visits and photos are not required', () => {
    const hotel = makeHotel();
    const visit = makeVisit(hotel, { deleted: true });
    expect(applyFilters([makeStay(hotel, visit)], {}, HOME)).toEqual([]);
  });

  it('counts only the active structured filters', () => {
    expect(activeFilterCount({})).toBe(0);
    expect(activeFilterCount({ city: 'Dubai', year: 2026 })).toBe(2);
    expect(activeFilterCount({ city: null, minRating: 4, pickedBy: 'both', type: 'Spa', year: 2026 })).toBe(4);
  });
});

describe('brandsList', () => {
  it('orders brands by visit count desc then name, skipping unbranded hotels', () => {
    const stays = seedStays();
    const brands = brandsList(stays);
    expect(brands[0]).toBe('Golden Tulip'); // visited twice
    const rest = brands.slice(1);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
    expect(new Set(brands).size).toBe(brands.length);
  });

  it('skips hotels without a brand', () => {
    const branded = makeHotel({ hotel_id: 'B', brand: 'Acme' });
    const unbranded = makeHotel({ hotel_id: 'U', brand: null });
    const stays = [makeStay(branded, makeVisit(branded)), makeStay(unbranded, makeVisit(unbranded))];
    expect(brandsList(stays)).toEqual(['Acme']);
  });
});

// ---------------------------------------------------------------------------
// moments
// ---------------------------------------------------------------------------

describe('pickMoment', () => {
  it('returns null before the first month has passed and with no on-this-day match', () => {
    const hotel = makeHotel();
    const visit = makeVisit(hotel, { date: '2026-06-20' });
    const stays = [makeStay(hotel, visit)];
    const now = new Date('2026-06-25T10:00:00+04:00');
    expect(pickMoment(stays, '2026-06-25', now)).toBeNull();
  });

  it('surfaces an on-this-day memory for a stay in an earlier year', () => {
    const hotel = makeHotel({ name: 'Golden Tulip Al Barsha' });
    const visit = makeVisit(hotel, { date: '2025-07-04' });
    const stays = [makeStay(hotel, visit)];
    const now = new Date('2026-07-04T10:00:00+04:00');
    const moment = pickMoment(stays, '2026-07-04', now);
    expect(moment).toEqual({ kind: 'onThisDay', title: 'On this day', body: '1 year ago today, we checked into Golden Tulip Al Barsha.', stay: stays[0] });
  });

  it('uses plural "years" for older on-this-day memories, and prefers them over an anniversary on the same date', () => {
    const hotel = makeHotel({ name: 'Golden Tulip Al Barsha' });
    const visit = makeVisit(hotel, { date: '2024-06-19' });
    const stays = [makeStay(hotel, visit)];
    const now = new Date('2026-06-19T23:50:00+04:00');
    const moment = pickMoment(stays, '2026-06-19', now);
    expect(moment?.kind).toBe('onThisDay');
    if (moment?.kind === 'onThisDay') expect(moment.body).toBe('2 years ago today, we checked into Golden Tulip Al Barsha.');
  });

  it('flags today as the monthly anniversary and counts hotels visited so far', () => {
    const h1 = makeHotel({ hotel_id: 'H1' });
    const h2 = makeHotel({ hotel_id: 'H2' });
    const stays = [makeStay(h1, makeVisit(h1, { date: '2026-07-01' })), makeStay(h2, makeVisit(h2, { date: '2026-09-19' }))];
    const now = new Date('2026-09-19T23:50:00+04:00');
    const moment = pickMoment(stays, '2026-09-19', now);
    expect(moment).toMatchObject({ kind: 'anniversary', isToday: true, months: 3, date: '2026-09-19' });
    if (moment?.kind === 'anniversary') expect(moment.body).toBe('3 months together, 2 hotels in.');
  });

  it('reports the most recent past monthly anniversary when today is not the 19th', () => {
    const h1 = makeHotel({ hotel_id: 'H1' });
    const h2 = makeHotel({ hotel_id: 'H2' });
    const stays = [makeStay(h1, makeVisit(h1, { date: '2026-07-01' })), makeStay(h2, makeVisit(h2, { date: '2026-09-19' }))];
    const now = new Date('2026-09-25T12:00:00+04:00');
    const moment = pickMoment(stays, '2026-09-25', now);
    expect(moment).toMatchObject({ kind: 'anniversary', isToday: false, months: 3, date: '2026-09-19' });
    if (moment?.kind === 'anniversary') expect(moment.body).toBe('3 months together, 2 hotels in.');
  });

  it('excludes hotels first visited after the anniversary date from the hotel count', () => {
    const h1 = makeHotel({ hotel_id: 'H1' });
    const h2 = makeHotel({ hotel_id: 'H2' });
    const stays = [makeStay(h1, makeVisit(h1, { date: '2026-07-01' })), makeStay(h2, makeVisit(h2, { date: '2026-09-24' }))];
    const now = new Date('2026-09-25T12:00:00+04:00');
    const moment = pickMoment(stays, '2026-09-25', now);
    if (moment?.kind === 'anniversary') expect(moment.body).toBe('3 months together, 1 hotels in.');
  });
});
