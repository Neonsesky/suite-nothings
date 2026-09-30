// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createGasEnv } from '../../tools/gas-harness/index.mjs';

const SCRIPT = resolve(__dirname, '../../tools/make-letter-gs.mjs');
const dir = mkdtempSync(join(tmpdir(), 'sn-letter-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const FAKE = 'Dear test,\n\n"Quotes", \'apostrophes\', a back\\slash, </script> and ${notATemplate}.\r\nTabs\there. Ünïcødé ✨\n\n— me\n';

describe('make-letter-gs', () => {
  it('generates an idempotent seedLetters_() that keeps the text exactly, without printing it', () => {
    const input = join(dir, 'letter.md');
    const output = join(dir, 'Letter.gs');
    writeFileSync(input, FAKE, 'utf8');
    const run = spawnSync(process.execPath, [SCRIPT, '--in', input, '--out', output], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout + run.stderr).not.toContain('Dear test');
    const source = readFileSync(output, 'utf8');
    expect(source).toContain('function seedLetters_()');

    const env = createGasEnv({ appKey: 'k', extraSources: [{ name: 'Letter.gs', source }] });
    env.run('setup');
    env.run('setup');
    const rows = env.ss.sheet('Letters').rows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ letter_id: 'LETTER-PILLOW-0001', title: 'A note on your pillow', from: 'nirsh', to: 'shady', unlock_rule: 'always', written_at: '2026-09-19', read_at: '', updated_at: '2026-09-19T20:00:00.000Z' });
    expect(rows[0].body_md).toBe(FAKE);
    const letter = env.call.get({ action: 'bootstrap', key: 'k' }).data.letters[0];
    expect(letter.body_md).toBe(FAKE);
    expect(env.logs.join('\n')).not.toContain('Dear test');
  });

  it('exits 1 with a friendly message when the letter is missing', () => {
    const run = spawnSync(process.execPath, [SCRIPT, '--in', join(dir, 'nope.md'), '--out', join(dir, 'x.gs')], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('No letter found');
  });
});
