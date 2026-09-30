#!/usr/bin/env node
/**
 * Fetch reference HTML + CSS bundles from dayuse.ae for design-token extraction.
 * Output goes to design/references/{html,css}/ (gitignored symlink, reference-only).
 *
 * Usage: node fetch-dayuse.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF_DIR = path.resolve(__dirname, '../references');
const HTML_DIR = path.join(REF_DIR, 'html');
const CSS_DIR = path.join(REF_DIR, 'css');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const PAGES = {
  home: 'https://www.dayuse.ae/',
  dubai: 'https://www.dayuse.ae/s/united-arab-emirates/dubai',
  hotel: 'https://www.dayuse.ae/hotels/united-arab-emirates/golden-tulip-al-barsha',
};

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

function extractCssLinks(html, baseUrl) {
  const links = new Set();
  const re = /href="([^"]*\.css[^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1].replace(/&amp;/g, '&');
    if (/_next\/static\/(chunks|css)\/.*\.css/.test(href)) {
      links.add(new URL(href, baseUrl).toString());
    }
  }
  return [...links];
}

function extractFontLinks(html) {
  const links = new Set();
  const re = /https:\/\/fonts\.googleapis\.com\/[^"')]+/g;
  let m;
  while ((m = re.exec(html))) links.add(m[0].replace(/&amp;/g, '&'));
  return [...links];
}

async function main() {
  await mkdir(HTML_DIR, { recursive: true });
  await mkdir(CSS_DIR, { recursive: true });

  const cssUrls = new Set();
  const fontLinks = new Set();

  for (const [name, url] of Object.entries(PAGES)) {
    console.log(`Fetching ${name}: ${url}`);
    const html = await fetchText(url);
    await writeFile(path.join(HTML_DIR, `${name}.html`), html, 'utf8');
    for (const l of extractCssLinks(html, url)) cssUrls.add(l);
    for (const f of extractFontLinks(html)) fontLinks.add(f);
  }

  console.log(`\nFound ${cssUrls.size} unique CSS bundles.`);
  for (const url of cssUrls) {
    const fname = new URL(url).pathname.split('/').pop();
    console.log(`  fetching ${fname}`);
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) {
      console.warn(`  WARN: ${url} -> ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(CSS_DIR, fname), buf);
  }

  console.log('\nGoogle Font links found:');
  for (const f of fontLinks) console.log(`  ${f}`);
  console.log(
    '\nDone. HTML in design/references/html/, CSS in design/references/css/.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
