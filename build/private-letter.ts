import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

const ID = 'virtual:private-letter';
const RESOLVED = '\0' + ID;

/**
 * Serves `virtual:private-letter` → `{ body: string | null }`.
 * `body` is the exact text of `private/letter.md` when it exists at build time (local dev and
 * local builds), otherwise `null` (CI). The letter never lives in git.
 * Set `SN_NO_PRIVATE_LETTER=1` to force `null` (e.g. to build a shareable demo locally).
 */
export function privateLetter(root = process.cwd()): Plugin {
  const file = resolve(root, 'private/letter.md');
  return {
    name: 'suite-nothings:private-letter',
    resolveId(id) {
      return id === ID ? RESOLVED : null;
    },
    load(id) {
      if (id !== RESOLVED) return null;
      let body: string | null = null;
      if (process.env.SN_NO_PRIVATE_LETTER !== '1' && existsSync(file)) {
        body = readFileSync(file, 'utf8');
        this.addWatchFile(file);
      }
      return `export const body = ${JSON.stringify(body)};\nexport default { body };\n`;
    },
  };
}
