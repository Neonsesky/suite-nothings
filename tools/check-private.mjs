// Fails if any line of private/letter.md (≥ 16 chars) appears in a git-tracked or staged file.
// Prints only file names, never the matching text.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const file = 'private/letter.md';
if (!existsSync(file)) {
  console.log('private/letter.md absent: nothing to check');
  process.exit(0);
}
const lines = readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length >= 16);
const files = execSync('git ls-files --cached', { encoding: 'utf8' }).split('\n').filter(Boolean);
const hits = new Set();
for (const f of files) {
  if (!existsSync(f)) continue;
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  if (lines.some((l) => text.includes(l))) hits.add(f);
}
if (hits.size) {
  console.error(`Private letter text found in: ${[...hits].join(', ')}`);
  process.exit(1);
}
console.log(`OK: no private letter text in ${files.length} tracked files`);
