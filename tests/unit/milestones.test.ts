import { describe, expect, it } from 'vitest';
import type { Hotel, Letter, Stay, Visit } from '@/data/types';
import {
  allMilestones,
  checkMilestones,
  MILESTONE_DEFS,
  MILESTONE_IDS,
  milestoneDefs,
  milestoneToast,
  type MilestoneId,
} from '@/features/milestones/engine';
import { newlyUnlockedLetters } from '@/features/milestones/letters';
import { addDays } from '@/lib/dates';
import { makeHotel, makeStay, makeVisit } from './factories';

const HOME = { city: 'Dubai', countryCode: 'AE', lat: 25.2048, lng: 55.2708 };

/** One stay per call; dates default to a non-anniversary day. */
function stay(hotel: Hotel, date: string, v: Partial<Visit> = {}): Stay {
  return makeStay(hotel, makeVisit(hotel, { date, created_at: `${date}T10:00:00.000Z`, ...v }));
}
const ids = (ms: { id: MilestoneId }[]) => ms.map((m) => m.id);
const dubai = (name = 'Dubai Hotel', o: Partial<Hotel> = {}) => makeHotel({ name, ...o });

function shuffle<T>(xs: readonly T[], seed: number): T[] {
  const a = xs.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

describe('catalogue', () => {
  it('has all 12 milestones in display order with filled copy', () => {
    expect(MILESTONE_DEFS.map((d) => d.id)).toEqual(MILESTONE_IDS);
    expect(MILESTONE_DEFS).toHaveLength(12);
    const outside = MILESTONE_DEFS.find((d) => d.id === 'first-outside-home-city')!;
    expect(outside.name).toBe('First stay outside Dubai');
    expect(outside.locked).toBe('Unlocks the first time we stay outside Dubai');
    for (const d of MILESTONE_DEFS) {
      expect(d.short.length).toBeGreaterThan(0);
      expect(d.short.length).toBeLessThanOrEqual(4);
      expect(d.tone).toBe('ginger');
      expect(d.name).not.toMatch(/[{}]/);
    }
  });
  it('fills the home city from options', () => {
    expect(milestoneDefs({ home: { ...HOME, city: 'Abu Dhabi' } }).find((d) => d.id === 'first-outside-home-city')!.name).toBe(
      'First stay outside Abu Dhabi',
    );
  });
});

describe('rules', () => {
  it('first stay', () => {
    const h = dubai();
    const s = stay(h, '2026-07-02');
    const [m] = checkMilestones([s], [], { home: HOME });
    expect(m).toMatchObject({ id: 'first-stay', title: 'First stay', caption: 'Every room starts somewhere.', visitId: s.visit.visit_id, achievedOn: '2026-07-02' });
  });

  it.each([5, 10, 25, 50, 100])('%i unique hotels, credited to the stay that reached it', (n) => {
    const stays = Array.from({ length: n + 2 }, (_, i) => stay(dubai(`H${i}`), addDays('2026-07-01', i), { visit_id: `V${String(i).padStart(3, '0')}` }));
    // Two revisits do not add hotels.
    stays.push(stay(stays[0].hotel, '2027-01-02'), stay(stays[1].hotel, '2027-01-03'));
    const m = allMilestones(stays, { home: HOME }).find((x) => x.id === `hotels-${n}`)!;
    expect(m.visitId).toBe(`V${String(n - 1).padStart(3, '0')}`);
    expect(m.title).toBe(`${n} hotels`);
  });

  it('does not reach 5 hotels with 4 hotels and many visits', () => {
    const hs = [1, 2, 3, 4].map((i) => dubai(`H${i}`));
    const stays = hs.flatMap((h, i) => [stay(h, `2026-07-0${i + 1}`), stay(h, `2026-08-0${i + 1}`)]);
    expect(ids(allMilestones(stays, { home: HOME }))).not.toContain('hotels-5');
  });

  it('first stay outside the home city: by city name, case-insensitive', () => {
    const inside = stay(dubai('A', { city: '  dubai ' }), '2026-07-01');
    const sharjah = stay(makeHotel({ name: 'Sharjah Inn', city: 'Sharjah', lat: 25.3463, lng: 55.4209 }), '2026-07-02');
    const ms = allMilestones([sharjah, inside], { home: HOME });
    const m = ms.find((x) => x.id === 'first-outside-home-city')!;
    expect(m.visitId).toBe(sharjah.visit.visit_id);
    expect(m.title).toBe('First stay outside Dubai');
    expect(m.caption).toBe('First stay outside Dubai. The map just got bigger.');
    expect(ids(ms)).not.toContain('first-abroad');
  });

  it('first stay outside the home city: blank city falls back to distance', () => {
    const near = stay(makeHotel({ city: '', lat: 25.1, lng: 55.2 }), '2026-07-01');
    expect(ids(allMilestones([near], { home: HOME }))).not.toContain('first-outside-home-city');
    const far = stay(makeHotel({ city: '', lat: 24.4539, lng: 54.3773 }), '2026-07-02'); // Abu Dhabi, ~120 km
    expect(ids(allMilestones([near, far], { home: HOME }))).toContain('first-outside-home-city');
  });

  it('first stay abroad, with the country name', () => {
    const home = stay(dubai(), '2026-07-01');
    const oman = stay(makeHotel({ name: 'Muscat Bay', city: 'Muscat', country: 'Oman', country_code: 'om', lat: 23.6, lng: 58.5 }), '2026-08-01');
    const ms = allMilestones([home, oman], { home: HOME });
    const m = ms.find((x) => x.id === 'first-abroad')!;
    expect(m).toMatchObject({ visitId: oman.visit.visit_id, caption: 'First stay abroad, in Oman.', detail: 'Oman' });
    expect(milestoneToast(m)).toBe('First stay abroad, in Oman.');
    // Abroad is also outside the home city.
    expect(ms.find((x) => x.id === 'first-outside-home-city')!.visitId).toBe(oman.visit.visit_id);
  });

  it('three stays in one calendar month, but not across a month boundary', () => {
    const h = [1, 2, 3, 4].map((i) => dubai(`H${i}`));
    const spread = [stay(h[0], '2026-07-28'), stay(h[1], '2026-07-30'), stay(h[2], '2026-08-01')];
    expect(ids(allMilestones(spread, { home: HOME }))).not.toContain('three-in-a-month');
    const third = stay(h[3], '2026-08-12');
    expect(ids(allMilestones([...spread, third], { home: HOME }))).not.toContain('three-in-a-month');
    const fourth = stay(h[3], '2026-08-25');
    const m = allMilestones([...spread, third, fourth], { home: HOME }).find((x) => x.id === 'three-in-a-month')!;
    expect(m.visitId).toBe(fourth.visit.visit_id);
  });

  it('a stay on the monthly anniversary (the 19th, after we met)', () => {
    const h = dubai();
    expect(ids(allMilestones([stay(h, '2026-06-19')], { home: HOME }))).not.toContain('anniversary-stay');
    expect(ids(allMilestones([stay(h, '2026-07-18')], { home: HOME }))).not.toContain('anniversary-stay');
    const s = stay(h, '2026-09-19');
    const m = allMilestones([s], { home: HOME }).find((x) => x.id === 'anniversary-stay')!;
    expect(m).toMatchObject({ visitId: s.visit.visit_id, title: 'Right on the 19th', caption: "Checked in on the 19th. You didn't even plan that, did you?" });
  });

  it('a perfect 5-star stay: every given rating is 5', () => {
    const h = dubai('Grand', { stars: 5 });
    expect(ids(allMilestones([stay(h, '2026-07-01')], { home: HOME }))).not.toContain('five-star');
    expect(ids(allMilestones([stay(h, '2026-07-01', { rating_nirsh: 5, rating_shady: 4 })], { home: HOME }))).not.toContain('five-star');
    expect(ids(allMilestones([stay(h, '2026-07-01', { rating_nirsh: 5, rating_shady: 5 })], { home: HOME }))).toContain('five-star');
    expect(ids(allMilestones([stay(h, '2026-07-01', { rating_shady: 5 })], { home: HOME }))).toContain('five-star');
  });

  it('our regular: the third visit to one hotel', () => {
    const a = dubai('Marina Lanterns Hotel');
    const b = dubai('Other');
    const stays = [stay(a, '2026-07-01'), stay(b, '2026-07-02'), stay(a, '2026-08-01'), stay(b, '2026-08-02')];
    expect(ids(allMilestones(stays, { home: HOME }))).not.toContain('our-regular');
    const third = stay(a, '2026-09-01');
    const m = allMilestones([...stays, third], { home: HOME }).find((x) => x.id === 'our-regular')!;
    expect(m).toMatchObject({ visitId: third.visit.visit_id, caption: 'Third time at Marina Lanterns Hotel. That makes it ours.' });
    expect(milestoneToast(m)).toBe('Third time at Marina Lanterns Hotel. That makes it ours.');
  });
});

describe('engine properties', () => {
  const hotels = Array.from({ length: 6 }, (_, i) => dubai(`H${i}`));
  const abroad = makeHotel({ name: 'Paris', city: 'Paris', country: 'France', country_code: 'FR', lat: 48.85, lng: 2.35 });
  const fixture: Stay[] = [
    ...hotels.map((h, i) => stay(h, `2026-07-0${i + 1}`, { visit_id: `V${i}` })),
    stay(hotels[0], '2026-08-19', { visit_id: 'V6', rating_nirsh: 5, rating_shady: 5 }),
    stay(hotels[0], '2026-09-02', { visit_id: 'V7' }),
    stay(abroad, '2026-09-10', { visit_id: 'V8' }),
  ];

  it('reaches everything expected', () => {
    expect(ids(allMilestones(fixture, { home: HOME }))).toEqual([
      'first-stay',
      'three-in-a-month',
      'hotels-5',
      'anniversary-stay',
      'five-star',
      'our-regular',
      'first-outside-home-city',
      'first-abroad',
    ]);
  });

  it('is idempotent: prev excludes what was already reached', () => {
    const all = allMilestones(fixture, { home: HOME });
    expect(checkMilestones(fixture, all, { home: HOME })).toEqual([]);
    const before = fixture.slice(0, 8);
    const prev = checkMilestones(before, [], { home: HOME });
    expect(ids(checkMilestones(fixture, prev, { home: HOME }))).toEqual(['first-outside-home-city', 'first-abroad']);
    expect(checkMilestones(fixture, [], { home: HOME })).toEqual(checkMilestones(fixture, [], { home: HOME }));
  });

  it('is deterministic: input order does not matter, ties broken by check-in then created_at then id', () => {
    const expected = allMilestones(fixture, { home: HOME });
    for (const seed of [1, 7, 42, 1234]) expect(allMilestones(shuffle(fixture, seed), { home: HOME })).toEqual(expected);
    const h = dubai();
    const late = stay(h, '2026-07-02', { visit_id: 'A', check_in: '18:00' });
    const early = stay(dubai(), '2026-07-02', { visit_id: 'B', check_in: '09:00' });
    expect(allMilestones([late, early], { home: HOME })[0].visitId).toBe('B');
    const x = stay(h, '2026-07-02', { visit_id: 'Z', check_in: null, created_at: '2026-07-02T09:00:00Z' });
    const y = stay(h, '2026-07-02', { visit_id: 'Y', check_in: null, created_at: '2026-07-02T09:00:00Z' });
    expect(allMilestones([x, y], { home: HOME })[0].visitId).toBe('Y');
  });

  it('ignores deleted visits and deleted hotels', () => {
    const h = dubai();
    const gone = makeHotel({ deleted: true, city: 'Paris', country_code: 'FR' });
    expect(allMilestones([stay(h, '2026-07-01', { deleted: true }), stay(gone, '2026-07-02')], { home: HOME })).toEqual([]);
    const third = [stay(h, '2026-07-01'), stay(h, '2026-07-02', { deleted: true }), stay(h, '2026-07-03')];
    expect(ids(allMilestones(third, { home: HOME }))).not.toContain('our-regular');
  });

  it('defaults to the couple home base (Dubai)', () => {
    expect(allMilestones([stay(makeHotel({ city: 'Sharjah' }), '2026-07-01')]).map((m) => m.title)).toContain('First stay outside Dubai');
  });
});

describe('milestoneToast', () => {
  it('uses the addStay.milestone copy', () => {
    const h = dubai();
    const [first] = allMilestones([stay(h, '2026-07-01')], { home: HOME });
    expect(milestoneToast(first)).toBe('Our first stay. Every room starts somewhere.');
    const five = allMilestones([1, 2, 3, 4, 5].map((i) => stay(dubai(`H${i}`), `2026-07-0${i}`)), { home: HOME }).find((m) => m.id === 'hotels-5')!;
    expect(milestoneToast(five)).toBe("5 hotels. We're building a habit.");
    const out = allMilestones([stay(makeHotel({ city: 'Al Ain' }), '2026-07-01')], { home: HOME }).find((m) => m.id === 'first-outside-home-city')!;
    expect(milestoneToast(out)).toBe('First stay outside Dubai. The map just got bigger.');
  });
});

describe('newlyUnlockedLetters', () => {
  const letter = (o: Partial<Letter>): Letter => ({
    letter_id: 'L1',
    title: 'Note',
    body_md: 'Hi',
    from: 'nirsh',
    to: 'shady',
    unlock_rule: 'hotels>=2',
    written_at: '2026-09-01',
    read_at: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...o,
  });
  const one = [stay(dubai('A'), '2026-07-01')];
  const two = [...one, stay(dubai('B'), '2026-07-02')];

  it('finds letters to me that this save unlocked', () => {
    expect(newlyUnlockedLetters([letter({})], 'shady', one, two, HOME, '2026-10-01').map((l) => l.letter_id)).toEqual(['L1']);
  });
  it('skips letters not to me, already unlocked, read, or still locked', () => {
    expect(newlyUnlockedLetters([letter({})], 'nirsh', one, two, HOME, '2026-10-01')).toEqual([]);
    expect(newlyUnlockedLetters([letter({ unlock_rule: 'always' })], 'shady', one, two, HOME, '2026-10-01')).toEqual([]);
    expect(newlyUnlockedLetters([letter({ read_at: '2026-09-02' })], 'shady', one, two, HOME, '2026-10-01')).toEqual([]);
    expect(newlyUnlockedLetters([letter({ unlock_rule: 'hotels>=3' })], 'shady', one, two, HOME, '2026-10-01')).toEqual([]);
    expect(newlyUnlockedLetters([letter({})], null, one, two, HOME, '2026-10-01')).toEqual([]);
  });
  it('first_abroad unlocks on the first stay in another country', () => {
    const abroad = [...one, stay(makeHotel({ country_code: 'OM', country: 'Oman', city: 'Muscat' }), '2026-08-01')];
    expect(newlyUnlockedLetters([letter({ unlock_rule: 'first_abroad' })], 'shady', one, abroad, HOME, '2026-10-01')).toHaveLength(1);
  });
});
