/**
 * Journey video overlay: everything drawn on top of the map frame in the exported
 * 1080×1920 video (pins, wishes, traveller, split-flap date, postcard, finale, brand).
 * Positions in `OverlayState` are CSS px of the source map canvas; `CoverTransform` maps
 * them to output px. Pure 2D canvas, no React or map imports.
 */
import {
  COLORS,
  FONT_DISPLAY,
  FONT_MONO,
  FONT_SANS,
  PIN_ARTWORK_H,
  clamp01,
  drawImageCover,
  drawKeyTagPin,
  easeOutCubic,
  ellipsize,
  fillSeedGradient,
  fillTextFit,
  formatInt,
  path,
  pinWidth,
  roundRectPath,
  setFont,
  wrapLines,
  type Ctx,
} from './paint';

export type TravellerKind = 'heart' | 'car' | 'plane';

export interface OverlayState {
  /** Date board text, already upper-case, e.g. `19 JUN 2026`. */
  date: string | null;
  postcard: { name: string; date: string; stayOf: string; line: string | null; image: CanvasImageSource | null; seed: string } | null;
  /** CSS px in the source map canvas space. */
  pins: { x: number; y: number; scale: number }[];
  /** `pulse` 0..1. */
  wishes: { x: number; y: number; pulse: number }[];
  /** `rotation` in degrees, screen space, 0 = pointing up. */
  traveller: { x: number; y: number; rotation: number; kind: TravellerKind } | null;
  /** `progress` 0..1 drives the stats roll-in; `title` is 'To be continued…'. */
  finale: { hotels: number; cities: number; countries: number; km: string; progress: number; title: string } | null;
}

/** Source CSS px → output px: `out = src * scale + d`. */
export interface CoverTransform {
  scale: number;
  dx: number;
  dy: number;
}

/** object-fit: cover, centred. */
export function coverTransform(srcW: number, srcH: number, outW: number, outH: number): CoverTransform {
  if (!(srcW > 0) || !(srcH > 0)) return { scale: 1, dx: 0, dy: 0 };
  const scale = Math.max(outW / srcW, outH / srcH);
  return { scale, dx: (outW - srcW * scale) / 2, dy: (outH - srcH * scale) / 2 };
}

/** Draws the full overlay for one frame. Order: wishes, pins, traveller, date, postcard, finale, brand. */
export function drawOverlay(ctx: CanvasRenderingContext2D, state: OverlayState, t: CoverTransform, outW: number, outH: number): void {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const pinBase = Math.min(140, Math.max(72, PIN_ARTWORK_H * t.scale));
  for (const w of state.wishes) drawWish(ctx, w.x * t.scale + t.dx, w.y * t.scale + t.dy, pinBase, w.pulse);
  for (const p of state.pins) drawKeyTagPin(ctx, p.x * t.scale + t.dx, p.y * t.scale + t.dy, pinBase * (p.scale > 0 ? p.scale : 1));
  if (state.traveller) {
    const tr = state.traveller;
    drawTraveller(ctx, tr.x * t.scale + t.dx, tr.y * t.scale + t.dy, tr.rotation, tr.kind, 1.15);
  }
  if (state.finale) drawFinale(ctx, state.finale, outW, outH);
  if (state.date) drawDateBoard(ctx, state.date, outW, 150);
  if (state.postcard && !state.finale) drawPostcard(ctx, state.postcard, outW, outH);
  drawBrand(ctx, outW, outH);
  ctx.restore();
}

/** Dashed wish pin with a soft honey ring pulsing out from its tip. */
function drawWish(ctx: Ctx, x: number, y: number, height: number, pulse: number): void {
  const p = clamp01(pulse);
  ctx.save();
  const r = height * (0.18 + 0.42 * p);
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.honeyDeep;
  ctx.globalAlpha = 0.85 * (1 - p);
  ctx.lineWidth = Math.max(3, height * 0.05);
  ctx.stroke();
  ctx.fillStyle = COLORS.honey;
  ctx.globalAlpha = 0.25 * (1 - p);
  ctx.fill();
  ctx.restore();
  drawKeyTagPin(ctx, x, y, height * 0.9, true);
}

/* Traveller artwork in a 100-unit box centred on 0,0, pointing up (−y). */
const HEART_D = 'M0 34C-12 25-42 6-42-13C-42-29-29-38-17-38C-8-38-2-32 0-27C2-32 8-38 17-38C29-38 42-29 42-13C42 6 12 25 0 34Z';
const PLANE_D =
  'M0-46C4-46 6-40 6-32V-12L44 8V17L6 6V27L18 37V44L0 39L-18 44V37L-6 27V6L-44 17V8L-6-12V-32C-6-40-4-46 0-46Z';
const CAR_BODY_D = 'M-22-30C-22-40-14-46 0-46C14-46 22-40 22-30V32C22 41 15 46 0 46C-15 46-22 41-22 32Z';
const CAR_GLASS_D = 'M-16-10L16-10L13-24C5-27-5-27-13-24Z M-14 24L14 24L12 32C4 34-4 34-12 32Z';

/**
 * The traveller marker at (x, y). Car and plane turn with `rotation` (degrees, 0 = up);
 * the heart stays upright, since a tilted heart reads as a mistake.
 */
function drawTraveller(ctx: Ctx, x: number, y: number, rotation: number, kind: TravellerKind, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  if (kind !== 'heart') ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = COLORS.ink;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  if (kind === 'heart') {
    ctx.fillStyle = COLORS.ginger;
    ctx.fill(path(HEART_D));
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4.5;
    ctx.stroke(path(HEART_D));
    // little shine
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-18, -14, 12, Math.PI * 1.05, Math.PI * 1.45);
    ctx.stroke();
  } else if (kind === 'plane') {
    ctx.fillStyle = COLORS.paper;
    ctx.fill(path(PLANE_D));
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4;
    ctx.stroke(path(PLANE_D));
    ctx.fillStyle = COLORS.honey;
    ctx.beginPath();
    ctx.ellipse(0, -30, 3.2, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = COLORS.ink;
    for (const [wx, wy] of [[-25, -26], [19, -26], [-25, 18], [19, 18]]) {
      roundRectPath(ctx, wx, wy, 6, 15, 2);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.honey;
    ctx.fill(path(CAR_BODY_D));
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4;
    ctx.stroke(path(CAR_BODY_D));
    ctx.fillStyle = COLORS.ink;
    ctx.fill(path(CAR_GLASS_D));
    ctx.fillStyle = COLORS.cream;
    for (const hx of [-13, 13]) {
      ctx.beginPath();
      ctx.arc(hx, -40, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Split-flap date board centred at the top: one dark tile per character, hairline split. */
function drawDateBoard(ctx: Ctx, text: string, outW: number, top: number): void {
  const chars = [...text];
  const margin = 72;
  const gap = 8;
  let tileH = 96;
  let tileW = 66;
  const units = chars.reduce((n, ch) => n + (ch === ' ' ? 0.4 : 1), 0);
  const want = units * tileW + (chars.length - 1) * gap;
  if (want > outW - margin * 2) {
    const k = (outW - margin * 2) / want;
    tileW *= k;
    tileH *= k;
  }
  const total = units * tileW + (chars.length - 1) * gap;
  let x = (outW - total) / 2;
  const r = tileH * 0.12;
  ctx.save();
  setFont(ctx, 700, tileH * 0.62, FONT_MONO);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const ch of chars) {
    if (ch === ' ') {
      x += tileW * 0.4 + gap;
      continue;
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    roundRectPath(ctx, x, top, tileW, tileH, r);
    const g = ctx.createLinearGradient(0, top, 0, top + tileH);
    g.addColorStop(0, '#383846');
    g.addColorStop(0.5, COLORS.ink);
    g.addColorStop(0.5, '#22222c');
    g.addColorStop(1, '#2d2d3a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = COLORS.cream;
    ctx.fillText(ch, x + tileW / 2, top + tileH / 2 + tileH * 0.03);
    // the split: a dark hairline with a faint highlight under it, plus hinge notches
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x, top + tileH / 2 - 1.5, tileW, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, top + tileH / 2 + 1.5, tileW, 1.5);
    ctx.fillStyle = '#16161d';
    ctx.fillRect(x - 1, top + tileH / 2 - 5, 4, 10);
    ctx.fillRect(x + tileW - 3, top + tileH / 2 - 5, 4, 10);
    x += tileW + gap;
  }
  ctx.restore();
}

/** Postcard near the bottom: photo (or seeded warm gradient), name, `date · stayOf`, note. */
function drawPostcard(ctx: Ctx, card: NonNullable<OverlayState['postcard']>, outW: number, outH: number): void {
  const pad = 28;
  const x = 64;
  const w = outW - x * 2;
  const img = 236;
  const h = img + pad * 2;
  const y = outH - 230 - h;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  roundRectPath(ctx, x, y, w, h, 24);
  ctx.fillStyle = COLORS.paper;
  ctx.fill();
  ctx.restore();

  // photo
  const ix = x + pad;
  const iy = y + pad;
  ctx.save();
  roundRectPath(ctx, ix, iy, img, img, 16);
  ctx.clip();
  const drawn = card.image ? drawImageCover(ctx, card.image, ix, iy, img, img) : false;
  if (!drawn) {
    fillSeedGradient(ctx, card.seed, ix, iy, img, img);
    const initial = [...card.name.trim()][0]?.toUpperCase();
    if (initial) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      setFont(ctx, 800, img * 0.5, FONT_DISPLAY, { expanded: true });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initial, ix + img / 2, iy + img / 2 + img * 0.03);
    }
  }
  ctx.restore();

  // text column
  const tx = ix + img + 32;
  const tw = x + w - pad - tx;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.ink;
  setFont(ctx, 800, 46, FONT_SANS);
  const nameLines = wrapLines(ctx, card.name, tw, 2);
  let ty = iy + 44;
  for (const line of nameLines) {
    ctx.fillText(line, tx, ty);
    ty += 54;
  }
  ctx.fillStyle = COLORS.muted;
  setFont(ctx, 600, 30, FONT_SANS);
  ctx.fillText(ellipsize(ctx, [card.date, card.stayOf].filter(Boolean).join(' · '), tw), tx, ty);
  if (card.line && card.line.trim()) {
    ty += 50;
    ctx.fillStyle = COLORS.ink;
    setFont(ctx, 500, 31, FONT_SANS, { italic: true });
    const maxLines = nameLines.length > 1 ? 1 : 2;
    const lines = wrapLines(ctx, `“${card.line.trim()}”`, tw, maxLines);
    if (lines.length && !lines[lines.length - 1].endsWith('”') && !lines[lines.length - 1].endsWith('…')) lines[lines.length - 1] += '”';
    for (const line of lines) {
      ctx.fillText(line, tx, ty);
      ty += 42;
    }
  }
  ctx.restore();
}

const STAT_LABELS = ['Hotels', 'Cities', 'Countries', 'Kilometres travelled'] as const;

/** Counts a display number (`7,420`) up with `p`; shows the exact original string at the end. */
function countUp(value: string | number, p: number): string {
  const raw = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(raw)) return String(value);
  if (p >= 1) return typeof value === 'number' ? formatInt(value) : value;
  return formatInt(raw * easeOutCubic(p));
}

/** Finale card: title, then four stats rolling in and counting up with `progress`. */
function drawFinale(ctx: Ctx, f: NonNullable<OverlayState['finale']>, outW: number, outH: number): void {
  const p = clamp01(f.progress);
  const appear = clamp01(p * 5);
  ctx.save();
  // wash the map so the card reads
  ctx.fillStyle = `rgba(255,248,233,${0.45 * appear})`;
  ctx.fillRect(0, 0, outW, outH);

  const x = 64;
  const w = outW - x * 2;
  const h = 860;
  const y = (outH - h) / 2 + 40 + (1 - easeOutCubic(appear)) * 40;
  ctx.globalAlpha = appear;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 14;
  roundRectPath(ctx, x, y, w, h, 40);
  ctx.fillStyle = COLORS.paper;
  ctx.fill();
  ctx.restore();
  roundRectPath(ctx, x + 18, y + 18, w - 36, h - 36, 28);
  ctx.strokeStyle = COLORS.honey;
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 10]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.ink;
  fillTextFit(ctx, f.title, outW / 2, y + 170, w - 120, 800, 92, FONT_DISPLAY, { expanded: true });
  // ginger underline swash
  ctx.strokeStyle = COLORS.ginger;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(outW / 2 - 150, y + 210);
  ctx.quadraticCurveTo(outW / 2, y + 226, outW / 2 + 150, y + 206);
  ctx.stroke();

  const values: (string | number)[] = [f.hotels, f.cities, f.countries, f.km];
  const colW = (w - 80) / 2;
  const rowH = 250;
  const gridTop = y + 290;
  values.forEach((v, i) => {
    const local = clamp01((p - i * 0.1) / 0.7);
    const e = easeOutCubic(local);
    const cx = x + 40 + colW * (i % 2) + colW / 2;
    const cy = gridTop + rowH * Math.floor(i / 2) + (1 - e) * 30;
    ctx.save();
    ctx.globalAlpha = appear * clamp01(local * 3);
    ctx.fillStyle = COLORS.ink;
    fillTextFit(ctx, countUp(v, local), cx, cy + 110, colW - 40, 800, 120, FONT_DISPLAY, { expanded: true });
    ctx.fillStyle = COLORS.muted;
    fillTextFit(ctx, STAT_LABELS[i], cx, cy + 170, colW - 30, 600, 34, FONT_SANS);
    ctx.restore();
  });
  ctx.restore();
}

/** "Suite Nothings" pill at the bottom centre. */
function drawBrand(ctx: Ctx, outW: number, outH: number): void {
  ctx.save();
  setFont(ctx, 800, 30, FONT_SANS);
  const label = 'Suite Nothings';
  const tw = ctx.measureText(label).width;
  const pinH = 38;
  const w = tw + pinWidth(pinH) + 14 + 56;
  const h = 64;
  const x = (outW - w) / 2;
  const y = outH - 120 - h / 2;
  ctx.shadowColor = 'rgba(0,0,0,0.16)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fill();
  ctx.restore();
  ctx.save();
  drawKeyTagPin(ctx, x + 28 + pinWidth(pinH) / 2, y + h / 2 + pinH * 0.42, pinH);
  setFont(ctx, 800, 30, FONT_SANS);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.ink;
  ctx.fillText(label, x + 28 + pinWidth(pinH) + 14, y + h / 2 + 1);
  ctx.restore();
}
