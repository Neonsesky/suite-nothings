// Contact sheet of the exported icons + a home-screen label fit check for "Our Suites".
import { chromium } from 'playwright';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const I = (f, s, extra = '') => `<figure><img src="file://${root}/public/icons/${f}" width="${s}" height="${s}" style="${extra}"><figcaption>${f}</figcaption></figure>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
import { writeFileSync } from 'node:fs';
writeFileSync(`${root}/.tmp/icon-board.html`, `<!doctype html><style>body{font:12px system-ui;margin:20px;background:#fff}
.row{display:flex;gap:24px;align-items:end;flex-wrap:wrap;margin-bottom:24px}figure{margin:0;text-align:center}
.dark{background:#333;padding:10px;border-radius:12px}.home{display:flex;gap:22px;padding:24px;border-radius:24px;background:linear-gradient(160deg,#3a4a6b,#a86a7c)}
.app{width:76px;display:flex;flex-direction:column;align-items:center;gap:5px;color:#fff}
.app span{max-width:76px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
.ios img{border-radius:13.5px}.and img{border-radius:50%}</style>
<div class="row">${I('icon-512.png', 160)}${I('icon-192.png', 96)}${I('icon-maskable-512.png', 160, 'border-radius:50%')}${I('icon-maskable-512.png', 160, 'border-radius:22%')}${I('apple-touch-icon-180.png', 120, 'border-radius:22%')}
<div class="dark">${I('icon-monochrome-512.png', 140)}</div>${I('favicon-32.png', 32)}<figure><img src="file://${root}/public/favicon.svg" width="16"><img src="file://${root}/public/favicon.svg" width="32"><figcaption>favicon.svg</figcaption></figure></div>
<div class="row"><div class="home ios">${['Our Suites', 'Calendar', 'Photos'].map((n, i) => `<div class="app"><img src="file://${root}/public/icons/apple-touch-icon-180.png" width="60" height="60" style="${i ? 'filter:grayscale(1) opacity(.5)' : ''}"><span style="font-family:-apple-system,system-ui">${n}</span></div>`).join('')}</div>
<div class="home and">${['Our Suites', 'Maps'].map((n, i) => `<div class="app"><img src="file://${root}/public/icons/icon-maskable-512.png" width="56" height="56" style="${i ? 'filter:grayscale(1) opacity(.5)' : ''}"><span style="font-family:Roboto,system-ui">${n}</span></div>`).join('')}</div></div>
<div class="row" id="spl"></div>`);
await page.goto(`file://${root}/.tmp/icon-board.html`);
await page.waitForTimeout(300);
const fit = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('2d');
  const r = {};
  for (const [k, f] of [['ios SF 12px', '400 12px -apple-system'], ['android Roboto 12px', '400 12px Roboto, system-ui'], ['ios 13px (large text)', '400 13px -apple-system']]) { c.font = f; r[k] = Math.round(c.measureText('Our Suites').width); }
  return r;
});
console.log('label widths (px):', JSON.stringify(fit), '— iOS label box ≈ 74–80 pt, Android ≈ 72–80 dp');
await page.screenshot({ path: `${root}/.tmp/icon-board.png`, fullPage: true });
await browser.close();
