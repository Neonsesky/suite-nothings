/**
 * "Our journey" story poster: a 1080×1920 warm paper card with the route (a globe snapshot or
 * an illustrated adventure map), the four stats, the date range and the share caption.
 * Pure 2D canvas, no map dependency.
 */
import {
  COLORS,
  FONT_DISPLAY,
  FONT_SANS,
  drawImageCover,
  drawKeyTagPin,
  drawWordmark,
  fillTextFit,
  fontsReady,
  prng,
  roundRectPath,
  setFont,
  wrapLines,
  type Ctx,
} from './paint';

export interface StoryData {
  /** Chronological. */
  stops: { lat: number; lng: number }[];
  wishes: { lat: number; lng: number }[];
  stats: { hotels: number; cities: number; countries: number; km: string };
  /** e.g. `19 Jun 2026 – 19 Sep 2026`. */
  range: string;
  /** e.g. `Our journey so far: 7,420 km, 11 hotels`. */
  caption: string;
  /** Optional snapshot of the final globe view (route already in it), cover-cropped into the frame. */
  mapImage?: CanvasImageSource | null;
}

const W = 1080;
const H = 1920;
const MAX_LAT = 85;

/** Web-Mercator y for a latitude in degrees (north positive). */
function mercY(lat: number): number {
  const φ = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + φ / 2));
}

/**
 * Longitudes shifted into one continuous run: the cut goes in the widest empty gap, so
 * points either side of the antimeridian stay neighbours.
 */
function unwrapLngs(lngs: number[]): number[] {
  const norm = lngs.map((l) => ((((l + 180) % 360) + 360) % 360) - 180);
  if (norm.length < 2) return norm;
  const sorted = [...norm].sort((a, b) => a - b);
  let gap = sorted[0] + 360 - sorted[sorted.length - 1];
  let cutAfter: number | null = null; // null: the widest gap is already across ±180
  for (let i = 0; i < sorted.length - 1; i++) {
    const g = sorted[i + 1] - sorted[i];
    if (g > gap) {
      gap = g;
      cutAfter = sorted[i];
    }
  }
  if (cutAfter === null) return norm;
  const cut = cutAfter;
  return norm.map((l) => (l <= cut ? l + 360 : l));
}

type XY = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

/** Span shown around a single point when there's nothing else to fit (degrees of longitude). */
const SINGLE_SPAN_DEG = 20;

/**
 * Fits `points` into `box` (Web Mercator, north up, padded, aspect kept, centred) and returns
 * their positions plus a projector for other points, which are unwrapped to the nearest copy
 * of the fitted area.
 */
function fitProjection(points: { lat: number; lng: number }[], box: Box): { fitted: XY[]; project: (p: { lat: number; lng: number }) => XY } {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const pad = Math.min(box.w, box.h) * 0.12;
  const innerW = Math.max(0, box.w - pad * 2);
  const innerH = Math.max(0, box.h - pad * 2);
  if (points.length === 0) return { fitted: [], project: () => ({ x: cx, y: cy }) };
  const lngs = unwrapLngs(points.map((p) => p.lng));
  const xs = lngs.map((l) => (l * Math.PI) / 180);
  const ys = points.map((p) => -mercY(p.lat));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const EPS = 1e-12;
  const sx = maxX - minX > EPS ? innerW / (maxX - minX) : Infinity;
  const sy = maxY - minY > EPS ? innerH / (maxY - minY) : Infinity;
  const fittedScale = Math.min(sx, sy);
  const scale = Number.isFinite(fittedScale) ? fittedScale : innerW / ((SINGLE_SPAN_DEG * Math.PI) / 180);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const at = (x: number, y: number): XY => ({ x: cx + (x - midX) * scale, y: cy + (y - midY) * scale });
  const midLng = (midX * 180) / Math.PI;
  return {
    fitted: xs.map((x, i) => at(x, ys[i])),
    project: (p) => {
      const lng = p.lng + Math.round((midLng - p.lng) / 360) * 360;
      return at((lng * Math.PI) / 180, -mercY(p.lat));
    },
  };
}

/**
 * Projects points into `box` (Web Mercator, north up), fitted with padding and the aspect
 * kept, centred. A single point (or identical points) lands in the centre. Pure.
 */
export function projectStops(points: { lat: number; lng: number }[], box: Box): XY[] {
  return fitProjection(points, box).fitted;
}

/** Renders the poster. Waits for the app fonts first. */
export async function renderStoryCanvas(data: StoryData): Promise<HTMLCanvasElement> {
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');

  drawPaper(ctx);

  // header
  drawWordmark(ctx, W / 2, 138, 34);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.ink;
  fillTextFit(ctx, 'Our journey', W / 2, 282, W - 144, 800, 112, FONT_DISPLAY, { expanded: true });

  // map panel
  const panel = { x: 72, y: 340, w: W - 144, h: 900 };
  const drewSnapshot = data.mapImage ? drawSnapshotPanel(ctx, data.mapImage, panel) : false;
  if (!drewSnapshot) drawAdventureMap(ctx, data, panel);

  drawStats(ctx, data.stats, 1300);

  // divider
  ctx.strokeStyle = COLORS.ink;
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(160, 1540);
  ctx.lineTo(W - 160, 1540);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.muted;
  fillTextFit(ctx, data.range, W / 2, 1606, W - 160, 600, 36, FONT_SANS);
  ctx.fillStyle = COLORS.ink;
  setFont(ctx, 700, 42, FONT_SANS);
  let y = 1676;
  for (const line of wrapLines(ctx, data.caption, W - 200, 2)) {
    ctx.fillText(line, W / 2, y);
    y += 54;
  }
  ctx.fillStyle = COLORS.gingerInk;
  fillTextFit(ctx, 'To be continued…', W / 2, 1830, W - 160, 800, 60, FONT_DISPLAY, { expanded: true });
  return canvas;
}

/** Renders the poster as a PNG. */
export async function renderStoryImage(data: StoryData): Promise<Blob> {
  const canvas = await renderStoryCanvas(data);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image'))), 'image/png');
  });
}

/** Cream ground with soft honey/ginger glows and a faint deterministic paper grain. */
function drawPaper(ctx: Ctx): void {
  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,248,233,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  };
  glow(W * 0.9, 120, 700, COLORS.honeySoft, 0.9);
  glow(80, H * 0.88, 760, COLORS.gingerSoft, 0.7);
  const rand = prng(619);
  ctx.fillStyle = COLORS.ink;
  for (let i = 0; i < 2600; i++) {
    ctx.globalAlpha = 0.02 + rand() * 0.03;
    ctx.fillRect(rand() * W, rand() * H, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
}

/** The globe snapshot in a rounded frame. False if the image has no size. */
function drawSnapshotPanel(ctx: Ctx, img: CanvasImageSource, b: Box): boolean {
  ctx.save();
  panelShadow(ctx, b);
  roundRectPath(ctx, b.x, b.y, b.w, b.h, 40);
  ctx.clip();
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const ok = drawImageCover(ctx, img, b.x, b.y, b.w, b.h);
  ctx.restore();
  if (ok) panelBorder(ctx, b);
  return ok;
}

function panelShadow(ctx: Ctx, b: Box): void {
  ctx.save();
  ctx.shadowColor = 'rgba(41,41,53,0.18)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  roundRectPath(ctx, b.x, b.y, b.w, b.h, 40);
  ctx.fillStyle = COLORS.paper;
  ctx.fill();
  ctx.restore();
}

function panelBorder(ctx: Ctx, b: Box): void {
  roundRectPath(ctx, b.x, b.y, b.w, b.h, 40);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 4;
  ctx.stroke();
}

/** Illustrated panel: graticule, compass, ginger route with ink casing, key-tag pins, wishes. */
function drawAdventureMap(ctx: Ctx, data: StoryData, b: Box): void {
  panelShadow(ctx, b);
  ctx.save();
  roundRectPath(ctx, b.x, b.y, b.w, b.h, 40);
  ctx.clip();
  ctx.fillStyle = '#FFFDF7';
  ctx.fillRect(b.x, b.y, b.w, b.h);

  // graticule
  ctx.strokeStyle = COLORS.ink;
  ctx.globalAlpha = 0.07;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  const step = 104;
  for (let x = b.x + ((b.w % step) / 2 || step); x < b.x + b.w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, b.y);
    ctx.lineTo(x, b.y + b.h);
    ctx.stroke();
  }
  for (let y = b.y + ((b.h % step) / 2 || step); y < b.y + b.h; y += step) {
    ctx.beginPath();
    ctx.moveTo(b.x, y);
    ctx.lineTo(b.x + b.w, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  drawCompass(ctx, b.x + b.w - 96, b.y + 104, 46);

  const inner = { x: b.x + 40, y: b.y + 90, w: b.w - 80, h: b.h - 140 };
  // fit the route; wishes share the projection (far-away ones fall outside and are clipped)
  const fit = fitProjection(data.stops.length ? data.stops : data.wishes, inner);
  const stops = data.stops.length ? fit.fitted : [];
  const wishes = data.wishes.map(fit.project);
  const n = Math.max(1, data.stops.length);
  const pinH = Math.max(46, Math.min(84, 96 - n * 1.5));

  for (const w of wishes) drawKeyTagPin(ctx, w.x, w.y, pinH * 0.85, true);
  drawRoute(ctx, stops);
  stops.forEach((s) => drawKeyTagPin(ctx, s.x, s.y, pinH));
  if (stops.length > 0) drawBadge(ctx, stops[0], pinH, '1');
  if (stops.length > 1) drawBadge(ctx, stops[stops.length - 1], pinH, String(stops.length));
  ctx.restore();
  panelBorder(ctx, b);
}

/** Route as gently bowed curves (old-map feel): ink casing first, ginger on top. */
function drawRoute(ctx: Ctx, pts: { x: number; y: number }[]): void {
  if (pts.length < 2) return;
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const c = pts[i];
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;
      const bow = Math.min(0.16 * len, 80) * (i % 2 === 0 ? -1 : 1);
      ctx.quadraticCurveTo((a.x + c.x) / 2 - (dy / len) * bow, (a.y + c.y) / 2 + (dx / len) * bow, c.x, c.y);
    }
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  trace();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 15;
  ctx.stroke();
  ctx.strokeStyle = COLORS.ginger;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();
}

/** Small numbered ink badge beside a pin's head. */
function drawBadge(ctx: Ctx, at: { x: number; y: number }, pinH: number, label: string): void {
  const r = 22;
  const cx = at.x + pinH * 0.42;
  const cy = at.y - pinH * 0.95;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.ink;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.paper;
  ctx.stroke();
  ctx.fillStyle = COLORS.paper;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fillTextFit(ctx, label, cx, cy + 1, r * 1.6, 800, 24, FONT_SANS);
  ctx.restore();
}

/** Minimal compass rose: honey north needle, ink south, an N above. */
function drawCompass(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  const needle = (dir: 1 | -1, fill: string) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - dir * r * 0.8);
    ctx.lineTo(cx + r * 0.22, cy);
    ctx.lineTo(cx - r * 0.22, cy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  };
  needle(1, COLORS.honey);
  needle(-1, COLORS.paper);
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  setFont(ctx, 800, 24, FONT_SANS);
  ctx.fillText('N', cx, cy - r - 10);
  ctx.restore();
}

/** Four stats in a row with hairline dividers; long labels wrap to two lines. */
function drawStats(ctx: Ctx, stats: StoryData['stats'], top: number): void {
  const items: [string, string][] = [
    [String(stats.hotels), 'Hotels'],
    [String(stats.cities), 'Cities'],
    [String(stats.countries), 'Countries'],
    [stats.km, 'Kilometres travelled'],
  ];
  const left = 72;
  const colW = (W - left * 2) / items.length;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  items.forEach(([value, label], i) => {
    const cx = left + colW * i + colW / 2;
    if (i > 0) {
      ctx.strokeStyle = COLORS.ink;
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left + colW * i, top + 10);
      ctx.lineTo(left + colW * i, top + 180);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = COLORS.ink;
    fillTextFit(ctx, value, cx, top + 90, colW - 28, 800, 84, FONT_DISPLAY, { expanded: true });
    ctx.fillStyle = COLORS.muted;
    setFont(ctx, 600, 28, FONT_SANS);
    let y = top + 138;
    for (const line of wrapLines(ctx, label, colW - 24, 2)) {
      ctx.fillText(line, cx, y);
      y += 36;
    }
  });
  ctx.restore();
}
