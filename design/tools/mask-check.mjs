// Renders the maskable icon tile with Android's maskable "safe zone" overlaid — a centred
// circle covering 80% of the canvas diameter, the standard test for what real launchers clip.
// Usage: node design/tools/mask-check.mjs [scale] [outfile.png]
import { chromium } from 'playwright';
import { markSvg, HONEY, PAPER } from './mark.mjs';

function tile({ scale = 1, radius = 0, bg = HONEY, fob = PAPER } = {}) {
  const inner = markSvg({ variant: 'full', honey: fob, scale, id: 'h' })
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="${radius}" fill="${bg}"/>${inner}</svg>`;
}

const scale = process.argv[2] ? Number(process.argv[2]) : 0.62;
const out = process.argv[3] ?? `/tmp/icon-maskcheck-${scale}.png`;
const svg = tile({ scale });
// 80%-diameter safe-zone circle, centred on the 64-unit canvas (radius 25.6).
const overlaySvg = svg.replace('</svg>', '<circle cx="32" cy="32" r="25.6" fill="none" stroke="red" stroke-width="0.6"/></svg>').replace('width="64" height="64"', 'width="512" height="512"');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.setContent(`<!doctype html><style>html,body{margin:0}</style>${overlaySvg}`);
await page.screenshot({ path: out });
await page.close();
await browser.close();
console.log('wrote', out);
