/**
 * Map chapters (SPEC §9): City → Country → World are zoom ranges of one continuous map, with
 * breakpoints computed from the home base so a new home (London → UK → World) just works.
 * Pure functions only; the engine turns them into camera moves and style stops.
 */
import type { BBox, LatLng } from '@/lib/geo';
import type { HomeBase } from '@/data/types';
import { COUNTRY_BBOX } from './countries';

export type Chapter = 'city' | 'country' | 'world';
export const CHAPTERS: readonly Chapter[] = ['city', 'country', 'world'];

export interface Breakpoints {
  /** At or above this zoom we're in the City chapter. */
  city: number;
  /** At or above this zoom (and below `city`) we're in the Country chapter. */
  country: number;
}

export interface Framing {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Chapter camera tilt. City is pitched for the 3D buildings; the globe looks straight on. */
export const CHAPTER_PITCH: Record<Chapter, number> = { city: 55, country: 25, world: 0 };
/** A little bearing makes the city read as 3D without disorienting anyone. */
export const CITY_BEARING = -14;

/**
 * You're "in the city" once its bbox spans ~1.75 reference tiles (512 px), and "in the world"
 * once the country shrinks below ~0.6 of one. For Dubai that lands at z≈9.5 and z≈5.5.
 */
const CITY_FILL = 1.75;
const COUNTRY_FILL = 0.6;
const MIN_GAP = 1.2;

const TILE = 512;

/** Web Mercator x/y in [0, 1]. */
function mercX(lng: number): number {
  return (lng + 180) / 360;
}
function mercY(lat: number): number {
  const phi = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI);
}

/** The zoom at which `bbox` exactly fits a `width × height` px viewport (512 px tiles). */
export function fitZoom(bbox: BBox | readonly [number, number, number, number], vp: Viewport = { width: TILE, height: TILE }): number {
  const [w, s, e, n] = bbox;
  const dx = Math.max(1e-6, mercX(e) - mercX(w));
  const dy = Math.max(1e-6, mercY(s) - mercY(n));
  return Math.log2(Math.min(vp.width / (dx * TILE), vp.height / (dy * TILE)));
}

/** City bbox from the home base, or a ~70 km square around it. */
export function cityBBox(home: HomeBase): BBox {
  if (home.bbox) return [...home.bbox] as BBox;
  const dLat = 0.32;
  const dLng = dLat / Math.max(0.2, Math.cos((home.lat * Math.PI) / 180));
  return [home.lng - dLng, home.lat - dLat, home.lng + dLng, home.lat + dLat];
}

/** Country bbox from the bundled table, or a ~900 km square around the home base. */
export function countryBBox(home: HomeBase): BBox {
  const known = COUNTRY_BBOX[home.countryCode?.toUpperCase?.() ?? ''];
  if (known) return [...known] as BBox;
  const dLat = 4;
  const dLng = dLat / Math.max(0.2, Math.cos((home.lat * Math.PI) / 180));
  return [home.lng - dLng, home.lat - dLat, home.lng + dLng, home.lat + dLat];
}

export function bboxCenter(b: BBox): [number, number] {
  const cy = (mercY(b[1]) + mercY(b[3])) / 2;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * cy))) * 180) / Math.PI;
  return [(b[0] + b[2]) / 2, lat];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeBreakpoints(home: HomeBase): Breakpoints {
  const city = clamp(fitZoom(cityBBox(home)) + Math.log2(CITY_FILL), 7.5, 13);
  const country = clamp(fitZoom(countryBBox(home)) + Math.log2(COUNTRY_FILL), 2.5, city - MIN_GAP);
  return { city: round2(city), country: round2(country) };
}

export function chapterForZoom(zoom: number, bp: Breakpoints): Chapter {
  if (zoom >= bp.city) return 'city';
  if (zoom >= bp.country) return 'country';
  return 'world';
}

/** Zoom that shows the whole globe at ~95% of the shorter side. */
export function globeZoom(vp: Viewport): number {
  const m = Math.max(200, Math.min(vp.width, vp.height));
  return Math.log2((0.95 * m * Math.PI) / TILE);
}

/** The camera for a chapter (what the chips fly to). */
export function framingFor(chapter: Chapter, home: HomeBase, bp: Breakpoints, vp: Viewport): Framing {
  if (chapter === 'city') {
    const b = cityBBox(home);
    // Pitched cameras see further, so frame a little tighter than the fit.
    const zoom = clamp(fitZoom(b, vp) + 0.9, bp.city + 0.5, bp.city + 3);
    return { center: [home.lng, home.lat], zoom: round2(zoom), pitch: CHAPTER_PITCH.city, bearing: CITY_BEARING };
  }
  if (chapter === 'country') {
    const b = countryBBox(home);
    const zoom = clamp(fitZoom(b, { width: vp.width * 0.9, height: vp.height * 0.7 }), bp.country + 0.4, bp.city - 0.4);
    return { center: bboxCenter(b), zoom: round2(zoom), pitch: CHAPTER_PITCH.country, bearing: 0 };
  }
  const zoom = clamp(globeZoom(vp), 0.4, bp.country - 0.8);
  return { center: [home.lng, clamp(home.lat, -35, 35)], zoom: round2(zoom), pitch: 0, bearing: 0 };
}

/** Split-flap title for a chapter: DUBAI / UNITED ARAB EMIRATES / THE WORLD. */
export function chapterTitle(chapter: Chapter, home: HomeBase): string {
  const raw = chapter === 'city' ? home.city : chapter === 'country' ? home.country : 'The world';
  return flapText(raw);
}

/** Uppercase ASCII (the flap charset): strips accents and anything else off the board. */
export function flapText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toUpperCase()
    .replace(/[^ 0-9A-Z]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** How close (in zoom levels) a gesture must end to a breakpoint to settle into a chapter. */
export const SETTLE_RANGE = 0.6;

/**
 * After a gesture ends near a breakpoint, the gentle settle: nudge the zoom comfortably inside
 * the chapter it ended in, and tilt towards that chapter's pitch. Null when no settle is needed.
 */
export function settleTarget(zoom: number, bp: Breakpoints): { zoom: number; pitch: number; chapter: Chapter } | null {
  const chapter = chapterForZoom(zoom, bp);
  const edges = [bp.city, bp.country];
  const near = edges.find((e) => Math.abs(zoom - e) < SETTLE_RANGE);
  if (near === undefined) return null;
  const inside = zoom >= near ? near + SETTLE_RANGE + 0.15 : near - SETTLE_RANGE - 0.15;
  const target = chapter === 'world' ? Math.min(inside, bp.country - 0.8) : inside;
  return { zoom: round2(target), pitch: CHAPTER_PITCH[chapter], chapter };
}

/**
 * Zoom stops for a crossfade that is fully `from` below `edge − half` and fully `to` above
 * `edge + half`. Used to build interpolate expressions around breakpoints.
 */
export function fadeStops(edge: number, half = 0.35): [number, number] {
  return [round2(edge - half), round2(edge + half)];
}

/** Is a point on the visible hemisphere of a globe centred at `center`? (Angular test.) */
export function onVisibleHemisphere(center: LatLng, p: LatLng): boolean {
  const toRad = Math.PI / 180;
  const cos =
    Math.sin(center.lat * toRad) * Math.sin(p.lat * toRad) +
    Math.cos(center.lat * toRad) * Math.cos(p.lat * toRad) * Math.cos((p.lng - center.lng) * toRad);
  return cos > 0.05;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
