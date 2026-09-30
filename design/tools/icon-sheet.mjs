// Renders src/components/icons/index.tsx into a contact sheet PNG for visual review.
// Parses each `<Svg {...p}>…</Svg>` body and converts the JSX attributes to SVG.
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = readFileSync(new URL('../../src/components/icons/index.tsx', import.meta.url), 'utf8');
const re = /export function (Icon\w+)\(p: IconProps\) \{\s*return \(\s*<Svg \{\.\.\.p\}>([\s\S]*?)<\/Svg>/g;
const icons = [...src.matchAll(re)].map(([, name, body]) => [
  name,
  body
    .replace(/(\w+)=\{([\d.]+)\}/g, '$1="$2"')
    .replace(/\b(stroke|fill)([A-Z])(\w*)=/g, (_, a, b, c) => `${a}-${b.toLowerCase()}${c.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}=`)
    .replace(/strokeWidth=/g, 'stroke-width='),
]);
const cols = 8, cell = 120, size = 48;
const rows = Math.ceil(icons.length / cols);
const W = cols * cell, H = rows * cell;
let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/>`;
icons.forEach(([name, body], i) => {
  const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
  out += `<g transform="translate(${x + (cell - size) / 2} ${y + 14}) scale(${size / 24})" fill="none" stroke="#1a1a1a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  out += `<g transform="translate(${x + 8} ${y + 78})" fill="none" stroke="#1a1a1a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  out += `<text x="${x + cell / 2 + 12}" y="${y + 96}" font-family="Arial" font-size="10" text-anchor="middle" fill="#555">${name.replace('Icon', '')}</text>`;
});
out += '</svg>';
mkdirSync('../../.tmp', { recursive: true });
writeFileSync(process.argv[2] ?? '../../.tmp/icons.png', new Resvg(out, { font: { loadSystemFonts: true } }).render().asPng());
console.log(icons.length, 'icons');
