/**
 * Pre-warm the home city's vector tiles (z9–14) so the City chapter works offline (SPEC §7.5).
 * The service worker's CacheFirst `sn-tiles` runtime cache stores whatever we fetch here, so this
 * only runs when a service worker controls the page, we're online, the user hasn't asked to save
 * data, and the browser is idle. Polite: two requests at a time, spaced out, capped at 300 tiles,
 * and at most once a week per home base.
 */
import type { HomeBase } from '@/data/types';
import type { BBox } from '@/lib/geo';
import { cityBBox } from './chapters';

export const PREWARM_MAX_TILES = 300;
export const PREWARM_ZOOMS = [9, 10, 11, 12, 13, 14] as const;
const STORAGE_KEY = 'sn:map:prewarm';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const GAP_MS = 120;

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

function lngToX(lng: number, z: number) {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}
function latToY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

/** Tiles covering `bbox`, lowest zoom first and nearest the centre first, capped at `max`. */
export function tilesFor(bbox: BBox, center: { lat: number; lng: number }, zooms: readonly number[] = PREWARM_ZOOMS, max = PREWARM_MAX_TILES): TileCoord[] {
  const out: TileCoord[] = [];
  for (const z of zooms) {
    const x0 = lngToX(bbox[0], z);
    const x1 = lngToX(bbox[2], z);
    const y0 = latToY(bbox[3], z);
    const y1 = latToY(bbox[1], z);
    const cx = lngToX(center.lng, z);
    const cy = latToY(center.lat, z);
    const level: (TileCoord & { d: number })[] = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) level.push({ z, x, y, d: (x - cx) ** 2 + (y - cy) ** 2 });
    level.sort((a, b) => a.d - b.d);
    for (const { z: tz, x, y } of level) {
      if (out.length >= max) return out;
      out.push({ z: tz, x, y });
    }
  }
  return out;
}

function idle(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(() => resolve(), { timeout: 2000 });
    else window.setTimeout(resolve, GAP_MS);
  });
}

let running = false;

/** Fire-and-forget. `tileJsonUrl` is the vector source URL from the style (a TileJSON). */
export async function prewarmHomeTiles(home: HomeBase, tileJsonUrl: string, signal?: AbortSignal): Promise<number> {
  if (running || typeof navigator === 'undefined' || !navigator.onLine) return 0;
  if (!navigator.serviceWorker?.controller) return 0;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return 0;
  const key = `${home.lat.toFixed(3)},${home.lng.toFixed(3)}`;
  try {
    const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { key: string; at: number } | null;
    if (prev && prev.key === key && Date.now() - prev.at < WEEK_MS) return 0;
  } catch {
    // Unreadable marker: warm again.
  }
  running = true;
  let fetched = 0;
  try {
    const tj = (await (await fetch(tileJsonUrl, { signal })).json()) as { tiles?: string[] };
    const template = tj.tiles?.[0];
    if (!template) return 0;
    const tiles = tilesFor(cityBBox(home), home);
    const queue = [...tiles];
    const worker = async () => {
      while (queue.length && !signal?.aborted && navigator.onLine) {
        const t = queue.shift()!;
        await idle();
        const url = template.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y));
        try {
          await fetch(url, { signal, mode: 'cors' });
          fetched++;
        } catch {
          if (signal?.aborted) return;
        }
        await new Promise((r) => window.setTimeout(r, GAP_MS));
      }
    };
    await Promise.all([worker(), worker()]);
    if (!signal?.aborted) localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, at: Date.now() }));
  } catch {
    // Offline or blocked: try again next time.
  } finally {
    running = false;
  }
  return fetched;
}
