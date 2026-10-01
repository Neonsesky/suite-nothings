/**
 * Journey replay camera: pure functions, no DOM / map dependency.
 *
 * A timeline drives a linear `t ∈ [0, 1]` per leg; every frame the app calls `cameraAt(leg, t)` and
 * feeds `sample.camera` to `map.jumpTo`. Each leg eases in and out (`u = easeInOutSine(t)`), so the
 * camera is at rest at both ends and consecutive legs join without snaps.
 *
 * Coordinates: `LatLng` objects from `@/lib/geo`, map-facing tuples are `[lng, lat]`. Longitudes are
 * unwrapped across a whole journey (they may leave [-180, 180]) so nothing jumps at the antimeridian.
 */
import {
  bearing as geoBearing,
  classifyLeg,
  GLIDE_MAX_KM,
  greatCircle,
  haversineKm,
  HOP_MAX_KM,
  interpolateGreatCircle,
  type LatLng,
  type LegStyle,
} from '@/lib/geo';

export type LngLat = [number, number];

export interface Camera {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

/** Camera zoom when parked at a stop. */
export const STOP_ZOOM = 13;
export const STOP_PITCH = 58;
/** Seconds held at each stop. */
export const HOLD_S = 2.2;
/** Seconds of split-flap opening date before the first flight. */
export const OPENING_S = 2.4;
/** Seconds of the closing pull-back to the whole journey. */
export const FINALE_S = 3.2;
/** Opening camera zoom over home. */
export const GLOBE_ZOOM = 1.6;

/** Seconds of the opening flight from home to the first stop (after the flap hold). */
const OPENING_FLIGHT_S = 4.5;
const DEFAULT_VW = 390;
const DEFAULT_VH = 844;
const PATH_STEPS = 64;
const LUT_SIZE = 129;
/** Integration sub-steps per LUT interval. */
const LUT_SUBSTEPS = 8;
/** Below this a leg is treated as zero-length (same place twice). */
const DEGENERATE_KM = 1e-3;
const MAX_PITCH = 70;
const PEAK_PITCH: Record<LegStyle, number> = { glide: 60, hop: 30, flight: 0 };
/** Peak-zoom clamps per style: glide stays low, hop shows the country, flight shows the globe. */
const PEAK_RANGE: Record<LegStyle, [number, number]> = {
  glide: [11.8, Infinity],
  hop: [5.5, 9.5],
  flight: [1.4, 4],
};
const FIT_MIN_ZOOM = 1.2;
/** fitCamera padding in px (vertical is larger to clear overlaid chrome). */
const FIT_PAD_X = 48;
const FIT_PAD_Y = 96;
/** MapLibre tile size in px (world width at zoom 0). */
const TILE_PX = 512;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const clamp01 = (x: number) => clamp(x, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Shifts `lng` by whole turns so it lies within 180° of `ref`. */
function unwrapLng(lng: number, ref: number): number {
  return lng - 360 * Math.round((lng - ref) / 360);
}

/** Normalises an angle in degrees to (-180, 180]. */
function normAngle(a: number): number {
  const x = (((a + 180) % 360) + 360) % 360 - 180;
  return x === -180 ? 180 : x;
}

/** Linear lookup into an evenly spaced table at fraction `f` (0–1). */
function sampleTable(table: readonly number[], f: number): number {
  const n = table.length;
  if (n === 0) return 0;
  if (n === 1) return table[0];
  const x = clamp01(f) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  return lerp(table[i], table[i + 1], x - i);
}

/** Sine ease-in-out; `t` is clamped to [0, 1]. */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
}

/** Hermite smoothstep of `x` between edges `e0` and `e1`. */
export function smoothstep(e0: number, e1: number, x: number): number {
  if (e1 === e0) return x < e0 ? 0 : 1;
  const k = clamp01((x - e0) / (e1 - e0));
  return k * k * (3 - 2 * k);
}

/** Signed shortest rotation from `from` to `to`, degrees in (-180, 180]. */
export function shortestAngleDelta(from: number, to: number): number {
  return normAngle(to - from);
}

/** Interpolates angles along the shortest arc; result in (-180, 180]. */
export function lerpAngle(a: number, b: number, t: number): number {
  return normAngle(a + shortestAngleDelta(a, b) * t);
}

/** Zoom that moves from z0 to z1 while dipping (zooming out) by `h` in the middle. */
export function bellZoom(z0: number, z1: number, h: number, t: number): number {
  return lerp(z0, z1, t) - h * Math.sin(Math.PI * t);
}

/** Seconds a leg takes at 1x: glide 2.5–3.5, hop 4–5, flight 6–7 (longer legs take longer). */
export function legDuration(style: LegStyle, km: number): number {
  switch (style) {
    case 'glide':
      return 2.5 + clamp01(km / GLIDE_MAX_KM);
    case 'hop':
      return 4 + clamp01((km - GLIDE_MAX_KM) / (HOP_MAX_KM - GLIDE_MAX_KM));
    case 'flight':
      return 6 + clamp01(Math.log10(Math.max(km, 1e-9) / HOP_MAX_KM) / Math.log10(20));
  }
}

/** Zoom at which a leg of `km` spans ~70% of a viewport `viewportWidthPx` wide (Infinity for 0 km). */
export function peakZoom(km: number, lat: number, viewportWidthPx: number): number {
  if (!(km > 0)) return Infinity;
  const metresPerPx = (km * 1000) / (0.7 * viewportWidthPx);
  return Math.log2((156543.03 * Math.cos(toRad(lat))) / metresPerPx);
}

/** How far (in zoom levels) a leg dips below the average of its end zooms, per style. */
export function legHeight(style: LegStyle, z0: number, z1: number, km: number, lat: number, vw: number): number {
  const [lo, hi] = PEAK_RANGE[style];
  const peak = clamp(peakZoom(km, lat, vw), lo, hi);
  const h = (z0 + z1) / 2 - peak;
  return Number.isFinite(h) ? Math.max(0, h) : 0;
}

function mercator([lng, lat]: LngLat): [number, number] {
  const φ = toRad(clamp(lat, -85.05113, 85.05113));
  return [lng / 360, Math.log(Math.tan(Math.PI / 4 + φ / 2)) / (2 * Math.PI)];
}

function inverseMercatorLat(y: number): number {
  return toDeg(2 * Math.atan(Math.exp(y * 2 * Math.PI)) - Math.PI / 2);
}

/** Cumulative Web-Mercator length fraction at each path point (0 … 1); linear if the path has no length. */
export function mercatorFractions(path: readonly LngLat[]): number[] {
  const n = path.length;
  if (n === 0) return [];
  if (n === 1) return [0];
  const cum = [0];
  let prev = mercator(path[0]);
  for (let i = 1; i < n; i++) {
    const p = mercator(path[i]);
    cum.push(cum[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
    prev = p;
  }
  const total = cum[n - 1];
  if (!(total > 1e-15)) return cum.map((_, i) => i / (n - 1));
  return cum.map((d) => d / total);
}

/**
 * Normalised cumulative integral of 2^-z(s) over s ∈ [0, u] at LUT_SIZE evenly spaced u: the
 * van Wijk-style centre fraction that keeps screen speed constant (move while high, not while low).
 */
function buildCentreLUT(z0: number, z1: number, h: number): number[] {
  const steps = (LUT_SIZE - 1) * LUT_SUBSTEPS;
  const w = (s: number) => 2 ** -bellZoom(z0, z1, h, s);
  const cum = [0];
  let acc = 0;
  let prevW = w(0);
  for (let i = 1; i <= steps; i++) {
    const nextW = w(i / steps);
    acc += (prevW + nextW) / 2 / steps;
    prevW = nextW;
    if (i % LUT_SUBSTEPS === 0) cum.push(acc);
  }
  if (!(acc > 0) || !Number.isFinite(acc)) return cum.map((_, i) => i / (LUT_SIZE - 1));
  const lut = cum.map((v) => v / acc);
  lut[LUT_SIZE - 1] = 1;
  return lut;
}

export interface LegPlan {
  /** Leg i runs stop i → i+1; the opening is -1, the finale is `legs.length`. */
  index: number;
  kind: 'opening' | 'leg' | 'finale';
  from: LatLng;
  to: LatLng;
  km: number;
  style: LegStyle;
  /** Initial great-circle bearing from → to, degrees 0–360. */
  heading: number;
  /** Seconds at 1x. */
  duration: number;
  z0: number;
  z1: number;
  h: number;
  pitch0: number;
  pitch1: number;
  pitchPeak: number;
  bearing0: number;
  bearing1: number;
  /** Great circle from → to as [lng, lat], longitudes unwrapped. */
  path: LngLat[];
  pathMercFrac: number[];
  /** LUT_SIZE samples of the centre fraction c(u), u = 0 … 1. */
  centreLUT: number[];
}

export interface PlanOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  home?: LatLng | null;
  startBearing?: number;
}

/** Plans one camera move. Defaults suit a stop-to-stop leg (parked at STOP_ZOOM / STOP_PITCH at both ends). */
export function planLeg(
  from: LatLng,
  to: LatLng,
  o: {
    index: number;
    kind?: LegPlan['kind'];
    z0?: number;
    z1?: number;
    pitch0?: number;
    pitch1?: number;
    bearing0?: number;
    bearing1?: number;
    style?: LegStyle;
    duration?: number;
    vw?: number;
  },
): LegPlan {
  const kind = o.kind ?? 'leg';
  const km = haversineKm(from, to);
  const degenerate = km < DEGENERATE_KM;
  const style = o.style ?? classifyLeg(km);
  const z0 = o.z0 ?? STOP_ZOOM;
  const z1 = o.z1 ?? STOP_ZOOM;
  const pitch0 = o.pitch0 ?? STOP_PITCH;
  const pitch1 = o.pitch1 ?? STOP_PITCH;
  const bearing0 = o.bearing0 ?? 0;
  // A zero-length leg has no direction: keep facing the way we were.
  const heading = degenerate ? (bearing0 + 360) % 360 : geoBearing(from, to);
  const midLat = interpolateGreatCircle(from, to, 0.5).lat;
  const h = kind === 'leg' ? legHeight(style, z0, z1, km, midLat, o.vw ?? DEFAULT_VW) : 0;
  const path: LngLat[] = degenerate
    ? [
        [from.lng, from.lat],
        [unwrapLng(to.lng, from.lng), to.lat],
      ]
    : greatCircle(from, to, PATH_STEPS).map((p): LngLat => [p.lng, p.lat]);
  return {
    index: o.index,
    kind,
    from,
    to,
    km,
    style,
    heading,
    duration: o.duration ?? legDuration(style, km),
    z0,
    z1,
    h,
    pitch0,
    pitch1,
    pitchPeak: kind === 'leg' ? PEAK_PITCH[style] : (pitch0 + pitch1) / 2,
    bearing0,
    bearing1: o.bearing1 ?? heading,
    path,
    pathMercFrac: mercatorFractions(path),
    centreLUT: buildCentreLUT(z0, z1, h),
  };
}

/**
 * Plans the whole replay: opening (home → first stop), stop-to-stop legs, finale (pull back to fit
 * everything). Stop longitudes are unwrapped leg to leg so every boundary is exactly continuous.
 */
export function planJourney(
  stops: readonly LatLng[],
  o: PlanOptions = {},
): { opening: LegPlan | null; legs: LegPlan[]; finale: LegPlan | null; finaleCamera: Camera | null } {
  if (stops.length === 0) return { opening: null, legs: [], finale: null, finaleCamera: null };
  const vw = o.viewportWidth ?? DEFAULT_VW;
  const vh = o.viewportHeight ?? DEFAULT_VH;
  const home = o.home ?? null;
  const start = home ?? stops[0];

  // Unwrap each stop's longitude against the previous point so consecutive legs share endpoints exactly.
  const unwrapped: LatLng[] = [];
  let ref = start.lng;
  for (const s of stops) {
    const lng = unwrapLng(s.lng, ref);
    unwrapped.push({ lat: s.lat, lng });
    ref = lng;
  }

  const opening = planLeg(start, unwrapped[0], {
    index: -1,
    kind: 'opening',
    z0: GLOBE_ZOOM,
    z1: STOP_ZOOM,
    pitch0: 0,
    pitch1: STOP_PITCH,
    bearing0: o.startBearing ?? 0,
    bearing1: 0,
    style: 'flight',
    duration: OPENING_FLIGHT_S,
    vw,
  });

  const legs: LegPlan[] = [];
  let prevBearing = opening.bearing1;
  for (let i = 0; i + 1 < unwrapped.length; i++) {
    const leg = planLeg(unwrapped[i], unwrapped[i + 1], { index: i, kind: 'leg', bearing0: prevBearing, vw });
    legs.push(leg);
    prevBearing = leg.bearing1;
  }

  const fitPoints = home ? [...stops, home] : [...stops];
  const finaleCamera = fitCamera(fitPoints, vw, vh);
  const last = unwrapped[unwrapped.length - 1];
  const target: LatLng = { lat: finaleCamera.center[1], lng: unwrapLng(finaleCamera.center[0], last.lng) };
  finaleCamera.center = [target.lng, target.lat];
  const finale = planLeg(last, target, {
    index: legs.length,
    kind: 'finale',
    z0: STOP_ZOOM,
    z1: finaleCamera.zoom,
    pitch0: STOP_PITCH,
    pitch1: 0,
    bearing0: prevBearing,
    bearing1: 0,
    style: 'flight',
    duration: FINALE_S,
    vw,
  });

  return { opening, legs, finale, finaleCamera };
}

export interface CameraSample {
  camera: Camera;
  /** Great-circle fraction c of the camera centre / traveller. */
  centreFrac: number;
  /** Web-Mercator length fraction of the drawn line at c (for line-gradient / trim). */
  lineProgress: number;
  /** Traveller position (= camera centre), [lng, lat]. */
  position: LngLat;
  /** Local great-circle bearing toward `to`, degrees 0–360. */
  heading: number;
}

/** Camera and traveller state for a leg at linear time `t` (0–1). */
export function cameraAt(leg: LegPlan, t: number): CameraSample {
  const u = easeInOutSine(t);
  const zoom = bellZoom(leg.z0, leg.z1, leg.h, u);
  const pitchMid = lerp(leg.pitch0, leg.pitch1, 0.5);
  const pitch = clamp(
    lerp(leg.pitch0, leg.pitch1, u) + (leg.pitchPeak - pitchMid) * Math.sin(Math.PI * u),
    0,
    MAX_PITCH,
  );
  const bearing = lerpAngle(leg.bearing0, leg.bearing1, smoothstep(0, 0.7, u));

  const c = clamp01(sampleTable(leg.centreLUT, u));
  const n = leg.path.length;
  const idx = c * (n - 1);
  const p = interpolateGreatCircle(leg.from, leg.to, c);
  const position: LngLat = [unwrapLng(p.lng, leg.path[Math.round(idx)][0]), p.lat];
  const lineProgress = sampleTable(leg.pathMercFrac, c);

  let heading = leg.heading;
  if (leg.km >= DEGENERATE_KM) {
    heading = haversineKm(p, leg.to) > 1e-6 ? geoBearing(p, leg.to) : (geoBearing(leg.to, leg.from) + 180) % 360;
  }

  return { camera: { center: position, zoom, pitch, bearing }, centreFrac: c, lineProgress, position, heading };
}

/** A pitch-0, north-up camera framing all points (shortest longitude span), zoom clamped to [1.2, STOP_ZOOM]. */
export function fitCamera(points: readonly LatLng[], vw: number, vh: number): Camera {
  if (points.length === 0) return { center: [0, 0], zoom: FIT_MIN_ZOOM, pitch: 0, bearing: 0 };

  // Longitudes: the covering arc is the complement of the largest gap between sorted longitudes.
  const lngs = points.map((p) => ((((p.lng + 180) % 360) + 360) % 360) - 180).sort((a, b) => a - b);
  let west = lngs[0];
  let span = 0;
  let maxGap = -1;
  for (let i = 0; i < lngs.length; i++) {
    const next = i + 1 < lngs.length ? lngs[i + 1] : lngs[0] + 360;
    const gap = next - lngs[i];
    if (gap > maxGap) {
      maxGap = gap;
      west = next;
      span = 360 - gap;
    }
  }
  const centreLng = normAngle(west + span / 2);

  const ys = points.map((p) => mercator([0, p.lat])[1]);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const centreLat = inverseMercatorLat((yMin + yMax) / 2);

  const dx = span / 360;
  const dy = yMax - yMin;
  const zx = dx > 0 ? Math.log2(Math.max(1, vw - 2 * FIT_PAD_X) / (dx * TILE_PX)) : Infinity;
  const zy = dy > 0 ? Math.log2(Math.max(1, vh - 2 * FIT_PAD_Y) / (dy * TILE_PX)) : Infinity;
  const zoom = clamp(Math.min(zx, zy), FIT_MIN_ZOOM, STOP_ZOOM);

  return { center: [centreLng, centreLat], zoom, pitch: 0, bearing: 0 };
}

export interface Segment {
  kind: 'opening' | 'leg' | 'hold' | 'finale';
  start: number;
  duration: number;
  legIndex?: number;
  stopIndex?: number;
}

export interface Schedule {
  segments: Segment[];
  total: number;
  /** Arrival time (start of its hold) at stop i. */
  stopTimes: number[];
}

/**
 * Lays the plan on a timeline at 1x: opening (OPENING_S flap hold, then the opening flight), hold at
 * stop 0, then leg + hold per stop, then the finale.
 */
export function buildSchedule(plan: ReturnType<typeof planJourney>): Schedule {
  const segments: Segment[] = [];
  const stopTimes: number[] = [];
  if (!plan.opening) return { segments, total: 0, stopTimes };

  let time = 0;
  const push = (seg: Omit<Segment, 'start'>) => {
    segments.push({ ...seg, start: time });
    time += seg.duration;
  };
  const hold = (stopIndex: number) => {
    stopTimes[stopIndex] = time;
    push({ kind: 'hold', duration: HOLD_S, stopIndex });
  };

  push({ kind: 'opening', duration: OPENING_S + plan.opening.duration });
  hold(0);
  plan.legs.forEach((leg, i) => {
    push({ kind: 'leg', duration: leg.duration, legIndex: i });
    hold(i + 1);
  });
  if (plan.finale) push({ kind: 'finale', duration: plan.finale.duration });

  return { segments, total: time, stopTimes };
}

/** Index of the last stop reached at `time` (-1 before the first arrival). */
export function stopIndexAt(schedule: Schedule, time: number): number {
  let idx = -1;
  for (let i = 0; i < schedule.stopTimes.length && schedule.stopTimes[i] <= time; i++) idx = i;
  return idx;
}
