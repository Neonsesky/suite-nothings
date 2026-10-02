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
  ink: '#292935',
  paper: '#FFFFFF',
  cream: '#FFF8E9',
  honey: '#FFC536',
  ginger: '#FC5E57',
  gingerSoft: '#FFE1DC',
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

/** Minimal line-art glyphs for each place icon, drawn centred in a 16×16 box. */
const PLACE_GLYPHS: Record<string, string> = {
  home: 'M3 8.5 8 4.5l5 4V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  heart: 'M8 13.3S3.2 10.3 3.2 6.9a2.6 2.6 0 0 1 4.8-1.4 2.6 2.6 0 0 1 4.8 1.4c0 3.4-4.8 6.4-4.8 6.4z',
  restaurant: 'M5 2.5v5a1 1 0 0 0 2 0v-5M5 2.5v2.6M6.4 2.5v2.6M5.8 7.5v6M11 2.5c-.9 0-1.6 1.3-1.6 3s.7 3 1.6 3v4.5',
  beach: 'M2 8a6 6 0 0 1 12 0H2zM8 2v1.3M8 8v5a1.3 1.3 0 0 1-1.3 1.3',
  mosque: 'M2.5 13V8.5a5.5 5.5 0 0 1 11 0V13M2.5 13h11M8 8.5V6M9.1 3.6a1.6 1.6 0 1 1-1.5-2.1 2 2 0 1 0 1.5 2.1z',
  gym: 'M1.5 6.5v3M3.5 5v6M12.5 5v6M14.5 6.5v3M4 8h8',
  park: 'M8 1.5 4.7 7h2L4 11.5h3.2V15h1.6v-3.5H12L9.3 7h2z',
  car: 'M3 10.5v-2l1.3-3.2a1.5 1.5 0 0 1 1.4-1h4.6a1.5 1.5 0 0 1 1.4 1L13 8.5v2M3 10.5h10v1.5a.8.8 0 0 1-.8.8H12a.8.8 0 0 1-.8-.8v-.5h-6.4v.5a.8.8 0 0 1-.8.8h-.2a.8.8 0 0 1-.8-.8z',
  plane: 'M8 1.5v10M8 1.5 3.5 6M8 1.5l4.5 4.5M4 10l-1.8 2.8M12 10l1.8 2.8M8 11.5l-1.3 3h2.6z',
  star: 'm8 2 1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.3l-3.7 2 .8-4.1-3.1-2.9 4.2-.5z',
  coffee: 'M3 5.5h8v4.5a3.5 3.5 0 0 1-3.5 3.5h-1A3.5 3.5 0 0 1 3 10zM11 6.5h1.2a1.8 1.8 0 0 1 0 3.6H11',
  other: 'M8 12.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z',
};

/** Tint colours for custom place pins (null = ink on paper). */
const PLACE_TINT_COLORS: Record<string, string> = { honey: c.honey, ginger: c.ginger, ink: c.ink };

/** A custom place pin (36 × 48): a rounded badge with the chosen icon, optionally tinted. */
export function placePin(icon: string, tint: string | null = null): PinArt {
  const w = 36;
  const h = 48;
  const fill = tint ? (PLACE_TINT_COLORS[tint] ?? c.paper) : c.paper;
  const glyphColor = tint ? c.paper : c.ink;
  const glyph = PLACE_GLYPHS[icon] ?? PLACE_GLYPHS.other;
  const body = `
<path d="M18 44C16.4 42 4 29.4 4 18a14 14 0 0 1 28 0c0 11.4-12.4 24-14 26z" fill="${fill}" stroke="${c.ink}" stroke-width="2.4" stroke-linejoin="round"/>
<g transform="translate(10 10)" fill="none" stroke="${glyphColor}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
<path d="${glyph}" fill="${icon === 'other' ? glyphColor : 'none'}"/>
</g>`;
  return { svg: wrap(w, h, body), width: w, height: h, anchor: 'bottom', tip: [18, 45] };
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
