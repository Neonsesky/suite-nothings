/**
 * Share card renderer (SPEC §12): 1080×1920 PNGs drawn on a canvas in the house style: cream and
 * honey grounds, ink-outlined rounded panels with a hard offset shadow (a comic-strip frame),
 * the display face set wide, mono timestamps, ginger for the love bits (the route, hours together).
 * No map tiles and no network beyond the app's own precached files, so it works offline and in demo.
 * Lazy chunk: import it only through `renderShareCard` in ./index.ts.
 */
import { COUPLE } from '@/config/couple';
import { BASE_URL } from '@/config/env';
import { MOOD_LABELS, type Stay } from '@/data/types';
import { formatDate, formatTimeRange } from '@/lib/dates';
import { summary, kmTravelled, hotelCount } from '@/lib/stats';
import { keyTagImage, moodStampImage, readTokens, stampFor, stayArtImage, type Tokens } from './art';
import {
  clusterOf,
  clusterPoints,
  coverFit,
  fitProjection,
  balanceLines,
  fitText,
  formatCount,
  placeRect,
  routeLegs,
  statItems,
  statsCaption,
  wrapText,
  type Box,
  type Pt,
  type Rect,
} from './layout';
import { CARD_H, CARD_W, type RouteCardData, type ShareCardDataMap, type ShareCardKind, type StatsCardData, type StayCardData } from './types';

type Ctx = CanvasRenderingContext2D;

const M = 72; // outer margin
const INNER_W = CARD_W - M * 2;
const FOOTER_Y = 1716;

// ───────────────────────────── fonts ─────────────────────────────

const DISPLAY = 'Archivo';
const SANS = 'Manrope';
const MONO = 'JetBrains Mono';

const FONT_FACES = [`800 100px ${DISPLAY}`, `700 40px ${SANS}`, `600 40px ${SANS}`, `500 40px ${SANS}`, `700 40px "${MONO}"`, `500 40px "${MONO}"`];

async function loadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(FONT_FACES.map((f) => document.fonts.load(f).catch(() => [])));
  // "expanded" picks the wide end of Archivo's wdth axis, like the app's headings.
  await document.fonts.load(`expanded 800 100px ${DISPLAY}`).catch(() => []);
  await document.fonts.ready;
}

type Face = 'display' | 'sans' | 'mono';

function setFont(ctx: Ctx, face: Face, weight: number, size: number, tracking = 0): void {
  const family = face === 'display' ? `${DISPLAY}, ${SANS}, sans-serif` : face === 'mono' ? `"${MONO}", ui-monospace, monospace` : `${SANS}, sans-serif`;
  ctx.font = `${weight} ${size}px ${family}`;
  const c = ctx as Ctx & { fontStretch?: string; letterSpacing?: string };
  if ('fontStretch' in c) c.fontStretch = face === 'display' ? 'expanded' : 'normal';
  if ('letterSpacing' in c) c.letterSpacing = `${tracking}px`;
}

const measurer = (ctx: Ctx, face: Face, weight: number, tracking = 0) => (size: number) => {
  return (t: string) => {
    setFont(ctx, face, weight, size, tracking);
    return ctx.measureText(t).width;
  };
};

// ───────────────────────────── primitives ─────────────────────────────

interface Paint {
  t: Tokens;
  ctx: Ctx;
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/** An ink-outlined panel with a hard offset shadow. */
function panel(p: Paint, b: Box, opts: { fill: string; radius?: number; stroke?: number; shadow?: string | null; offset?: number }): void {
  const { ctx, t } = p;
  const r = opts.radius ?? 36;
  const lw = opts.stroke ?? 5;
  const off = opts.offset ?? 14;
  if (opts.shadow !== null) {
    rrect(ctx, b.x + off, b.y + off, b.w, b.h, r);
    ctx.fillStyle = opts.shadow ?? t['color-ink'];
    ctx.fill();
    if (opts.shadow && opts.shadow !== t['color-ink']) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = t['color-ink'];
      ctx.stroke();
    }
  }
  rrect(ctx, b.x, b.y, b.w, b.h, r);
  ctx.fillStyle = opts.fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = t['color-ink'];
  ctx.stroke();
}

/** A pill chip; returns its width. */
function chip(
  p: Paint,
  x: number,
  y: number,
  text: string,
  opts: { face?: Face; size?: number; weight?: number; fill: string; h?: number; padX?: number; tracking?: number; align?: 'left' | 'right' },
): number {
  const { ctx, t } = p;
  const size = opts.size ?? 34;
  const h = opts.h ?? 76;
  const padX = opts.padX ?? 28;
  setFont(ctx, opts.face ?? 'mono', opts.weight ?? 600, size, opts.tracking ?? 0);
  const w = ctx.measureText(text).width + padX * 2;
  const left = opts.align === 'right' ? x - w : x;
  rrect(ctx, left, y, w, h, h / 2);
  ctx.fillStyle = opts.fill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = t['color-ink'];
  ctx.stroke();
  ctx.fillStyle = t['color-ink'];
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, left + padX, y + h / 2 + 1);
  return w;
}

function starPath(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.48;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function stars(p: Paint, x: number, cy: number, value: number, r = 20): number {
  const { ctx, t } = p;
  ctx.lineJoin = 'round';
  for (let i = 0; i < 5; i++) {
    starPath(ctx, x + r + i * (r * 2 + 8), cy, r);
    ctx.fillStyle = i < value ? t['color-honey'] : t['color-paper'];
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = t['color-ink'];
    ctx.stroke();
  }
  return 5 * (r * 2 + 8) - 8;
}

function heart(ctx: Ctx, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.7, cy - s * 1.2, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.7, cy - s * 1.2, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
  ctx.closePath();
}

function background(p: Paint): void {
  const { ctx, t } = p;
  ctx.fillStyle = t['color-cream'];
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // A honey wash rising from the bottom, like late-afternoon light.
  const g = ctx.createLinearGradient(0, CARD_H * 0.55, 0, CARD_H);
  g.addColorStop(0, `${t['color-honey-soft']}00`);
  g.addColorStop(1, t['color-honey-soft']);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
}

/** Key tag + name + tagline above a perforated rule. */
async function footer(p: Paint, mark: HTMLImageElement): Promise<void> {
  const { ctx, t } = p;
  ctx.save();
  ctx.setLineDash([2, 16]);
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = t['color-ink'];
  ctx.beginPath();
  ctx.moveTo(M, FOOTER_Y);
  ctx.lineTo(CARD_W - M, FOOTER_Y);
  ctx.stroke();
  ctx.restore();
  const size = 128;
  const y = FOOTER_Y + 40;
  ctx.drawImage(mark, M - 14, y - 10, size, size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = t['color-ink'];
  setFont(ctx, 'display', 800, 46);
  ctx.fillText(COUPLE.appName, M + size + 14, y + 52);
  setFont(ctx, 'sans', 500, 32);
  ctx.fillStyle = t['color-muted'];
  ctx.fillText(COUPLE.tagline, M + size + 14, y + 100);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

async function decodePhoto(blob: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const live = (stays: readonly Stay[]) =>
  stays
    .filter((s) => !s.visit.deleted && !s.hotel.deleted)
    .sort((a, b) => a.visit.date.localeCompare(b.visit.date) || (a.visit.check_in ?? '').localeCompare(b.visit.check_in ?? ''));

// ───────────────────────────── stay postcard ─────────────────────────────

async function drawStay(p: Paint, d: StayCardData, mark: HTMLImageElement): Promise<void> {
  const { ctx, t } = p;
  const { visit, hotel } = d.stay;
  background(p);

  // Top row: "Stay 5 of 12" ticket and the visit type.
  const n = Math.max(d.total, d.stay.stayNumber, 1);
  chip(p, M, 84, `STAY ${d.stay.stayNumber || 1} OF ${n}`, { fill: t['color-honey'], weight: 700, size: 32, tracking: 3 });
  chip(p, CARD_W - M, 84, visit.visit_type, { fill: t['color-paper'], face: 'sans', weight: 700, size: 32, align: 'right' });

  // Measure the text first; the photo takes whatever height is left (a "patchwork" of panels).
  // The mood stamp hangs ~100 px below the photo; the name starts clear of it.
  const nameGap = visit.mood ? 112 : 88;
  const name = fitText(hotel.name, { maxWidth: INNER_W, maxLines: 3, sizes: [112, 104, 96, 88, 80, 72, 64, 56] }, measurer(ctx, 'display', 800, -1));
  const nameLines = balanceLines(name.lines, measurer(ctx, 'display', 800, -1)(name.size));
  const lh = Math.round(name.size * 1.08);
  const ratings = (
    [
      [COUPLE.people.nirsh.name, visit.rating_nirsh],
      [COUPLE.people.shady.name, visit.rating_shady],
    ] as const
  ).filter(([, v]) => v != null);
  const momentText = visit.favourite_moment?.trim();
  const moment = momentText
    ? fitText(`“${momentText}”`, { maxWidth: INNER_W - 34, maxLines: 2, sizes: [36, 34, 32] }, measurer(ctx, 'sans', 500))
    : null;
  const textH =
    nameGap + name.size * 0.78 + (nameLines.length - 1) * lh + 64 + 44 + 76 + (ratings.length ? 44 + 44 : 0) + (moment ? 56 + moment.lines.length * 50 - 14 : 0);
  const photoTop = 204;
  const photo: Box = { x: M, y: photoTop, w: INNER_W - 14, h: Math.round(Math.min(900, Math.max(560, FOOTER_Y - 72 - textH - photoTop))) };

  // Photo (or the hotel's illustrated scene) in an ink-outlined frame.
  panel(p, photo, { fill: t['color-paper'], shadow: t['color-honey'], radius: 40, stroke: 6 });
  ctx.save();
  rrect(ctx, photo.x, photo.y, photo.w, photo.h, 40);
  ctx.clip();
  let drewPhoto = false;
  if (d.photo) {
    try {
      const img = await decodePhoto(d.photo);
      const c = coverFit(img.width, img.height, photo.w, photo.h);
      ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, photo.x, photo.y, photo.w, photo.h);
      if ('close' in img && typeof img.close === 'function') img.close();
      drewPhoto = true;
    } catch {
      drewPhoto = false;
    }
  }
  if (!drewPhoto) {
    const art = await stayArtImage(hotel.hotel_id, photo.w, photo.h, t);
    ctx.drawImage(art, photo.x, photo.y, photo.w, photo.h);
  }
  ctx.restore();
  rrect(ctx, photo.x, photo.y, photo.w, photo.h, 40);
  ctx.lineWidth = 6;
  ctx.strokeStyle = t['color-ink'];
  ctx.stroke();

  // Mood stamp pressed over the frame's corner.
  if (visit.mood) {
    const size = 232;
    const cx = photo.x + photo.w - 112;
    const cy = photo.y + photo.h - 14;
    const { tilt } = stampFor(visit.mood);
    const img = await moodStampImage(visit.mood, size, t);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((tilt * Math.PI) / 180);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    stampLabel(p, MOOD_LABELS[visit.mood], size);
    ctx.restore();
  }

  // Hotel name, as big as fits in three lines.
  let y = photo.y + photo.h + nameGap + name.size * 0.78;
  setFont(ctx, 'display', 800, name.size, -1);
  ctx.fillStyle = t['color-ink'];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  nameLines.forEach((line, i) => ctx.fillText(line, M, y + i * lh));
  y += (nameLines.length - 1) * lh + 64;

  const place = [hotel.area && hotel.area !== hotel.city ? hotel.area : null, hotel.city, hotel.country].filter(Boolean).join(', ');
  const placeFit = fitText(place, { maxWidth: INNER_W, maxLines: 1, sizes: [40, 36, 32] }, measurer(ctx, 'sans', 600));
  setFont(ctx, 'sans', 600, placeFit.size);
  ctx.fillStyle = t['color-muted'];
  ctx.fillText(placeFit.lines[0] ?? '', M, y);
  y += 44;

  // Date + check-in → out chips.
  let x = M;
  x += chip(p, x, y, formatDate(visit.date), { fill: t['color-paper'] }) + 18;
  const range = formatTimeRange(visit.check_in, visit.check_out);
  if (range) x += chip(p, x, y, range, { fill: t['color-honey-soft'] }) + 18;
  if (visit.nights > 0) {
    const label = `${visit.nights} ${visit.nights === 1 ? 'night' : 'nights'}`;
    setFont(ctx, 'mono', 600, 34);
    if (x + ctx.measureText(label).width + 56 <= CARD_W - M) chip(p, x, y, label, { fill: t['color-paper'] });
  }
  y += 76;

  // Ratings, one per person when given.
  if (ratings.length) {
    y += 44;
    let rx = M;
    for (const [person, v] of ratings) {
      setFont(ctx, 'sans', 700, 34);
      ctx.fillStyle = t['color-ink'];
      ctx.textBaseline = 'middle';
      ctx.fillText(person, rx, y + 22);
      rx += ctx.measureText(person).width + 18;
      rx += stars(p, rx, y + 20, v ?? 0, 19) + 52;
    }
    y += 44;
  }

  // Our favourite moment, with a ginger rule (love colour).
  if (moment) {
    y += 56;
    ctx.fillStyle = t['color-ginger'];
    rrect(ctx, M, y - 34, 8, moment.lines.length * 50 - 2, 4);
    ctx.fill();
    setFont(ctx, 'sans', 500, moment.size);
    ctx.fillStyle = t['color-ink'];
    ctx.textBaseline = 'alphabetic';
    moment.lines.forEach((l, i) => ctx.fillText(l, M + 34, y + i * 50));
  }

  await footer(p, mark);
}

/** The stamp's label along its lower arc (the SVG's own <text> can't reach the web fonts). */
function stampLabel(p: Paint, label: string, size: number): void {
  const { ctx, t } = p;
  const k = size / 72;
  const r = 22 * k;
  const text = label.toUpperCase();
  const fontSize = (text.length > 8 ? 6.6 : 7.6) * k;
  setFont(ctx, 'sans', 800, fontSize, 0);
  const spacing = fontSize * (text.length > 8 ? 0.06 : 0.12);
  const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let theta = Math.PI / 2 + total / 2 / r;
  ctx.fillStyle = t['color-ink'];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const cy = 2 * k; // the label arc is centred 2 units below the stamp's centre
  [...text].forEach((ch, i) => {
    const w = widths[i];
    const mid = theta - (w - spacing) / 2 / r;
    ctx.save();
    ctx.translate(Math.cos(mid) * r, cy + Math.sin(mid) * r);
    ctx.rotate(mid - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    theta -= w / r;
  });
}

// ───────────────────────────── stats card ─────────────────────────────

function header(p: Paint, title: string, sub: string, mark: HTMLImageElement): number {
  const { ctx, t } = p;
  ctx.drawImage(mark, M - 10, 70, 96, 96);
  setFont(ctx, 'mono', 700, 28, 4);
  ctx.fillStyle = t['color-ink'];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(COUPLE.appName.toUpperCase(), M + 96, 120);
  const fit = fitText(title, { maxWidth: INNER_W, maxLines: 2, sizes: [96, 88, 80, 72, 64] }, measurer(ctx, 'display', 800, -1));
  const lines = balanceLines(fit.lines, measurer(ctx, 'display', 800, -1)(fit.size));
  setFont(ctx, 'display', 800, fit.size, -1);
  ctx.textBaseline = 'alphabetic';
  const lh = Math.round(fit.size * 1.06);
  let y = 230 + fit.size * 0.78;
  lines.forEach((l, i) => ctx.fillText(l, M, y + i * lh));
  y += (lines.length - 1) * lh + 70;
  const sf = fitText(sub, { maxWidth: INNER_W, maxLines: 2, sizes: [40, 36, 32] }, measurer(ctx, 'sans', 600));
  setFont(ctx, 'sans', 600, sf.size);
  ctx.fillStyle = t['color-muted'];
  sf.lines.forEach((l, i) => ctx.fillText(l, M, y + i * 52));
  return y + (sf.lines.length - 1) * 52;
}

async function drawStats(p: Paint, d: StatsCardData, mark: HTMLImageElement): Promise<void> {
  const { ctx, t } = p;
  background(p);
  const sum = summary(d.stays, d.home);
  const bottom = header(p, 'Our stays, by the numbers', statsCaption(sum), mark);

  const items = statItems(sum);
  const fills: Record<string, string> = {
    hotels: t['color-honey'],
    visits: t['color-paper'],
    hours: t['color-ginger-soft'],
    cities: t['color-paper'],
    countries: t['color-honey-soft'],
    km: t['color-honey'],
  };
  const gap = 32;
  const top = bottom + 80;
  const colW = (INNER_W - 14 - gap) / 2;
  const rowH = (FOOTER_Y - 150 - top - gap * 2) / 3;
  const valueSizes = [168, 152, 136, 120, 104, 92, 80, 68];
  const measureValue = measurer(ctx, 'display', 800, -2);
  // One size for every number, so the grid reads as a set.
  const valueSize = Math.min(
    ...items.map((it) => fitText(it.value, { maxWidth: colW - 80, maxLines: 1, sizes: valueSizes }, measureValue).size),
    Math.floor(rowH * 0.5),
  );
  items.forEach((it, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const b: Box = { x: M + col * (colW + gap), y: top + row * (rowH + gap), w: colW, h: rowH };
    panel(p, b, { fill: fills[it.key], radius: 36, stroke: 5, offset: 12 });
    setFont(ctx, 'display', 800, valueSize, -2);
    ctx.fillStyle = t['color-ink'];
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(it.value, b.x + 40, b.y + 40 + valueSize * 0.76);
    setFont(ctx, 'sans', 700, 36);
    ctx.fillStyle = it.key === 'hours' ? t['color-ginger-ink'] : t['color-ink'];
    ctx.fillText(it.label, b.x + 40, b.y + b.h - 44);
    if (it.key === 'hours') {
      heart(ctx, b.x + b.w - 62, b.y + 58, 22);
      ctx.fillStyle = t['color-ginger'];
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = t['color-ink'];
      ctx.stroke();
    }
  });

  // Together since …
  const since = `Together since ${formatDate(COUPLE.togetherSince.slice(0, 10))}`;
  setFont(ctx, 'mono', 600, 32, 1);
  ctx.fillStyle = t['color-ink'];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const sy = FOOTER_Y - 76;
  heart(ctx, M + 18, sy, 15);
  ctx.fillStyle = t['color-ginger'];
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = t['color-ink'];
  ctx.stroke();
  ctx.fillStyle = t['color-ink'];
  ctx.fillText(since, M + 52, sy + 1);

  await footer(p, mark);
}

// ───────────────────────────── route card ─────────────────────────────

type Ring = [number, number][];
let landCache: Promise<Ring[][] | null> | null = null;

/** Natural Earth 110m land, shipped with the app for the map's offline fallback. */
function loadLand(): Promise<Ring[][] | null> {
  landCache ??= (async () => {
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${BASE_URL}fallback-world.geojson`, { signal: ctrl.signal });
      window.clearTimeout(timer);
      if (!res.ok) return null;
      const gj = (await res.json()) as { features: { geometry: { type: string; coordinates: unknown } }[] };
      const polys: Ring[][] = [];
      for (const f of gj.features) {
        if (f.geometry.type === 'Polygon') polys.push(f.geometry.coordinates as Ring[]);
        else if (f.geometry.type === 'MultiPolygon') polys.push(...(f.geometry.coordinates as Ring[][]));
      }
      return polys;
    } catch {
      return null;
    }
  })();
  const pending = landCache;
  void pending.then((v) => {
    if (!v && landCache === pending) landCache = null; // retry next time
  });
  return pending;
}

async function drawRoute(p: Paint, d: RouteCardData, mark: HTMLImageElement): Promise<void> {
  const { ctx, t } = p;
  background(p);
  const stays = live(d.stays);
  const km = Math.round(kmTravelled(stays, d.home));
  const hotels = hotelCount(stays);
  const sub = `${formatCount(km)} km, ${formatCount(hotels)} ${hotels === 1 ? 'hotel' : 'hotels'}`;
  const bottom = header(p, d.title ?? 'Our journey so far', sub, mark);

  const box: Box = { x: M, y: bottom + 72, w: INNER_W - 14, h: 0 };
  box.h = FOOTER_Y - 200 - box.y;
  panel(p, box, { fill: t['color-paper'], shadow: t['color-honey'], radius: 40, stroke: 6 });

  const pts = stays.map((s) => ({ lat: s.hotel.lat, lng: s.hotel.lng }));
  const geo = d.home ? [d.home, ...pts] : pts;
  const proj = fitProjection(geo.length ? geo : [{ lat: COUPLE.defaultHomeBase.lat, lng: COUPLE.defaultHomeBase.lng }], box, 120);

  ctx.save();
  rrect(ctx, box.x, box.y, box.w, box.h, 40);
  ctx.clip();

  // Land (only when zoomed out enough for 110m coastlines to look right).
  if (proj.spanLng > 3) {
    const land = await loadLand();
    if (land) {
      ctx.fillStyle = t['color-honey-soft'];
      ctx.lineWidth = 3;
      ctx.strokeStyle = `${t['color-ink']}55`;
      for (const poly of land) {
        ctx.beginPath();
        for (const ring of poly) {
          ring.forEach(([lng, lat], i) => {
            const q = proj.project({ lat, lng });
            if (i === 0) ctx.moveTo(q.x, q.y);
            else ctx.lineTo(q.x, q.y);
          });
          ctx.closePath();
        }
        ctx.fill('evenodd');
        ctx.stroke();
      }
    }
  }
  // Dotted graticule-ish grid for texture.
  ctx.fillStyle = `${t['color-ink']}22`;
  for (let gx = box.x + 36; gx < box.x + box.w; gx += 48) for (let gy = box.y + 36; gy < box.y + box.h; gy += 48) ctx.fillRect(gx - 2, gy - 2, 4, 4);

  // Stops → clusters (hotels within a pin's reach share one numbered pin).
  const projected = pts.map((q) => proj.project(q));
  const clusters = clusterPoints(projected, 64);
  const of = clusterOf(clusters, projected.length);
  const homePt = d.home ? proj.project(d.home) : null;
  const homeCluster = homePt ? clusters.findIndex((c) => Math.hypot(c.x - homePt.x, c.y - homePt.y) <= 64) : -1;

  // Route: home → each stop in order (consecutive repeats collapse).
  const seq: Pt[] = [];
  const push = (q: Pt) => {
    const last = seq[seq.length - 1];
    if (!last || Math.hypot(last.x - q.x, last.y - q.y) > 1) seq.push(q);
  };
  if (homePt) push(homeCluster >= 0 ? clusters[homeCluster] : homePt);
  of.forEach((ci) => push(clusters[ci]));
  const legs = routeLegs(seq, 0.2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const leg of legs) {
    ctx.beginPath();
    ctx.moveTo(leg.from.x, leg.from.y);
    ctx.quadraticCurveTo(leg.cp.x, leg.cp.y, leg.to.x, leg.to.y);
    ctx.setLineDash([]);
    ctx.lineWidth = 16;
    ctx.strokeStyle = t['color-paper'];
    ctx.stroke();
    ctx.setLineDash([24, 18]);
    ctx.lineWidth = 9;
    ctx.strokeStyle = t['color-ginger'];
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Home marker (when it isn't under a pin).
  const taken: Rect[] = clusters.map((c) => ({ x: c.x - 34, y: c.y - 34, w: 68, h: 68 }));
  if (homePt && homeCluster < 0) {
    homeMarker(p, homePt);
    taken.push({ x: homePt.x - 30, y: homePt.y - 30, w: 60, h: 60 });
  }

  // Pins.
  clusters.forEach((c, ci) => {
    const home = ci === homeCluster;
    if (home) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 50, 0, Math.PI * 2);
      ctx.fillStyle = `${t['color-honey']}66`;
      ctx.fill();
      ctx.setLineDash([3, 10]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = t['color-ink'];
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.arc(c.x, c.y, 32, 0, Math.PI * 2);
    ctx.fillStyle = c.members.length > 1 ? t['color-honey'] : t['color-paper'];
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = t['color-ink'];
    ctx.stroke();
    setFont(ctx, 'mono', 700, c.n > 9 ? 26 : 30);
    ctx.fillStyle = t['color-ink'];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(c.n), c.x, c.y + 1);
  });

  // Labels: the city (or the hotel when it's the only one there), placed where they fit.
  const bounds: Rect = { x: box.x + 16, y: box.y + 16, w: box.w - 32, h: box.h - 32 };
  clusters.forEach((c, ci) => {
    const members = c.members.map((m) => stays[m]);
    const hotelIds = new Set(members.map((s) => s.hotel.hotel_id));
    const citiesHere = new Set(members.map((s) => s.hotel.city));
    let label = hotelIds.size === 1 && clusters.length > 1 && citiesHere.size === 1 && proj.spanLng < 1 ? members[0].hotel.name : [...citiesHere][0];
    if (citiesHere.size > 1) label = `${[...citiesHere][0]} +${citiesHere.size - 1}`;
    if (ci === homeCluster) label = `${label} · home`;
    const count = members.length > 1 ? `×${members.length}` : '';
    setFont(ctx, 'sans', 700, 30);
    const lw = Math.min(ctx.measureText(label).width, 420);
    setFont(ctx, 'mono', 600, 26);
    const cw = count ? ctx.measureText(count).width + 14 : 0;
    const w = lw + cw + 40;
    const h = 56;
    const r = ci === homeCluster ? 54 : 40;
    const cand: Rect[] = [
      { x: c.x + r, y: c.y - h / 2, w, h },
      { x: c.x - r - w, y: c.y - h / 2, w, h },
      { x: c.x - w / 2, y: c.y - r - h, w, h },
      { x: c.x - w / 2, y: c.y + r, w, h },
      { x: c.x + r * 0.7, y: c.y - r - h + 8, w, h },
      { x: c.x - r * 0.7 - w, y: c.y + r - 8, w, h },
    ];
    const spot = placeRect(cand, taken, bounds, 4);
    if (!spot) return;
    taken.push(spot);
    rrect(ctx, spot.x, spot.y, spot.w, spot.h, h / 2);
    ctx.fillStyle = t['color-paper'];
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = t['color-ink'];
    ctx.stroke();
    setFont(ctx, 'sans', 700, 30);
    ctx.fillStyle = t['color-ink'];
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const fitL = fitText(label, { maxWidth: 420, maxLines: 1, sizes: [30] }, measurer(ctx, 'sans', 700));
    setFont(ctx, 'sans', 700, 30);
    ctx.fillText(fitL.lines[0] ?? label, spot.x + 20, spot.y + h / 2 + 1);
    if (count) {
      setFont(ctx, 'mono', 600, 26);
      ctx.fillStyle = t['color-muted'];
      ctx.fillText(count, spot.x + 20 + lw + 14, spot.y + h / 2 + 2);
    }
  });
  ctx.restore();
  rrect(ctx, box.x, box.y, box.w, box.h, 40);
  ctx.lineWidth = 6;
  ctx.strokeStyle = t['color-ink'];
  ctx.stroke();

  // Itinerary: the places in the order we first reached them.
  const order = clusters.map((c) => {
    const s = stays[c.members[0]];
    return s.hotel.city;
  });
  const names = order.filter((n, i) => order.indexOf(n) === i);
  if (names.length) {
    const text = names.join('  →  ');
    const lines = wrapText(text, INNER_W, measurer(ctx, 'sans', 600)(32));
    setFont(ctx, 'sans', 600, 32);
    ctx.fillStyle = t['color-ink'];
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const y0 = box.y + box.h + 82;
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(i === 1 && lines.length > 2 ? `${l} …` : l, M, y0 + i * 46));
  }

  await footer(p, mark);
}

function homeMarker(p: Paint, at: Pt): void {
  const { ctx, t } = p;
  const s = 30;
  ctx.beginPath();
  ctx.moveTo(at.x, at.y - s);
  ctx.lineTo(at.x + s, at.y - 2);
  ctx.lineTo(at.x + s * 0.72, at.y - 2);
  ctx.lineTo(at.x + s * 0.72, at.y + s * 0.85);
  ctx.lineTo(at.x - s * 0.72, at.y + s * 0.85);
  ctx.lineTo(at.x - s * 0.72, at.y - 2);
  ctx.lineTo(at.x - s, at.y - 2);
  ctx.closePath();
  ctx.fillStyle = t['color-honey'];
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = t['color-ink'];
  ctx.stroke();
}

// ───────────────────────────── entry ─────────────────────────────

/** Renders a 1080×1920 PNG share card. */
export async function renderShareCard<K extends ShareCardKind>(kind: K, data: ShareCardDataMap[K]): Promise<Blob> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  const t = readTokens();
  const p: Paint = { ctx, t };
  const mark = await keyTagImage(128, t);
  if (kind === 'stay') await drawStay(p, data as StayCardData, mark);
  else if (kind === 'stats') await drawStats(p, data as StatsCardData, mark);
  else await drawRoute(p, data as RouteCardData, mark);
  return canvasToBlob(canvas);
}
