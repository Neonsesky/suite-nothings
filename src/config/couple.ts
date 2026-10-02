// src/config/couple.ts
export const COUPLE = {
  appName: 'Suite Nothings',
  shortName: 'Our Suites',
  tagline: "Every room we've made ours.",
  people: {
    // `avatar`: drop a real photo at public/photos/{id}.jpg (see SETUP.md) and the Avatar
    // component swaps it in automatically; until then it 404s and falls back to an initial.
    nirsh: { id: 'nirsh', name: 'Nirsh', avatar: '/photos/nirsh.jpg' },
    shady: { id: 'shady', name: 'Shady', avatar: '/photos/shady.jpg' },
  },
  togetherSince: '2026-06-19T23:46:00+04:00',
  defaultHomeBase: {
    city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE',
    lat: 25.2048, lng: 55.2708,
  },
  timezone: 'Asia/Dubai',
} as const;

export type PersonId = keyof typeof COUPLE.people;
export const PEOPLE: readonly PersonId[] = ['nirsh', 'shady'];
export function personName(id: PersonId | null | undefined): string {
  return id ? COUPLE.people[id].name : '';
}
export function otherPerson(id: PersonId): PersonId {
  return id === 'nirsh' ? 'shady' : 'nirsh';
}
