/** Geo math: pure functions, no map dependency. Coordinates are `{ lat, lng }` in degrees. */

export interface LatLng {
  lat: number;
  lng: number;
}
/** [west, south, east, north] */
export type BBox = [number, number, number, number];

export type LegStyle = 'glide' | 'hop' | 'flight';
/** Leg thresholds in km (SPEC §10). */
export const GLIDE_MAX_KM = 30;
export const HOP_MAX_KM = 400;

const R_KM = 6371.0088;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in km (haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function kmToMiles(km: number): number {
  return km * 0.621371;
}

/** Initial bearing from a to b in degrees, 0–360 (0 = north). */
export function bearing(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Point at fraction t (0–1) along the great circle from a to b (slerp). */
export function interpolateGreatCircle(a: LatLng, b: LatLng, t: number): LatLng {
  const φ1 = toRad(a.lat);
  const λ1 = toRad(a.lng);
  const φ2 = toRad(b.lat);
  const λ2 = toRad(b.lng);
  const δ = haversineKm(a, b) / R_KM;
  if (δ < 1e-9) return { lat: a.lat, lng: a.lng };
  const A = Math.sin((1 - t) * δ) / Math.sin(δ);
  const B = Math.sin(t * δ) / Math.sin(δ);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: toDeg(Math.atan2(z, Math.hypot(x, y))), lng: toDeg(Math.atan2(y, x)) };
}

/** `steps + 1` points along the great circle from a to b, longitudes unwrapped (no antimeridian jumps). */
export function greatCircle(a: LatLng, b: LatLng, steps = 64): LatLng[] {
  const pts: LatLng[] = [];
  let prevLng = a.lng;
  for (let i = 0; i <= steps; i++) {
    const p = interpolateGreatCircle(a, b, i / steps);
    let lng = p.lng;
    while (lng - prevLng > 180) lng -= 360;
    while (lng - prevLng < -180) lng += 360;
    prevLng = lng;
    pts.push({ lat: p.lat, lng });
  }
  return pts;
}

/** Bounding box of points; null for an empty list. */
export function bbox(points: readonly LatLng[]): BBox | null {
  if (points.length === 0) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of points) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  return [w, s, e, n];
}

/** Grows a bbox by `km` on every side. */
export function padBBox([w, s, e, n]: BBox, km: number): BBox {
  const dLat = km / 110.574;
  const midLat = (s + n) / 2;
  const dLng = km / (111.32 * Math.max(0.01, Math.cos(toRad(midLat))));
  return [w - dLng, s - dLat, e + dLng, n + dLat];
}

export function inBBox(p: LatLng, [w, s, e, n]: BBox): boolean {
  return p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n;
}

/** Leg style by distance: glide < 30 km, hop < 400 km, flight above. */
export function classifyLeg(km: number): LegStyle {
  if (km < GLIDE_MAX_KM) return 'glide';
  if (km < HOP_MAX_KM) return 'hop';
  return 'flight';
}

export interface Leg {
  from: LatLng;
  to: LatLng;
  km: number;
  style: LegStyle;
  bearing: number;
}

/** Consecutive legs through `points` (in order). */
export function legs(points: readonly LatLng[]): Leg[] {
  const out: Leg[] = [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const km = haversineKm(from, to);
    out.push({ from, to, km, style: classifyLeg(km), bearing: bearing(from, to) });
  }
  return out;
}

/** Total km along a path. */
export function pathKm(points: readonly LatLng[]): number {
  return legs(points).reduce((sum, l) => sum + l.km, 0);
}

export function formatKm(km: number, units: 'km' | 'mi' = 'km'): string {
  const v = units === 'mi' ? kmToMiles(km) : km;
  const rounded = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
  return `${rounded.toLocaleString('en-GB')} ${units}`;
}
