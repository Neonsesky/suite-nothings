// Exports the favicon, PWA icons and iOS splash screens from mark.mjs.
// Usage: node export-icons.mjs   (writes public/favicon.svg and public/icons/*)
import { Resvg } from '@resvg/resvg-js';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { markSvg, INK, HONEY, PAPER } from './mark.mjs';

const root = resolve(import.meta.dirname, '../..');
const out = `${root}/public/icons`;
mkdirSync(out, { recursive: true });
const CREAM = '#FFF8E9';

const png = (svg, size, file) => {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  writeFileSync(`${out}/${file}`, r.render().asPng());
};

// A launcher tile: honey ground, paper fob, ink outline. `scale` shrinks the mark into the
// maskable safe zone (inner 80% circle), `radius` rounds the tile for purpose "any".
function tile({ scale = 1, radius = 0, bg = HONEY, fob = PAPER } = {}) {
  const inner = markSvg({ variant: 'full', honey: fob, scale, id: 'h' })
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="${radius}" fill="${bg}"/>${inner}</svg>`;
}

// favicon.svg: honey fob; the ring flips to paper in dark browser chrome.
let fav = markSvg({ variant: 'full', inner: false, id: 'f' });
fav = fav
  .replace(/<circle cx="-26.2"/g, '<circle class="r" cx="-26.2"')
  .replace(/<svg([^>]*)>/, '<svg$1><style>@media (prefers-color-scheme: dark){.r{stroke:#fff}}</style>');
writeFileSync(`${root}/public/favicon.svg`, fav);

png(tile({ scale: 0.92, radius: 14 }), 192, 'icon-192.png');
png(tile({ scale: 0.92, radius: 14 }), 512, 'icon-512.png');
png(tile({ scale: 0.72 }), 512, 'icon-maskable-512.png');
png(tile({ scale: 0.72 }), 192, 'icon-maskable-192.png');
png(tile({ scale: 0.84 }), 180, 'apple-touch-icon-180.png');
// Monochrome (Android themed icons): white silhouette on transparent, inside the safe zone.
png(markSvg({ variant: 'mono', ink: '#FFFFFF', scale: 0.72, id: 'm' }), 512, 'icon-monochrome-512.png');
// Small favicon PNG fallback for old browsers.
png(markSvg({ variant: 'full', inner: false, id: 'p' }), 32, 'favicon-32.png');

// iOS splash screens (portrait). [cssW, cssH, dpr, devices]
export const SPLASHES = [
  [440, 956, 3, 'iPhone 16 Pro Max, 17 Pro Max'],
  [402, 874, 3, 'iPhone 16 Pro, 17, 17 Pro'],
  [420, 912, 3, 'iPhone Air'],
  [430, 932, 3, 'iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus'],
  [393, 852, 3, 'iPhone 14 Pro, 15, 15 Pro, 16'],
  [428, 926, 3, 'iPhone 12 Pro Max, 13 Pro Max, 14 Plus'],
  [390, 844, 3, 'iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e'],
  [375, 812, 3, 'iPhone X, XS, 11 Pro, 12 mini, 13 mini'],
  [414, 896, 3, 'iPhone XS Max, 11 Pro Max'],
  [414, 896, 2, 'iPhone XR, 11'],
  [414, 736, 3, 'iPhone 6s Plus, 7 Plus, 8 Plus'],
  [375, 667, 2, 'iPhone SE (2nd, 3rd gen), 6s, 7, 8'],
];

const fonts = readFileSync(`${root}/src/styles/fonts.css`, 'utf8').replaceAll("url('/fonts/", `url('file://${root}/public/fonts/`);
const mark = markSvg({ variant: 'full', size: 132, id: 's' });
const browser = await chromium.launch();
const rows = [];
for (const [w, h, dpr, devices] of SPLASHES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await page.setContent(`<!doctype html><style>${fonts}
    html,body{margin:0;height:100%;background:${CREAM};color:${INK};font-family:Manrope,sans-serif}
    main{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding-bottom:6%}
    h1{margin:6px 0 0;font-size:30px;font-weight:800;letter-spacing:-0.01em}
    p{margin:0;font-size:15px;font-weight:500;color:#54545D}</style>
    <main>${mark}<h1>Suite Nothings</h1><p>Every room we've made ours.</p></main>`);
  await page.evaluate(() => document.fonts.ready);
  const file = `splash-${w * dpr}x${h * dpr}.png`;
  await page.screenshot({ path: `${out}/${file}` });
  await page.close();
  rows.push({ file, w, h, dpr, devices });
}
await browser.close();
writeFileSync(`${root}/.tmp/splashes.json`, JSON.stringify(rows, null, 2));
console.log('exported', rows.length, 'splashes');
