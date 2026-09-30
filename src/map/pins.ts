/**
 * Pins (SPEC §9): pure aggregation of stays into per-hotel pins, city bubbles and country bubbles
 * (separate GeoJSON sources the engine crossfades by zoom), plus rasterising the brand pin SVGs
 * into map images. The aggregation is pure and unit-tested; `ensurePinImages` touches the map.
 */
import type { FeatureCollection, LineString, Point } from 'geojson';
import type { Map as MlMap } from 'maplibre-gl';
import { clusterPin, homePin, pinDataUrl, stayPin, wishlistPin, type PinArt } from '@/components/brand/pins';
import type { HomeBase, Stay, Wish } from '@/data/types';
import { averageRating } from '@/data/stays';
import { greatCircle } from '@/lib/geo';

export interface StayPinProps {
  hotelId: string;
  /** The latest visit, which the pin card opens. */
  visitId: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  count: number;
  favourite: boolean;
  icon: string;
  /** Screen-reader label, e.g. "Rove Downtown, Dubai, 3 visits". */
  label: string;
}

export interface BubbleProps {
  key: string;
  label: string;
  count: number;
  icon: string;
}

export interface PinAggregates {
  pins: FeatureCollection<Point, StayPinProps>;
  cities: FeatureCollection<Point, BubbleProps>;
  countries: FeatureCollection<Point, BubbleProps>;
  wishes: FeatureCollection<Point, { wishId: string; name: string; icon: string }>;
  arcs: FeatureCollection<LineString, { order: number }>;
  home: FeatureCollection<Point, { icon: string; label: string }>;
}

/** A favourite: the pair rated it 4.5 or more on average on any visit. */
export const FAVOURITE_MIN = 4.5;

export const stayIconId = (count: number, favourite: boolean) => `sn-stay-${Math.min(count, 100)}${favourite ? '-fav' : ''}`;
export const bubbleIconId = (count: number) => `sn-bubble-${Math.min(count, 1000)}`;
export const WISH_ICON = 'sn-wish';
export const HOME_ICON = 'sn-home';

function point<P>(lng: number, lat: number, properties: P) {
  return { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [lng, lat] }, properties };
}

function plural(n: number, one: string, other: string) {
  return `${n} ${n === 1 ? one : other}`;
}

/** Mean position of a group, averaging longitudes on the unit circle (antimeridian-safe). */
function centroid(pts: readonly { lat: number; lng: number }[]): [number, number] {
  let x = 0;
  let y = 0;
  let lat = 0;
  for (const p of pts) {
    x += Math.cos((p.lng * Math.PI) / 180);
    y += Math.sin((p.lng * Math.PI) / 180);
    lat += p.lat;
  }
  return [(Math.atan2(y, x) * 180) / Math.PI, lat / pts.length];
}

/** Aggregate live (non-deleted) stays into the map's sources. Stays may be in any order. */
export function aggregate(stays: readonly Stay[], wishes: readonly Wish[] = [], home?: HomeBase | null): PinAggregates {
  const live = stays.filter((s) => !s.visit.deleted && Number.isFinite(s.hotel.lat) && Number.isFinite(s.hotel.lng));
  const byHotel = new Map<string, Stay[]>();
  for (const s of live) {
    const list = byHotel.get(s.hotel.hotel_id) ?? [];
    list.push(s);
    byHotel.set(s.hotel.hotel_id, list);
  }
  const pins = [...byHotel.values()].map((list) => {
    const sorted = [...list].sort((a, b) => a.stayNumber - b.stayNumber);
    const latest = sorted[sorted.length - 1];
    const h = latest.hotel;
    const favourite = sorted.some((s) => (averageRating(s.visit) ?? 0) >= FAVOURITE_MIN);
    const count = sorted.length;
    return point(h.lng, h.lat, {
      hotelId: h.hotel_id,
      visitId: latest.visit.visit_id,
      name: h.name,
      city: h.city,
      country: h.country,
      countryCode: h.country_code,
      count,
      favourite,
      icon: stayIconId(count, favourite),
      label: `${h.name}, ${h.city}, ${plural(count, 'visit', 'visits')}${favourite ? ', a favourite' : ''}`,
    });
  });

  const group = (keyOf: (s: Stay) => string, labelOf: (s: Stay) => string) => {
    const groups = new Map<string, Stay[]>();
    for (const s of live) {
      const k = keyOf(s);
      groups.set(k, [...(groups.get(k) ?? []), s]);
    }
    return [...groups.entries()].map(([key, list]) => {
      const [lng, lat] = centroid(list.map((s) => s.hotel));
      const label = labelOf(list[0]);
      return point(lng, lat, { key, label: `${label}, ${plural(list.length, 'stay', 'stays')}`, count: list.length, icon: bubbleIconId(list.length) });
    });
  };
  const cities = group(
    (s) => `${s.hotel.country_code}|${s.hotel.city}`,
    (s) => s.hotel.city,
  );
  const countries = group(
    (s) => s.hotel.country_code,
    (s) => s.hotel.country,
  );

  const chrono = [...live].sort((a, b) => a.stayNumber - b.stayNumber);
  const arcs = [];
  for (let i = 1; i < chrono.length; i++) {
    const a = chrono[i - 1].hotel;
    const b = chrono[i].hotel;
    if (a.hotel_id === b.hotel_id) continue;
    arcs.push({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: greatCircle(a, b, 48).map((p) => [p.lng, p.lat]) },
      properties: { order: i },
    });
  }

  return {
    pins: { type: 'FeatureCollection', features: pins },
    cities: { type: 'FeatureCollection', features: cities },
    countries: { type: 'FeatureCollection', features: countries },
    wishes: {
      type: 'FeatureCollection',
      features: wishes
        .filter((w) => !w.deleted && !w.fulfilled_visit_id && Number.isFinite(w.lat) && Number.isFinite(w.lng))
        .map((w) => point(w.lng as number, w.lat as number, { wishId: w.wish_id, name: w.name, icon: WISH_ICON })),
    },
    arcs: { type: 'FeatureCollection', features: arcs },
    home: {
      type: 'FeatureCollection',
      features: home ? [point(home.lng, home.lat, { icon: HOME_ICON, label: `Home base, ${home.city}` })] : [],
    },
  };
}

/** Every image id the aggregates reference, with the art that draws it. */
export function requiredImages(agg: PinAggregates): Map<string, PinArt> {
  const out = new Map<string, PinArt>();
  for (const f of agg.pins.features) {
    const { count, favourite, icon } = f.properties;
    if (!out.has(icon)) out.set(icon, stayPin({ count, favourite }));
  }
  for (const f of [...agg.cities.features, ...agg.countries.features]) {
    if (!out.has(f.properties.icon)) out.set(f.properties.icon, clusterPin(f.properties.count));
  }
  out.set(WISH_ICON, wishlistPin());
  out.set(HOME_ICON, homePin());
  return out;
}

/** Device pixel ratio for map rendering and pin rasters, capped at 2 (SPEC §9). */
export function mapPixelRatio(): number {
  return Math.min(2, Math.max(1, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
}

/**
 * Rasterise pin art to ImageData. Like `rasterizePin` from the brand kit, but on a
 * `willReadFrequently` (CPU) canvas, so reading pixels back never stalls the GPU.
 */
async function rasterize(art: PinArt, ratio: number): Promise<ImageData> {
  const w = Math.round(art.width * ratio);
  const h = Math.round(art.height * ratio);
  const img = new Image(w, h);
  img.src = pinDataUrl(art);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is unavailable, so map pins cannot be drawn.');
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Rasterise and add any images the map doesn't have yet. Safe to call repeatedly. */
export async function ensurePinImages(map: MlMap, agg: PinAggregates): Promise<void> {
  const ratio = mapPixelRatio();
  const missing = [...requiredImages(agg)].filter(([id]) => !map.hasImage(id));
  const rasters = await Promise.all(missing.map(async ([id, art]) => [id, await rasterize(art, ratio)] as const));
  for (const [id, data] of rasters) {
    if (!map.hasImage(id)) map.addImage(id, data, { pixelRatio: ratio });
  }
}

/** Stays whose hotel is at the pin, newest first (for the pin card). */
export function staysAtHotel(stays: readonly Stay[], hotelId: string): Stay[] {
  return stays.filter((s) => s.hotel.hotel_id === hotelId && !s.visit.deleted).sort((a, b) => b.stayNumber - a.stayNumber);
}

/** The `n` pins nearest to `hotelId` (excluding it), for the selected pin's HTML neighbours. */
export function neighbours(agg: PinAggregates, hotelId: string, n = 4): StayPinProps[] {
  const me = agg.pins.features.find((f) => f.properties.hotelId === hotelId);
  if (!me) return [];
  const [x0, y0] = me.geometry.coordinates;
  return agg.pins.features
    .filter((f) => f.properties.hotelId !== hotelId)
    .map((f) => ({ f, d: (f.geometry.coordinates[0] - x0) ** 2 + (f.geometry.coordinates[1] - y0) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map(({ f }) => f.properties);
}
