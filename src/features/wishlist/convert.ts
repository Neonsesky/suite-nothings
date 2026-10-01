/** Wish → stay (SPEC §12 "one-tap conversion"). Add-stay reads `?wish=<id>` and calls these. */
import { upsertWish } from '@/data/store';
import type { Hotel, HomeBase, Wish } from '@/data/types';
import type { HotelChoice } from '@/features/add-stay/draft';
import { countryCodeFor } from '@/features/add-stay/places';

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The hotel choice a wish prefills: a hotel we already have with the same name (and city when
 * both know it), else a new hotel from the wish's pin. null when the wish has no pin, so the
 * flow starts at search instead.
 */
export function hotelChoiceForWish(wish: Wish, hotels: readonly Hotel[], home: HomeBase): HotelChoice | null {
  const match = hotels.find((h) => !h.deleted && norm(h.name) === norm(wish.name) && (!wish.city || !h.city || norm(h.city) === norm(wish.city)));
  if (match) return { kind: 'existing', hotel_id: match.hotel_id };
  if (wish.lat == null || wish.lng == null) return null;
  const country = wish.country?.trim() || home.country;
  return {
    kind: 'new',
    hotel: {
      name: wish.name.trim(),
      brand: null,
      address: null,
      area: null,
      city: wish.city?.trim() || home.city,
      region: null,
      country,
      country_code: countryCodeFor(country) ?? home.countryCode,
      lat: wish.lat,
      lng: wish.lng,
      source: 'wishlist',
      osm_id: null,
      wikidata_id: null,
      website: null,
      phone: null,
      stars: null,
    },
  };
}

/** Mark a wish as come true by the visit that fulfilled it. */
export async function fulfilWish(wish: Wish, visitId: string): Promise<void> {
  if (wish.fulfilled_visit_id === visitId) return;
  await upsertWish({ ...wish, fulfilled_visit_id: visitId });
}
