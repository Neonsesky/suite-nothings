import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { markSvg } from './mark.mjs';
mkdirSync('../../.tmp', { recursive: true });
const tiles = [
  markSvg({ variant: 'full', bg: '#fff' }),
  markSvg({ variant: 'outline', bg: '#fff' }),
  markSvg({ variant: 'mono', bg: '#fff' }),
  markSvg({ variant: 'full', bg: '#FFF7E6' }),
];
const row = `<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="300" viewBox="0 0 1040 300"><rect width="1040" height="300" fill="#eee"/>${tiles
  .map((t, i) => `<g transform="translate(${10 + i * 260} 10)">${t.replace('width="64" height="64"', 'width="240" height="240"')}</g>`)
  .join('')}${[16, 32, 48].map((s, i) => `<g transform="translate(${10 + i * 70} 256)">${markSvg({ variant: 'full', bg: '#fff' }).replace('width="64" height="64"', `width="${s}" height="${s}"`)}</g>`).join('')}</svg>`;
writeFileSync('../../.tmp/mark-preview.png', new Resvg(row).render().asPng());
console.log('ok');
