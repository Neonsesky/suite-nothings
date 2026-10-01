/**
 * Shared 2D-canvas drawing helpers for the journey exports (video overlay and story poster).
 * Colours and font stacks mirror src/styles/tokens.css; canvas can't read CSS custom
 * properties from an offscreen canvas, so they are literal here. Path2D objects are built
 * lazily so importing this module never touches canvas APIs (tests run without them).
 */
import { PIN_COLORS } from '@/components/brand/pins';

export const COLORS = {
  ...PIN_COLORS,
  honeySoft: '#FFEAB0',
  honeyDeep: '#FFAF36',
  gingerInk: '#B3302A',
  muted: '#54545D',
  subtle: '#6B7280',
  line: '#E5E7EB',
} as const;

const SANS_FALLBACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const FONT_SANS = `Manrope, ${SANS_FALLBACK}`;
export const FONT_DISPLAY = `Archivo, Manrope, ${SANS_FALLBACK}`;
export const FONT_MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export type Ctx = CanvasRenderingContext2D;

/** Sets `ctx.font`, and the wide display stretch (tokens: 125%) where the browser supports it. */
export function setFont(ctx: Ctx, weight: number, sizePx: number, family: string, opts: { italic?: boolean; expanded?: boolean } = {}): void {
  ctx.font = `${opts.italic ? 'italic ' : ''}${weight} ${Math.round(sizePx)}px ${family}`;
  if ('fontStretch' in ctx) ctx.fontStretch = opts.expanded ? 'expanded' : 'normal';
}

/** Draws text shrunk (never grown) so it fits `maxWidth`. */
export function fillTextFit(ctx: Ctx, text: string, x: number, y: number, maxWidth: number, weight: number, sizePx: number, family: string, opts: { italic?: boolean; expanded?: boolean } = {}): void {
  setFont(ctx, weight, sizePx, family, opts);
  const w = ctx.measureText(text).width;
  if (w > maxWidth && w > 0) setFont(ctx, weight, Math.max(8, (sizePx * maxWidth) / w), family, opts);
  ctx.fillText(text, x, y);
}

/** Rounded-rectangle path (no `ctx.roundRect` dependency, for older WebKit). */
export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Wraps `text` into at most `maxLines` lines of `maxWidth`, ending with an ellipsis if cut. Uses the current font. */
export function wrapLines(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let i = 0;
  for (; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) {
    lines.push(line);
    line = '';
    i = words.length;
  }
  const cut = i < words.length || line !== '';
  const last = lines.length - 1;
  return lines.map((l, idx) => ellipsize(ctx, l, maxWidth, cut && idx === last));
}

/** Trims `text` until it (plus `…`) fits. `force` always appends the ellipsis. */
export function ellipsize(ctx: Ctx, text: string, maxWidth: number, force = false): string {
  if (!force && ctx.measureText(text).width <= maxWidth) return text;
  let s = text.replace(/[\s.,;:…]+$/, '');
  while (s.length > 0 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1).trimEnd();
  return `${s.replace(/[\s.,;:]+$/, '')}…`;
}

/** Intrinsic pixel size of any canvas image source (0×0 when unknown). */
export function sourceSize(img: CanvasImageSource): { w: number; h: number } {
  const anyImg = img as unknown as Record<string, unknown>;
  const num = (k: string) => (typeof anyImg[k] === 'number' ? (anyImg[k] as number) : 0);
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) return { w: img.naturalWidth, h: img.naturalHeight };
  if (typeof HTMLVideoElement !== 'undefined' && img instanceof HTMLVideoElement) return { w: img.videoWidth, h: img.videoHeight };
  if (num('displayWidth')) return { w: num('displayWidth'), h: num('displayHeight') }; // VideoFrame
  if (typeof SVGImageElement !== 'undefined' && img instanceof SVGImageElement) return { w: img.width.baseVal.value, h: img.height.baseVal.value };
  return { w: num('width'), h: num('height') };
}

/** Draws `img` cover-cropped into the rect (centred, like object-fit: cover). Clip first for rounded corners. */
export function drawImageCover(ctx: Ctx, img: CanvasImageSource, x: number, y: number, w: number, h: number): boolean {
  const { w: iw, h: ih } = sourceSize(img);
  if (!iw || !ih) return false;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
  return true;
}

/** FNV-1a 32-bit hash, for deterministic artwork from ids. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WARM_PAIRS: [string, string][] = [
  [COLORS.honey, COLORS.ginger],
  [COLORS.honeySoft, COLORS.honeyDeep],
  [COLORS.gingerSoft, COLORS.ginger],
  [COLORS.cream, COLORS.honey],
  [COLORS.honeyDeep, COLORS.gingerInk],
  [COLORS.gingerSoft, COLORS.honey],
];

/** Fills the rect with a warm honey/ginger gradient chosen deterministically from `seed`. */
export function fillSeedGradient(ctx: Ctx, seed: string, x: number, y: number, w: number, h: number): void {
  const n = hashSeed(seed);
  const [a, b] = WARM_PAIRS[n % WARM_PAIRS.length];
  const angle = ((n >>> 8) % 360) * (Math.PI / 180);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createLinearGradient(cx - Math.cos(angle) * r, cy - Math.sin(angle) * r, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/* Key-fob pin silhouette from src/components/brand/pins.ts (44 × 58 artwork, tip at 22,53.5). */
const FOB_D =
  'M22 15.5c7.9 0 13.5 5.4 13.5 12.6 0 8.6-7.4 14.6-12.3 24.4a1.3 1.3 0 0 1-2.4 0C15.9 42.7 8.5 36.7 8.5 28.1 8.5 20.9 14.1 15.5 22 15.5z';
const HEART_D = 'M22 33.5s-5-3-5-6.4a2.7 2.7 0 0 1 5-1.4 2.7 2.7 0 0 1 5 1.4c0 3.4-5 6.4-5 6.4z';
const PIN_W = 44;
const PIN_H = 58;
const PIN_TIP: [number, number] = [22, 53.5];

const paths = new Map<string, Path2D>();
/** Cached Path2D for an SVG path string. */
export function path(d: string): Path2D {
  let p = paths.get(d);
  if (!p) {
    p = new Path2D(d);
    paths.set(d, p);
  }
  return p;
}

/** Natural pin height in artwork px; `height` arguments below scale from this. */
export const PIN_ARTWORK_H = PIN_H;

/**
 * Honey key-tag pin with its tip at (x, y), `height` px tall. `dashed` gives the
 * wishlist variant (paper fill, dashed ink outline, small heart).
 */
export function drawKeyTagPin(ctx: Ctx, x: number, y: number, height: number, dashed = false, alpha = 1): void {
  const s = height / PIN_H;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x - PIN_TIP[0] * s, y - PIN_TIP[1] * s);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = COLORS.ink;
  // soft drop shadow under the fob
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 6 * s;
  ctx.shadowOffsetY = 2 * s;
  ctx.fillStyle = dashed ? 'rgba(255,255,255,0.92)' : COLORS.honey;
  ctx.fill(path(FOB_D));
  ctx.restore();
  ctx.lineWidth = dashed ? 2.2 : 2.4;
  if (dashed) ctx.setLineDash([4, 3]);
  ctx.stroke(path(FOB_D));
  ctx.beginPath();
  ctx.arc(22, 10, 6.4, 0, Math.PI * 2);
  if (dashed) ctx.setLineDash([3, 2.6]);
  ctx.lineWidth = dashed ? 2 : 2.4;
  ctx.stroke();
  ctx.setLineDash([]);
  if (dashed) {
    ctx.lineWidth = 1.8;
    ctx.stroke(path(HEART_D));
  } else {
    ctx.beginPath();
    ctx.moveTo(22, 16.4);
    ctx.lineTo(22, 20.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(22, 20.6, 2.3, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.paper;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.globalAlpha *= 0.55;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16.5, 28.5);
    ctx.lineTo(27.5, 28.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** Width of a pin drawn at `height`. */
export function pinWidth(height: number): number {
  return (height / PIN_H) * PIN_W;
}

/** Small "Suite Nothings" wordmark: a honey key-tag dot and the name, centred on (cx, baseline). */
export function drawWordmark(ctx: Ctx, cx: number, baseline: number, sizePx: number, color: string = COLORS.ink): void {
  ctx.save();
  setFont(ctx, 800, sizePx, FONT_SANS);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const label = 'Suite Nothings';
  const tw = ctx.measureText(label).width;
  const pinH = sizePx * 1.25;
  const gap = sizePx * 0.4;
  const total = pinWidth(pinH) + gap + tw;
  const x0 = cx - total / 2;
  drawKeyTagPin(ctx, x0 + pinWidth(pinH) / 2, baseline + sizePx * 0.12, pinH);
  ctx.fillStyle = color;
  ctx.fillText(label, x0 + pinWidth(pinH) + gap, baseline);
  ctx.restore();
}

/** Formats an integer the way the app does (`7,420`). */
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString('en-GB');
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOutCubic = (t: number): number => 1 - (1 - clamp01(t)) ** 3;

/**
 * Loads the export fonts (they may not be on screen yet) and waits for `document.fonts.ready`,
 * giving up after `timeoutMs` so a stuck font never blocks an export.
 */
export async function fontsReady(timeoutMs = 2500): Promise<void> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return;
  const wait = (async () => {
    try {
      await Promise.all(
        ['800 64px Archivo', '800 32px Manrope', '600 32px Manrope', 'italic 500 32px Manrope', '700 32px "JetBrains Mono"'].map((f) =>
          fonts.load(f).catch(() => []),
        ),
      );
      await fonts.ready;
    } catch {
      /* fall back to system fonts */
    }
  })();
  await Promise.race([wait, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}
