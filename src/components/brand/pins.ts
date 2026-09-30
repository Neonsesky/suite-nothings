/*
 * Map pin artwork as SVG strings, for rasterising into MapLibre images
 * (`map.addImage`) or for HTML markers. Colours are literal hex values because a
 * rasterised <img> can't read CSS custom properties; keep them in sync with tokens.css.
 *
 * Every pin is drawn at 1x in CSS pixels; rasterise at devicePixelRatio (capped at 2)
 * and pass `pixelRatio` to addImage. Anchors are given as MapLibre `icon-anchor` values
 * plus the exact tip offset.
 */

export const PIN_COLORS = {
  ink: '#1A1A1A',
  paper: '#FFFFFF',
  cream: '#FFF7E6',
  honey: '#FFC83D',
  ginger: '#FF6A3D',
  gingerSoft: '#FFD9CC',
} as const;

export type PinArt = {
  svg: string;
  width: number;
  height: number;
  /** MapLibre icon-anchor for this art. */
  anchor: 'bottom' | 'center';
  /** Offset in px from the image's top-left to the point that touches the map. */
  tip: [number, number];
};

const c = PIN_COLORS;

/* A key fob seen hanging from its ring: honey body tapering to a point that marks the spot. */
const FOB =
  'M22 15.5c7.9 0 13.5 5.4 13.5 12.6 0 8.6-7.4 14.6-12.3 24.4a1.3 1.3 0 0 1-2.4 0C15.9 42.7 8.5 36.7 8.5 28.1 8.5 20.9 14.1 15.5 22 15.5z';

function wrap(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

export type StayPinOptions = {
  /** Number of visits; 2+ shows a count bubble. */
  count?: number;
  /** Favourites get a soft ginger glow. */
  favourite?: boolean;
  /** Selected pins are drawn 1.15x with a thicker outline. */
  selected?: boolean;
};

/** Honey key-tag stay pin (44 × 58). */
export function stayPin({ count = 1, favourite = false, selected = false }: StayPinOptions = {}): PinArt {
  const w = 44;
  const h = 58;
  const sw = selected ? 3 : 2.4;
  const glow = favourite
    ? `<defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2"/></filter></defs><ellipse cx="22" cy="30" rx="17" ry="19" fill="${c.ginger}" opacity="0.55" filter="url(#g)"/>`
    : '';
  const label =
    count > 1
      ? `<circle cx="22" cy="28.5" r="8" fill="${c.paper}" stroke="${c.ink}" stroke-width="1.6"/><text x="22" y="32.2" text-anchor="middle" font-family="Manrope, Arial, Helvetica, sans-serif" font-weight="800" font-size="${count > 9 ? 8.5 : 10.5}" fill="${c.ink}">${count > 99 ? '99+' : count}</text>`
      : `<path d="M16.5 28.5h11" stroke="${c.ink}" stroke-width="2" stroke-linecap="round" opacity="0.55"/>`;
  const body = `${glow}
<circle cx="22" cy="10" r="6.4" fill="none" stroke="${c.ink}" stroke-width="${sw}"/>
<path d="${FOB}" fill="${c.honey}" stroke="${c.ink}" stroke-width="${sw}" stroke-linejoin="round"/>
<circle cx="22" cy="20.6" r="2.3" fill="${c.paper}" stroke="${c.ink}" stroke-width="1.6"/>
<path d="M22 16.4v4.2" stroke="${c.ink}" stroke-width="${sw}" stroke-linecap="round"/>
${label}`;
  return { svg: wrap(w, h, body), width: w, height: h, anchor: 'bottom', tip: [22, 53.5] };
}

/** Dashed wishlist pin (44 × 58): same silhouette, paper fill, dashed ink outline. */
export function wishlistPin(): PinArt {
  const w = 44;
  const h = 58;
  const body = `
<circle cx="22" cy="10" r="6.4" fill="none" stroke="${c.ink}" stroke-width="2" stroke-dasharray="3 2.6"/>
<path d="${FOB}" fill="${c.paper}" fill-opacity="0.92" stroke="${c.ink}" stroke-width="2.2" stroke-dasharray="4 3" stroke-linejoin="round"/>
<path d="M22 33.5s-5-3-5-6.4a2.7 2.7 0 0 1 5-1.4 2.7 2.7 0 0 1 5 1.4c0 3.4-5 6.4-5 6.4z" fill="none" stroke="${c.ink}" stroke-width="1.8" stroke-linejoin="round"/>`;
  return { svg: wrap(w, h, body), width: w, height: h, anchor: 'bottom', tip: [22, 53.5] };
}

/** Home base marker (40 × 40): a cream house with a ginger heart, on an ink-outlined disc. */
export function homePin(): PinArt {
  const w = 40;
  const h = 40;
  const body = `
<circle cx="20" cy="20" r="17.5" fill="${c.paper}" stroke="${c.ink}" stroke-width="2.4"/>
<path d="M11 18.6 20 11l9 7.6v9.2a1.7 1.7 0 0 1-1.7 1.7H12.7a1.7 1.7 0 0 1-1.7-1.7z" fill="${c.cream}" stroke="${c.ink}" stroke-width="2" stroke-linejoin="round"/>
<path d="M20 26.4s-3.6-2.2-3.6-4.6a1.9 1.9 0 0 1 3.6-1 1.9 1.9 0 0 1 3.6 1c0 2.4-3.6 4.6-3.6 4.6z" fill="${c.ginger}" stroke="${c.ink}" stroke-width="1.4" stroke-linejoin="round"/>`;
  return { svg: wrap(w, h, body), width: w, height: h, anchor: 'center', tip: [20, 20] };
}

/** Cluster bubble (count of stays in a city/country), sized by digit count. */
export function clusterPin(count: number): PinArt {
  const text = count > 999 ? '999+' : String(count);
  const w = Math.max(36, 18 + text.length * 9);
  const h = 36;
  const body = `
<rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="${(h - 3) / 2}" fill="${c.honey}" stroke="${c.ink}" stroke-width="2.4"/>
<text x="${w / 2}" y="23.2" text-anchor="middle" font-family="Manrope, Arial, Helvetica, sans-serif" font-weight="800" font-size="14" fill="${c.ink}">${text}</text>`;
  return { svg: wrap(w, h, body), width: w, height: h, anchor: 'center', tip: [w / 2, h / 2] };
}

/** Encode pin art as a data URL for an <img> or `new Image()`. */
export function pinDataUrl(art: PinArt): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(art.svg)}`;
}

/**
 * Rasterise pin art for `map.addImage(id, image, { pixelRatio })`.
 * Browser-only; resolves with ImageData at the given pixel ratio.
 */
export async function rasterizePin(art: PinArt, pixelRatio = 2): Promise<ImageData> {
  const img = new Image(art.width * pixelRatio, art.height * pixelRatio);
  img.decoding = 'async';
  img.src = pinDataUrl(art);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = art.width * pixelRatio;
  canvas.height = art.height * pixelRatio;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable, so map pins cannot be drawn.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
