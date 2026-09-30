// Renders the real TSX brand components (mark, mood stamps, pins, icons) to static SVG
// markup via esbuild + react-dom/server, then screenshots a board with Playwright.
// Usage: node render-brand.mjs [out.png]
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const entry = `
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h } from 'react';
import { KeyTagMark } from '${root}/src/components/brand/KeyTagMark';
import { MoodStamp, MOODS } from '${root}/src/components/brand/MoodStamps';
import { stayPin, wishlistPin, homePin, clusterPin } from '${root}/src/components/brand/pins';
import { icons } from '${root}/src/components/icons';
const all = renderToStaticMarkup(h('div',null,...['full','outline','mono','mono','outline'].map((v,i) => h('div',{key:i,className:i>2?'dark':''},h(KeyTagMark,{variant:v,size:120,title:'Suite Nothings'})))));
export const marks = [all];
export const stamps = [renderToStaticMarkup(h('div',{style:{display:'flex',gap:24}},...MOODS.map(m => h(MoodStamp,{key:m.id,mood:m.id,size:96,selected:m.id==='romantic'||m.id==='fancy'}))))];
export const pins = [stayPin(), stayPin({count:3}), stayPin({favourite:true}), stayPin({selected:true,count:2}), wishlistPin(), homePin(), clusterPin(7), clusterPin(128)].map(p=>p.svg);
export const iconMarkup = Object.entries(icons).map(([n,C]) => [n, renderToStaticMarkup(h(C,{size:28}))]);
`;
mkdirSync(`${root}/.tmp`, { recursive: true });
const out = await build({
  stdin: { contents: entry, resolveDir: import.meta.dirname, loader: 'tsx' },
  bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic',
  external: ['react', 'react-dom', 'react/*', 'react-dom/*'], logLevel: 'error',
});
const file = resolve(import.meta.dirname, 'node_modules/.brand-bundle.mjs');
writeFileSync(file, out.outputFiles[0].text);
const m = await import(file + '?t=' + Date.now());
const html = `<!doctype html><html><head><link rel="stylesheet" href="file://${root}/src/styles/tokens.css"><link rel="stylesheet" href="file://${root}/src/styles/fonts.css">
<style>body{margin:0;padding:24px;background:#fff;font-family:Manrope,sans-serif;color:#1a1a1a}.row{display:flex;gap:24px;align-items:end;flex-wrap:wrap;margin-bottom:28px}.marks>div{display:flex;gap:24px}.dark{background:#1a1a1a;color:#fff;padding:12px;border-radius:12px}.ic{display:grid;grid-template-columns:repeat(14,1fr);gap:14px}.ic div{display:flex;flex-direction:column;align-items:center;font-size:9px;gap:4px}</style></head><body>
<div class="row marks">${m.marks[0]}</div>
<div class="row">${m.stamps.join('')}</div>
<div class="row" style="background:#f4efe6;padding:16px;border-radius:12px">${m.pins.join('')}</div>
<div class="ic">${m.iconMarkup.map(([n, s]) => `<div>${s}<span>${n.replace('Icon', '')}</span></div>`).join('')}</div>
</body></html>`;
writeFileSync(`${root}/.tmp/brand.html`, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 });
page.on('console', (msg) => msg.type() === 'error' && console.log('console error:', msg.text()));
await page.goto(`file://${root}/.tmp/brand.html`);
await page.waitForTimeout(300);
await page.screenshot({ path: process.argv[2] ?? `${root}/.tmp/brand.png`, fullPage: true });
await browser.close();
console.log('ok');
