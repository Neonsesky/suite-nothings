/**
 * Client image pipeline: decode (EXIF orientation applied by the browser), downscale, and
 * re-encode to WebP (JPEG where the browser cannot encode WebP, e.g. Safari). Re-encoding
 * through a canvas writes pixels only, so the source EXIF (GPS, camera data) is gone; any
 * metadata segments the encoder adds itself are stripped from JPEG output too. Capture time
 * is read first and returned separately.
 */
import { readExif, type ExifInfo } from '@/lib/exif';

export const THUMB_PX = 480;
export const FULL_PX = 1600;
export const QUALITY = 0.8;

/** Structurally identical to `ProcessedPhoto` in `@/data/store`. */
export interface ProcessedImage {
  thumb: Blob;
  full: Blob;
  /** Of `full`. */
  width: number;
  height: number;
  taken_at: string | null;
}

export type ImageSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Scales so the longest edge is ≤ max. Never upscales; integers ≥ 1. */
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const s = Math.min(1, max / Math.max(w, h, 1));
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

/**
 * Decodes with EXIF orientation applied (the default for both ImageBitmap and <img> in current
 * browsers). Falls back to an <img> where createImageBitmap is missing or rejects the input.
 */
export async function decodeImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Older engines reject the option value or the format; the <img> path decodes more.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sizeOf(src: ImageSource): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement) {
    return { width: src.naturalWidth, height: src.naturalHeight };
  }
  return { width: src.width, height: src.height };
}

function makeCanvas(width: number, height: number): { canvas: AnyCanvas; ctx: Ctx2D } {
  let canvas: AnyCanvas;
  let ctx: Ctx2D | null;
  if (typeof OffscreenCanvas === 'function') {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d');
  } else {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d');
  }
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas, ctx };
}

/** Frees backing memory early (iOS caps total canvas memory per page). */
function release(canvas: AnyCanvas): void {
  canvas.width = 0;
  canvas.height = 0;
}

/** Draws `source` at width×height, halving step by step when shrinking more than 2×. */
function resize(source: ImageSource, width: number, height: number): AnyCanvas {
  let src: ImageSource = source;
  let { width: sw, height: sh } = sizeOf(source);
  let owned: AnyCanvas | null = null;
  while (sw > width * 2 && sh > height * 2) {
    const nw = Math.max(width, Math.round(sw / 2));
    const nh = Math.max(height, Math.round(sh / 2));
    const step = makeCanvas(nw, nh);
    step.ctx.drawImage(src, 0, 0, nw, nh);
    if (owned) release(owned);
    owned = step.canvas;
    src = step.canvas;
    sw = nw;
    sh = nh;
  }
  const out = makeCanvas(width, height);
  // Flatten transparency onto white so the JPEG fallback matches the WebP output.
  out.ctx.fillStyle = '#fff';
  out.ctx.fillRect(0, 0, width, height);
  out.ctx.drawImage(src, 0, 0, width, height);
  if (owned) release(owned);
  return out.canvas;
}

function toBlob(canvas: AnyCanvas, type: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas encode failed'))), type, quality),
  );
}

/**
 * Drops APP1–APP15 (except APP2 ICC) and COM segments from a JPEG, keeping APP0 JFIF. WebKit's
 * encoder writes its own small Exif and Photoshop blocks; this keeps outputs metadata-free.
 * Returns the input unchanged if it is not a well-formed JPEG header.
 */
export function stripJpegMetadata(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const keep: Uint8Array<ArrayBuffer>[] = [bytes.subarray(0, 2)];
  let dropped = false;
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return bytes;
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    if (marker === 0xda) break; // start of scan: entropy-coded data follows
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2 || i + 2 + len > bytes.length) return bytes;
    const drop = (marker >= 0xe1 && marker <= 0xef && marker !== 0xe2) || marker === 0xfe;
    if (drop) dropped = true;
    else keep.push(bytes.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  if (!dropped) return bytes;
  keep.push(bytes.subarray(i));
  const out = new Uint8Array(keep.reduce((n, k) => n + k.length, 0));
  let o = 0;
  for (const k of keep) {
    out.set(k, o);
    o += k.length;
  }
  return out;
}

/** Set once a browser has shown it cannot encode WebP (Safari hands back PNG). */
let webpUnsupported = false;

async function encodeCanvas(canvas: AnyCanvas, quality: number): Promise<Blob> {
  if (!webpUnsupported) {
    const webp = await toBlob(canvas, 'image/webp', quality);
    if (webp.type === 'image/webp') return webp;
    webpUnsupported = true;
  }
  const jpeg = await toBlob(canvas, 'image/jpeg', quality);
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  const clean = stripJpegMetadata(bytes);
  return clean === bytes ? jpeg : new Blob([clean], { type: 'image/jpeg' });
}

/** Resizes `source` to width×height and encodes WebP, or JPEG where WebP is unsupported. */
export async function encode(
  source: ImageSource,
  width: number,
  height: number,
  opts: { quality?: number } = {},
): Promise<Blob> {
  const canvas = resize(source, width, height);
  try {
    return await encodeCanvas(canvas, opts.quality ?? QUALITY);
  } finally {
    release(canvas);
  }
}

/**
 * Full pipeline for one photo: EXIF first (the re-encode strips it), then decode, a ≤1600px
 * full image and a ≤480px thumb drawn from the full-size canvas rather than the original.
 */
export async function processImage(file: Blob, opts: { exif?: ExifInfo } = {}): Promise<ProcessedImage> {
  const exif = opts.exif ?? (await readExif(file));
  const decoded = await decodeImage(file);
  let fullCanvas: AnyCanvas | null = null;
  try {
    const natural = sizeOf(decoded);
    if (!natural.width || !natural.height) throw new Error('Image has no pixels');
    const f = fitWithin(natural.width, natural.height, FULL_PX);
    fullCanvas = resize(decoded, f.width, f.height);
    if (typeof ImageBitmap !== 'undefined' && decoded instanceof ImageBitmap) decoded.close();
    const full = await encodeCanvas(fullCanvas, QUALITY);
    const t = fitWithin(f.width, f.height, THUMB_PX);
    const thumb = await encode(fullCanvas, t.width, t.height);
    return { thumb, full, width: f.width, height: f.height, taken_at: exif.takenAt };
  } finally {
    if (typeof ImageBitmap !== 'undefined' && decoded instanceof ImageBitmap) decoded.close();
    if (fullCanvas) release(fullCanvas);
  }
}

/** Matches `PhotoProcessor` in `@/data/store`; install with `setPhotoProcessor(photoProcessor)`. */
export function photoProcessor(file: Blob): Promise<ProcessedImage> {
  return processImage(file);
}
