// WCAG 2.x contrast for every text/background pair we use. Reads src/styles/tokens.css.
// Usage: node contrast.mjs   → markdown table on stdout
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
const v = Object.fromEntries([...css.matchAll(/--(color-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [
  ['ink', 'paper', 'body text, headings'], ['ink', 'cream', 'text on banners'], ['ink', 'surface', 'text on grey sections'],
  ['ink', 'honey', 'primary button label, badges'], ['ink', 'honey-deep', 'pressed primary button'], ['ink', 'honey-soft', 'selected chip'],
  ['ink', 'ginger', 'favourite badge label'], ['ink', 'ginger-soft', 'letter card text'],
  ['paper', 'ink', 'split-flap digits, footer, toasts'], ['paper', 'ginger', 'large-only: celebration headline ≥ 24 px'],
  ['muted', 'paper', 'secondary text'], ['muted', 'cream', 'secondary text on banners'], ['muted', 'surface', 'secondary on grey'],
  ['subtle', 'paper', 'placeholders, tertiary'], ['ginger-ink', 'paper', 'love-coloured text (e.g. "♡ Favourite")'],
  ['ginger-ink', 'ginger-soft', 'text on letter card accent'], ['success', 'paper', 'sync ok text'], ['danger', 'paper', 'error text'],
  ['focus', 'paper', 'focus ring (non-text, needs 3:1)'], ['honey', 'paper', 'non-text: honey pin/fill vs paper (decorative)'],
  ['line', 'paper', 'non-text: dividers (decorative)'],
];
console.log('| Foreground | Background | Ratio | AA normal (4.5) | AA large / UI (3.0) | Used for |\n|---|---|---|---|---|---|');
for (const [f, b, use] of pairs) {
  const r = ratio(v[`color-${f}`], v[`color-${b}`]);
  console.log(`| \`${f}\` ${v[`color-${f}`]} | \`${b}\` ${v[`color-${b}`]} | ${r.toFixed(2)} | ${r >= 4.5 ? 'pass' : 'fail'} | ${r >= 3 ? 'pass' : 'fail'} | ${use} |`);
}
