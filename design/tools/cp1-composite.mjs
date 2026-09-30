// Checkpoint 1: Dayuse reference (left) vs our prototype (right). Output contains Dayuse
// imagery, so it goes to the gitignored design/references/cp1/ only.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const R = `${root}/design/references`, P = `${root}/design/checkpoints/cp1/proto`;
const pairs = [
  ['home-390', `${R}/home-390-fold.png`, `${P}/home-mobile-fold.png`, 390],
  ['home-1440', `${R}/home-1440-fold.png`, `${P}/home-desktop-fold.png`, 1440],
  ['detail-390', `${R}/hotel-390-fold.png`, `${P}/stay-mobile-fold.png`, 390],
  ['detail-1440', `${R}/hotel-1440-fold.png`, `${P}/stay-desktop-fold.png`, 1440],
  ['cards-1440', `${R}/dubai-1440-fold.png`, `${P}/home-desktop-full.png`, 1440],
  ['map-1440', `${R}/dubai-1440-fold.png`, `${P}/map-desktop.png`, 1440],
];
mkdirSync(`${R}/cp1`, { recursive: true });
const b = await chromium.launch();
for (const [name, left, right, w] of pairs) {
  const html = `${R}/cp1/${name}.html`;
  writeFileSync(html, `<body style="margin:0;display:flex;gap:16px;background:#ddd;font:14px sans-serif;align-items:flex-start">
<figure style="margin:0;width:${w}px"><figcaption>Dayuse</figcaption><img src="file://${left}" style="width:100%"></figure>
<figure style="margin:0;width:${w}px"><figcaption>Suite Nothings</figcaption><img src="file://${right}" style="width:100%;max-height:${w === 390 ? 1700 : 1000}px;object-fit:cover;object-position:top"></figure></body>`);
  const p = await b.newPage({ viewport: { width: w * 2 + 16, height: 800 } });
  await p.goto(`file://${html}`); await p.waitForTimeout(200);
  await p.screenshot({ path: `${R}/cp1/${name}.png`, fullPage: true, clip: { x: 0, y: 0, width: w * 2 + 16, height: w === 390 ? 900 : 940 } });
  await p.close();
}
await b.close(); console.log('ok');
