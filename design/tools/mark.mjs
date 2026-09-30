// Suite Nothings key-tag mark: one source of geometry for the SVG exports.
// The React component (src/components/brand/KeyTagMark.tsx) mirrors these paths.
// Usage: import { markSvg } from './mark.mjs'

export const INK = '#1A1A1A';
export const HONEY = '#FFC83D';
export const PAPER = '#FFFFFF';

// Local geometry is drawn along the x-axis, then rotated so the tag hangs off its ring.
export const FOB =
  'M-24.5 0C-24.5-4.6-19.8-8.2-12.5-10.4C-7.4-11.9-2.2-12.6 3-12.6C16.2-12.6 25.5-7.4 25.5 0C25.5 7.4 16.2 12.6 3 12.6C-2.2 12.6-7.4 11.9-12.5 10.4C-19.8 8.2-24.5 4.6-24.5 0Z';
export const FOB_INNER =
  'M-10.5-6.9C-6.3-8.1-2 -8.7 2.6-8.7C13.2-8.7 20.6-5.2 20.6 0C20.6 5.2 13.2 8.7 2.6 8.7C-2 8.7-6.3 8.1-10.5 6.9C-13.2 6.1-14.6 3.4-14.6 0C-14.6-3.4-13.2-6.1-10.5-6.9Z';
export const HOLE = { cx: -17.4, cy: 0, r: 2.9 };
export const RING = { cx: -26.2, cy: 2.2, r: 9 };
// "619" drawn as ink strokes (font independent), centred on (3, 0), cap height 11.
export const DIGITS = [
  // 6
  'M-3.1-5.2C-6.4-4.6-8.9-1.9-8.9 1.6',
  'M-5.9 5.5A3 3 0 1 0-5.9-0.5A3 3 0 1 0-5.9 5.5Z',
  // 1
  'M0.7-3.6L3.4-5.5V5.5',
  // 9
  'M11.9-5.5A3 3 0 1 0 11.9 0.5A3 3 0 1 0 11.9-5.5Z',
  'M14.9-2.5C14.9 1.4 12.8 4.4 9.2 5.4',
];
export const TRANSFORM = 'translate(36.6 33.4) scale(0.9) rotate(-33)';

/**
 * @param {{variant?: 'full'|'mono'|'outline', size?: number, ink?: string, honey?: string,
 *   paper?: string, bg?: string|null, scale?: number, inner?: boolean, id?: string}} o
 */
export function markSvg(o = {}) {
  const {
    variant = 'full',
    size = 64,
    ink = INK,
    honey = HONEY,
    paper = PAPER,
    bg = null,
    scale = 1,
    inner = true,
    id = 'kt-hole',
  } = o;
  const sw = 2.6;
  const mono = variant === 'mono';
  const fobFill = variant === 'full' ? honey : mono ? ink : 'none';
  const ringEl = `<circle cx="${RING.cx}" cy="${RING.cy}" r="${RING.r}" fill="none" stroke="${ink}" stroke-width="${sw}"/>`;
  const holeFill = variant === 'outline' ? 'none' : paper;
  const digits = (stroke) =>
    `<g fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${DIGITS.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  const inside = mono
    ? [
        // mono knocks the hole and the number out, so it works as an alpha mask (Android themed icons)
        `<mask id="${id}" maskUnits="userSpaceOnUse" x="-40" y="-20" width="80" height="40"><rect x="-40" y="-20" width="80" height="40" fill="#fff"/><circle cx="${HOLE.cx}" cy="${HOLE.cy}" r="${HOLE.r}" fill="#000"/>${digits('#000')}</mask>`,
        `<g mask="url(#${id})">${ringEl}<path d="${FOB}" fill="${ink}" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/></g>`,
      ]
    : [
        // the ring sits behind the tag and shows again through the punched hole
        ringEl,
        `<path d="${FOB}" fill="${fobFill}" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round"/>`,
        inner ? `<path d="${FOB_INNER}" fill="none" stroke="${ink}" stroke-width="1.3" opacity="0.5"/>` : '',
        `<circle cx="${HOLE.cx}" cy="${HOLE.cy}" r="${HOLE.r}" fill="${holeFill}" stroke="${ink}" stroke-width="1.8"/>`,
        `<clipPath id="${id}"><circle cx="${HOLE.cx}" cy="${HOLE.cy}" r="${HOLE.r - 0.9}"/></clipPath>`,
        `<g clip-path="url(#${id})">${ringEl}</g>`,
        digits(ink),
      ];
  const c = 32;
  const g = `<g transform="translate(${c} ${c}) scale(${scale}) translate(${-c} ${-c})"><g transform="${TRANSFORM}">${inside.join('')}</g></g>`;
  const back = bg ? `<rect width="64" height="64" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${back}${g}</svg>`;
}
