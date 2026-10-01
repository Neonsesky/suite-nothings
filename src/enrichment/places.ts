/**
 * Optional Google Places provider (SPEC §11.5), off by default. It runs through Apps Script so the
 * key (with billing enabled) stays in Script Properties; see SETUP.md for the cost warning.
 */
import type { PriceLevel } from '@/data/types';
import type { Invoke } from './ai';
import type { EnrichmentPatch, EnrichmentProvider } from './types';

interface PlacesAnswer {
  ok?: boolean;
  code?: string;
  website?: unknown;
  phone?: unknown;
  address?: unknown;
  price_level?: unknown;
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Google's PRICE_LEVEL_INEXPENSIVE…VERY_EXPENSIVE (or 1–4) → our ¤ to ¤¤¤¤. "Free" is no level. */
export function placesPriceLevel(v: unknown): PriceLevel | null {
  const names = ['PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE'];
  const i = typeof v === 'string' ? names.indexOf(v) + 1 : typeof v === 'number' ? v : 0;
  return i >= 1 && i <= 4 ? (i as PriceLevel) : null;
}

export function createPlacesProvider(invoke: Invoke | null): EnrichmentProvider {
  return {
    id: 'places',
    canEnrich: () => invoke !== null,
    async enrich(hotel) {
      const res = (await invoke!('placesLookup', { name: hotel.name, lat: hotel.lat, lng: hotel.lng })) as PlacesAnswer | null;
      // Not configured is a quiet "nothing to add", not a failure.
      if (!res || res.ok === false) return {};
      const patch: EnrichmentPatch = {};
      const website = text(res.website);
      if (website) patch.website = website;
      const phone = text(res.phone);
      if (phone) patch.phone = phone;
      const address = text(res.address);
      if (address) patch.address = address;
      const price = placesPriceLevel(res.price_level);
      if (price) patch.price_level = price;
      return patch;
    },
  };
}
