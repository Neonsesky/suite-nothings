// Prints the gzipped size of the initial JS (entry + its static imports) and fails above budget.
// Lazy chunks (routes, maplibre, three, gsap, exifr, qrcode) are excluded.
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET = 300 * 1024;
const dist = 'dist';
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/ missing: run `npm run build` first');
  process.exit(1);
}
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const initial = new Set();
for (const m of html.matchAll(/<(?:script[^>]+src|link[^>]+rel="modulepreload"[^>]+href)="([^"]+\.js)"/g)) initial.add(m[1]);
const base = (process.env.VITE_BASE || '/').replace(/\/?$/, '/');
let total = 0;
const rows = [];
for (const src of initial) {
  const rel = src.startsWith(base) ? src.slice(base.length) : src.replace(/^\//, '');
  const gz = gzipSync(readFileSync(join(dist, rel))).length;
  total += gz;
  rows.push([rel, gz]);
}
for (const [f, gz] of rows) console.log(`${(gz / 1024).toFixed(1).padStart(8)} KB  ${f}`);
console.log(`${(total / 1024).toFixed(1).padStart(8)} KB  initial JS (gzip), budget ${BUDGET / 1024} KB`);
if (total > BUDGET) {
  console.error('Initial JS is over budget.');
  process.exit(1);
}
