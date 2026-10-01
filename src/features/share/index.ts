/**
 * Share cards (SPEC §12): a 1080×1920 stay postcard, a stats card and the journey route.
 * `shareStay` / `shareStats` / `shareRoute` open a preview sheet with the rendered PNG, then hand
 * it to the Web Share API (files) or save it. The renderer and the sheet are lazy chunks, so this
 * module stays tiny on the initial path.
 */
import { getPhotoBlob, getState } from '@/data/store';
import { buildStays } from '@/data/stays';
import type { Stay } from '@/data/types';
import { stayCaption, statsCaption, routeCaption, slugify } from './layout';
import { summary, kmTravelled, hotelCount } from '@/lib/stats';
import type { RouteCardData, ShareCardDataMap, ShareCardKind, ShareOutcome, StatsCardData, StayCardData } from './types';

export type { RouteCardData, ShareCardDataMap, ShareCardKind, ShareOutcome, StatsCardData, StayCardData } from './types';
export { CARD_W, CARD_H } from './types';
export { stayCaption, statsCaption, routeCaption } from './layout';

/** Renders a share card to a PNG Blob (1080×1920). Loads the renderer chunk on first use. */
export async function renderShareCard<K extends ShareCardKind>(kind: K, data: ShareCardDataMap[K]): Promise<Blob> {
  const m = await import('./render');
  return m.renderShareCard(kind, data);
}

/** Saves a blob through a temporary object-URL link. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** What the preview sheet needs: how to build the card and what to call it. */
export interface ShareJob<K extends ShareCardKind = ShareCardKind> {
  kind: K;
  /** Sheet title, e.g. "Share our stay". */
  title: string;
  /** Share text (the card's caption). */
  text: string;
  fileName: string;
  data(): Promise<ShareCardDataMap[K]>;
}

function liveStays(): Stay[] {
  const s = getState();
  return buildStays(s.visits.values(), s.hotels, s.photos.values()).filter((x) => !x.visit.deleted && !x.hotel.deleted);
}

async function photoFor(stay: Stay): Promise<Blob | null> {
  const id = stay.photos[0]?.photo_id ?? stay.hotel.cover_photo_id;
  if (!id) return null;
  try {
    return (await getPhotoBlob(id, 'full')) ?? (await getPhotoBlob(id, 'thumb'));
  } catch {
    return null;
  }
}

/** Card data for one stay straight from the store (null when it's gone). */
export async function stayCardData(visitId: string): Promise<StayCardData | null> {
  const all = liveStays();
  const stay = all.find((s) => s.visit.visit_id === visitId);
  if (!stay) return null;
  return { stay, total: all.length, photo: await photoFor(stay) };
}

export function statsCardData(): StatsCardData {
  return { stays: liveStays(), home: getState().settings.home_base };
}

export function routeCardData(): RouteCardData {
  return { stays: liveStays(), home: getState().settings.home_base };
}

async function openPreview(job: ShareJob): Promise<ShareOutcome> {
  if (typeof document === 'undefined') return 'unavailable';
  try {
    const m = await import('./host');
    return await m.openSharePreview(job);
  } catch {
    return 'unavailable';
  }
}

/** Opens the stay postcard preview. 'copied' means the image was saved instead of shared. */
export async function shareStay(visitId: string): Promise<ShareOutcome> {
  const all = liveStays();
  const stay = all.find((s) => s.visit.visit_id === visitId);
  if (!stay) return 'unavailable';
  return openPreview({
    kind: 'stay',
    title: 'Share our stay',
    text: stayCaption(stay.stayNumber, all.length, stay.hotel.name, stay.visit.date),
    fileName: `suite-nothings-${slugify(stay.hotel.name)}.png`,
    data: async () => ({ stay, total: all.length, photo: await photoFor(stay) }),
  });
}

/** Opens the stats card preview. */
export async function shareStats(): Promise<ShareOutcome> {
  const data = statsCardData();
  return openPreview({
    kind: 'stats',
    title: 'Share our stats',
    text: statsCaption(summary(data.stays, data.home)),
    fileName: 'suite-nothings-our-stats.png',
    data: async () => data,
  });
}

/** Opens the journey route card preview. Pass your own data (e.g. a filtered journey) or use the store's. */
export async function shareRoute(data: RouteCardData = routeCardData()): Promise<ShareOutcome> {
  const km = Math.round(kmTravelled(data.stays.filter((s) => !s.visit.deleted), data.home));
  return openPreview({
    kind: 'route',
    title: 'Share our journey',
    text: routeCaption(km, hotelCount(data.stays)),
    fileName: 'suite-nothings-our-journey.png',
    data: async () => data,
  });
}

// E2E hook (same switch as the map's `window.__sn`): lets specs render cards in-page.
declare global {
  interface Window {
    __snShare?: {
      renderShareCard: typeof renderShareCard;
      stayCardData: typeof stayCardData;
      statsCardData: typeof statsCardData;
      routeCardData: typeof routeCardData;
    };
  }
}
try {
  if (typeof window !== 'undefined' && window.localStorage.getItem('sn:e2e') === '1') {
    window.__snShare = { renderShareCard, stayCardData, statsCardData, routeCardData };
  }
} catch {
  // Storage blocked: no hook.
}
