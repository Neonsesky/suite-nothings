/**
 * Pure layout maths and copy for the share cards (no canvas, no DOM): text fitting, cover crops,
 * the route projection and pin clustering, and the captions from design/copy.md §12.
 */
import type { Summary } from '@/lib/stats';
import { formatDate } from '@/lib/dates';

// ───────────────────────────── copy ─────────────────────────────

export const formatCount = (n: number): string => Math.round(n).toLocaleString('en-GB');

const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

/** `share.stayPostcard.caption`: "Stay {i} of {n}: {hotelName}, {date}". */
export function stayCaption(i: number, n: number, hotelName: string, date: string): string {
  return `Stay ${i} of ${n}: ${hotelName}, ${formatDate(date)}`;
}

/** `share.statsCard.caption`: "{n} hotels, {cities} cities, {countries} countries together". */
export function statsCaption(s: Pick<Summary, 'hotels' | 'cities' | 'countries'>): string {
  return `${plural(s.hotels, 'hotel', 'hotels')}, ${plural(s.cities, 'city', 'cities')}, ${plural(s.countries, 'country', 'countries')} together`;
}

/** `share.journeyRoute.caption`: "Our journey so far: {km} km, {n} hotels". */
export function routeCaption(km: number, hotels: number): string {
  return `Our journey so far: ${formatCount(km)} km, ${plural(hotels, 'hotel', 'hotels')}`;
}

export interface StatItem {
  key: keyof Summary;
  value: string;
  label: string;
}

/** The six big numbers on the stats card, in reading order. */
export function statItems(s: Summary): StatItem[] {
  return [
    { key: 'hotels', value: formatCount(s.hotels), label: s.hotels === 1 ? 'hotel' : 'hotels' },
    { key: 'visits', value: formatCount(s.visits), label: s.visits === 1 ? 'stay' : 'stays' },
    { key: 'hours', value: formatCount(s.hours), label: s.hours === 1 ? 'hour together' : 'hours together' },
    { key: 'cities', value: formatCount(s.cities), label: s.cities === 1 ? 'city' : 'cities' },
    { key: 'countries', value: formatCount(s.countries), label: s.countries === 1 ? 'country' : 'countries' },
    { key: 'km', value: formatCount(s.km), label: 'km travelled' },
  ];
}

/** File-name slug: "Çırağan Palace Kempinski" → "ciragan-palace-kempinski". */
export function slugify(s: string): string {
  const slug = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return slug || 'card';
}

// ───────────────────────────── text ─────────────────────────────

export type Measure = (text: string) => number;

/** Greedy word wrap. A single word wider than `maxWidth` gets a line to itself. */
export function wrapText(text: string, maxWidth: number, measure: Measure): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (!line || measure(next) <= maxWidth) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Trims `text` until it (plus an ellipsis) fits `maxWidth`. */
export function ellipsize(text: string, maxWidth: number, measure: Measure): string {
  if (measure(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && measure(`${t.trimEnd()}…`) > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export interface FitResult {
  size: number;
  lines: string[];
  truncated: boolean;
}

/**
 * Largest size from `sizes` (descending) at which `text` wraps into `maxLines` with every line
 * inside `maxWidth`. At the smallest size the overflow is cut with an ellipsis.
 */
export function fitText(
  text: string,
  opts: { maxWidth: number; maxLines: number; sizes: readonly number[] },
  measureAt: (size: number) => Measure,
): FitResult {
  const sizes = opts.sizes.length ? opts.sizes : [16];
  for (const size of sizes) {
    const m = measureAt(size);
    const lines = wrapText(text, opts.maxWidth, m);
    if (lines.length <= opts.maxLines && lines.every((l) => m(l) <= opts.maxWidth)) return { size, lines, truncated: false };
  }
  const size = sizes[sizes.length - 1];
  const m = measureAt(size);
  const all = wrapText(text, opts.maxWidth, m);
  const lines = all.slice(0, opts.maxLines).map((l) => ellipsize(l, opts.maxWidth, m));
  if (all.length > opts.maxLines) lines[opts.maxLines - 1] = ellipsize(all.slice(opts.maxLines - 1).join(' '), opts.maxWidth, m);
  return { size, lines, truncated: true };
}

/**
 * Re-breaks `lines` into the same number of lines with the narrowest widest line, so headings
 * don't leave a lonely last word ("Our journey so / far" → "Our journey / so far").
 */
export function balanceLines(lines: readonly string[], measure: Measure): string[] {
  if (lines.length < 2) return [...lines];
  const words = lines.join(' ').split(/\s+/);
  const count = lines.length;
  let best = [...lines];
  let bestW = Math.max(...lines.map(measure));
  // Words are few (headings), so try every split for two lines and a greedy target for more.
  if (count === 2) {
    for (let i = 1; i < words.length; i++) {
      const cand = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
      const w = Math.max(...cand.map(measure));
      if (w < bestW - 0.5) {
        best = cand;
        bestW = w;
      }
    }
    return best;
  }
  const total = measure(words.join(' '));
  for (let target = total / count; target <= bestW; target += 8) {
    const cand = wrapText(words.join(' '), target, measure);
    if (cand.length === count) return cand;
  }
  return best;
}

// ───────────────────────────── images ─────────────────────────────

/** Source rect that covers a `dw×dh` box with an `sw×sh` image (centred crop). */
export function coverFit(sw: number, sh: number, dw: number, dh: number): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(dw / sw, dh / sh);
  const w = dw / scale;
  const h = dh / scale;
  return { sx: (sw - w) / 2, sy: (sh - h) / 2, sw: w, sh: h };
}

// ───────────────────────────── route ─────────────────────────────

export interface Pt {
  x: number;
  y: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface GeoPt {
  lat: number;
  lng: number;
}

export interface Projection {
  project(p: GeoPt): Pt;
  /** Degrees of longitude and latitude shown across the box (after padding). */
  spanLng: number;
  spanLat: number;
  scale: number;
}

/**
 * Equirectangular projection (x scaled by cos of the mid latitude) fitted to `box` with `pad` px
 * on every side, uniform scale, centred. Tiny extents grow to `minSpanDeg` so a single hotel
 * doesn't zoom to the street.
 */
export function fitProjection(points: readonly GeoPt[], box: Box, pad: number, minSpanDeg = 0.08): Projection {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  let w = points.length ? Math.min(...lngs) : 0;
  let e = points.length ? Math.max(...lngs) : 0;
  let s = points.length ? Math.min(...lats) : 0;
  let n = points.length ? Math.max(...lats) : 0;
  const midLat = (s + n) / 2;
  const k = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  if ((e - w) * k < minSpanDeg) {
    const c = (w + e) / 2;
    w = c - minSpanDeg / k / 2;
    e = c + minSpanDeg / k / 2;
  }
  if (n - s < minSpanDeg) {
    const c = (s + n) / 2;
    s = c - minSpanDeg / 2;
    n = c + minSpanDeg / 2;
  }
  const innerW = Math.max(1, box.w - pad * 2);
  const innerH = Math.max(1, box.h - pad * 2);
  const dataW = (e - w) * k;
  const dataH = n - s;
  const scale = Math.min(innerW / dataW, innerH / dataH);
  const offX = box.x + pad + (innerW - dataW * scale) / 2;
  const offY = box.y + pad + (innerH - dataH * scale) / 2;
  return {
    project: (p) => ({ x: offX + (p.lng - w) * k * scale, y: offY + (n - p.lat) * scale }),
    spanLng: box.w / (k * scale),
    spanLat: box.h / scale,
    scale,
  };
}

export interface Cluster {
  /** 1-based, in order of the first visit. */
  n: number;
  x: number;
  y: number;
  /** Indices into the input points. */
  members: number[];
}

/**
 * Greedy clustering in input (chronological) order: a point joins the first cluster whose
 * centre is within `radius` px, otherwise it starts a new one. Centres are the member mean.
 */
export function clusterPoints(points: readonly Pt[], radius: number): Cluster[] {
  const out: Cluster[] = [];
  points.forEach((p, i) => {
    const hit = out.find((c) => Math.hypot(c.x - p.x, c.y - p.y) <= radius);
    if (hit) {
      hit.members.push(i);
      const m = hit.members.length;
      hit.x += (p.x - hit.x) / m;
      hit.y += (p.y - hit.y) / m;
    } else out.push({ n: out.length + 1, x: p.x, y: p.y, members: [i] });
  });
  return out;
}

/** Index of the cluster that holds each input point. */
export function clusterOf(clusters: readonly Cluster[], count: number): number[] {
  const idx = new Array<number>(count).fill(-1);
  clusters.forEach((c, ci) => c.members.forEach((m) => (idx[m] = ci)));
  return idx;
}

export interface Leg {
  from: Pt;
  to: Pt;
  /** Quadratic Bézier control point. */
  cp: Pt;
}

/**
 * Curved legs between consecutive distinct stops. Each bows out perpendicular to its chord by
 * `bow` × its length, alternating sides so return trips don't sit on top of the way out.
 */
export function routeLegs(stops: readonly Pt[], bow = 0.18): Leg[] {
  const legs: Leg[] = [];
  let side = 1;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const off = len * bow * side;
    legs.push({ from: a, to: b, cp: { x: mx + (-dy / len) * off, y: my + (dx / len) * off } });
    side = -side;
  }
  return legs;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const rectsOverlap = (a: Rect, b: Rect, gap = 0): boolean =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

/** First candidate rect inside `bounds` that overlaps none of `taken`, or null. */
export function placeRect(candidates: readonly Rect[], taken: readonly Rect[], bounds: Rect, gap = 6): Rect | null {
  for (const r of candidates) {
    const inside = r.x >= bounds.x && r.y >= bounds.y && r.x + r.w <= bounds.x + bounds.w && r.y + r.h <= bounds.y + bounds.h;
    if (inside && !taken.some((t) => rectsOverlap(r, t, gap))) return r;
  }
  return null;
}

// ───────────────────────────── svg markup ─────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** `color-mix(in srgb, A p%, B)` for hex colours (anything else is returned untouched as A). */
export function mixHex(a: string, pct: number, b: string): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return a;
  const t = Math.min(100, Math.max(0, pct)) / 100;
  return `#${x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Makes component SVG markup self-contained for rasterising through an `<img>` (which can't see
 * the page's CSS variables): `var(--x[, fallback])` → `tokens[x]` (or the fallback), then
 * `color-mix(in srgb, …)` → a hex. Unknown variables without a fallback become `currentColor`.
 */
export function resolveCssVars(markup: string, tokens: Readonly<Record<string, string>>): string {
  let out = markup;
  // Innermost first, so `var(--a, var(--b))` resolves too.
  for (let guard = 0; guard < 8 && out.includes('var(--'); guard++) {
    out = out.replace(/var\(--([\w-]+)\s*(?:,\s*([^()]*?))?\)/g, (_, name: string, fb?: string) => tokens[name] ?? fb?.trim() ?? 'currentColor');
  }
  return out.replace(/color-mix\(in srgb,\s*(#[0-9a-f]{3,6})\s+(\d+(?:\.\d+)?)%,\s*(#[0-9a-f]{3,6})\s*\)/gi, (_, a: string, p: string, b: string) =>
    mixHex(a, Number(p), b),
  );
}
