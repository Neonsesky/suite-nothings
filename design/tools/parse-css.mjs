#!/usr/bin/env node
/**
 * Parse all CSS in design/references/css/ and produce a frequency-counted
 * summary of design tokens (colours, custom properties, type scale, radii,
 * shadows, breakpoints, transitions, z-index, max-widths) at
 * design/references/css-summary.json.
 *
 * Usage: node parse-css.mjs
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF_DIR = path.resolve(__dirname, '../references');
const CSS_DIR = path.join(REF_DIR, 'css');
const OUT_FILE = path.join(REF_DIR, 'css-summary.json');

function bump(map, key) {
  if (key == null) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function sortedEntries(map, limit = 200) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

// --- colour normalisation ---------------------------------------------
function hexFromRgb(r, g, b) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toLowerCase();
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function normaliseColor(raw) {
  const s = raw.trim().toLowerCase();
  if (/^#([0-9a-f]{3})$/.test(s)) {
    const [, hex] = s.match(/^#([0-9a-f]{3})$/);
    return '#' + [...hex].map((c) => c + c).join('');
  }
  if (/^#([0-9a-f]{6})$/.test(s)) return s;
  if (/^#([0-9a-f]{8})$/.test(s)) return s.slice(0, 7); // drop alpha
  let m = s.match(/^rgba?\(\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m) {
    const toNum = (v) => (v.endsWith('%') ? (parseFloat(v) / 100) * 255 : parseFloat(v));
    const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
    if (alpha === 0) return null; // fully transparent, not a real colour
    return hexFromRgb(toNum(m[1]), toNum(m[2]), toNum(m[3]));
  }
  m = s.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m) {
    const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
    if (alpha === 0) return null;
    const [r, g, b] = hslToRgb(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    return hexFromRgb(r, g, b);
  }
  return null;
}

const NAMED_SKIP = new Set([
  'transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'none',
  'white', 'black', // still capture via hex forms elsewhere if used directly
]);

async function main() {
  const files = (await readdir(CSS_DIR)).filter((f) => f.endsWith('.css'));
  if (files.length === 0) {
    console.error(`No CSS files found in ${CSS_DIR}. Run fetch-dayuse.mjs first.`);
    process.exit(1);
  }

  const colors = new Map();
  const customProps = new Map(); // name -> Map(value -> count), flattened later
  const customPropRaw = new Map(); // "name: value" -> count
  const fontFamilies = new Map();
  const fontWeights = new Map();
  const fontSizes = new Map();
  const lineHeights = new Map();
  const letterSpacings = new Map();
  const borderRadii = new Map();
  const boxShadows = new Map();
  const mediaBreakpoints = new Map();
  const transitions = new Map();
  const zIndexes = new Map();
  const maxWidths = new Map();

  let totalBytes = 0;

  for (const file of files) {
    const css = await readFile(path.join(CSS_DIR, file), 'utf8');
    totalBytes += css.length;

    // Colours: hex
    for (const m of css.matchAll(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g)) {
      const norm = normaliseColor(m[0]);
      if (norm) bump(colors, norm);
    }
    // Colours: rgb/rgba
    for (const m of css.matchAll(/rgba?\([^)]+\)/g)) {
      const norm = normaliseColor(m[0]);
      if (norm) bump(colors, norm);
    }
    // Colours: hsl/hsla
    for (const m of css.matchAll(/hsla?\([^)]+\)/g)) {
      const norm = normaliseColor(m[0]);
      if (norm) bump(colors, norm);
    }

    // Custom properties: --name: value;
    for (const m of css.matchAll(/(--[a-zA-Z0-9-_]+)\s*:\s*([^;{}]+);/g)) {
      const name = m[1];
      const value = m[2].trim();
      bump(customPropRaw, `${name}: ${value}`);
      if (!customProps.has(name)) customProps.set(name, new Map());
      bump(customProps.get(name), value);
    }

    // font-family
    for (const m of css.matchAll(/font-family\s*:\s*([^;{}]+);/g)) {
      bump(fontFamilies, m[1].trim());
    }

    // font-weight
    for (const m of css.matchAll(/font-weight\s*:\s*([^;{}]+);/g)) {
      bump(fontWeights, m[1].trim());
    }

    // font-size
    for (const m of css.matchAll(/font-size\s*:\s*([^;{}]+);/g)) {
      bump(fontSizes, m[1].trim());
    }

    // line-height
    for (const m of css.matchAll(/line-height\s*:\s*([^;{}]+);/g)) {
      bump(lineHeights, m[1].trim());
    }

    // letter-spacing
    for (const m of css.matchAll(/letter-spacing\s*:\s*([^;{}]+);/g)) {
      bump(letterSpacings, m[1].trim());
    }

    // border-radius (incl. -webkit- etc via plain property)
    for (const m of css.matchAll(/border-radius\s*:\s*([^;{}]+);/g)) {
      bump(borderRadii, m[1].trim());
    }

    // box-shadow
    for (const m of css.matchAll(/box-shadow\s*:\s*([^;{}]+);/g)) {
      bump(boxShadows, m[1].trim());
    }

    // media query breakpoints
    for (const m of css.matchAll(/@media[^{]*\(\s*(?:min|max)-width\s*:\s*([\d.]+px)\s*\)/g)) {
      bump(mediaBreakpoints, m[1]);
    }

    // transitions (timing function / duration)
    for (const m of css.matchAll(/transition\s*:\s*([^;{}]+);/g)) {
      bump(transitions, m[1].trim());
    }
    for (const m of css.matchAll(/transition-duration\s*:\s*([^;{}]+);/g)) {
      bump(transitions, `duration:${m[1].trim()}`);
    }
    for (const m of css.matchAll(/transition-timing-function\s*:\s*([^;{}]+);/g)) {
      bump(transitions, `timing:${m[1].trim()}`);
    }

    // z-index
    for (const m of css.matchAll(/z-index\s*:\s*(-?\d+)\s*;/g)) {
      bump(zIndexes, m[1]);
    }

    // max-width
    for (const m of css.matchAll(/max-width\s*:\s*([^;{}]+);/g)) {
      bump(maxWidths, m[1].trim());
    }
  }

  // Flatten custom props: name -> [{value, count}]
  const customPropsOut = {};
  for (const [name, valMap] of customProps.entries()) {
    customPropsOut[name] = sortedEntries(valMap, 20);
  }

  const summary = {
    meta: {
      filesParsed: files,
      totalBytes,
      generatedAt: new Date().toISOString(),
    },
    colors: sortedEntries(colors, 300),
    customProperties: customPropsOut,
    customPropertiesRaw: sortedEntries(customPropRaw, 300),
    fontFamilies: sortedEntries(fontFamilies, 50),
    fontWeights: sortedEntries(fontWeights, 50),
    fontSizes: sortedEntries(fontSizes, 100),
    lineHeights: sortedEntries(lineHeights, 100),
    letterSpacings: sortedEntries(letterSpacings, 100),
    borderRadii: sortedEntries(borderRadii, 100),
    boxShadows: sortedEntries(boxShadows, 100),
    mediaBreakpoints: sortedEntries(mediaBreakpoints, 50),
    transitions: sortedEntries(transitions, 100),
    zIndexes: sortedEntries(zIndexes, 50),
    maxWidths: sortedEntries(maxWidths, 100),
  };

  await writeFile(OUT_FILE, JSON.stringify(summary, null, 2), 'utf8');

  // human summary
  console.log(`Parsed ${files.length} CSS files, ${totalBytes} bytes total.\n`);
  console.log('Top colours:');
  for (const { value, count } of summary.colors.slice(0, 20)) {
    console.log(`  ${value}  x${count}`);
  }
  console.log('\nTop font-families:');
  for (const { value, count } of summary.fontFamilies.slice(0, 10)) {
    console.log(`  ${value}  x${count}`);
  }
  console.log('\nTop font-sizes:');
  for (const { value, count } of summary.fontSizes.slice(0, 15)) {
    console.log(`  ${value}  x${count}`);
  }
  console.log('\nTop border-radii:');
  for (const { value, count } of summary.borderRadii.slice(0, 15)) {
    console.log(`  ${value}  x${count}`);
  }
  console.log('\nTop box-shadows:');
  for (const { value, count } of summary.boxShadows.slice(0, 10)) {
    console.log(`  ${value}  x${count}`);
  }
  console.log('\nMedia breakpoints:');
  for (const { value, count } of summary.mediaBreakpoints) {
    console.log(`  ${value}  x${count}`);
  }
  console.log(`\nWritten to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
