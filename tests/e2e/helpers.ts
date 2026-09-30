import { expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Person = 'nirsh' | 'shady';

/**
 * Fresh app state: wipes every IndexedDB database, localStorage and sessionStorage, then
 * optionally sets who is on this device, and loads `hash`.
 */
export async function resetApp(page: Page, opts: { me?: Person | null; hash?: string } = {}): Promise<void> {
  // A static same-origin file, so the app never boots (and never preloads) during the wipe.
  await page.goto('./favicon.svg');
  await page.evaluate(async () => {
    const dbs = (await indexedDB.databases?.()) ?? [];
    await Promise.all(
      dbs.map(
        (d) =>
          new Promise<void>((resolve) => {
            if (!d.name) return resolve();
            const req = indexedDB.deleteDatabase(d.name);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          }),
      ),
    );
    localStorage.clear();
    sessionStorage.clear();
  });
  if (opts.me !== null) {
    const me = opts.me ?? 'nirsh';
    await page.evaluate((m) => localStorage.setItem('sn:device:me', JSON.stringify(m)), me);
  }
  await page.goto(`./${opts.hash ?? '#/'}`);
  await page.reload();
}

/** Collects console errors/warnings and page errors; assert with `expect(errors).toEqual([])`. */
export function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.text().includes('Service Worker registration blocked by Playwright')) return;
    if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

export function isMobile(testInfo: TestInfo): boolean {
  return !testInfo.project.name.startsWith('desktop');
}

/** True when the run should write committed evidence (`CHECKPOINTS=1 npm run e2e`). */
export const WRITE_CHECKPOINTS = process.env.CHECKPOINTS === '1';

/**
 * Saves design/checkpoints/w0-foundation/<name>-<project>.png (committed evidence) when
 * CHECKPOINTS=1; otherwise attaches the screenshot to the test report only.
 */
export async function checkpoint(page: Page, testInfo: TestInfo, name: string, opts: { fullPage?: boolean } = {}): Promise<void> {
  if (!WRITE_CHECKPOINTS) {
    await testInfo.attach(name, { body: await page.screenshot({ fullPage: opts.fullPage ?? false }), contentType: 'image/png' });
    return;
  }
  const path = `design/checkpoints/w0-foundation/${name}-${testInfo.project.name}.png`;
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: opts.fullPage ?? false });
}

export async function waitForStays(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Our stays' })).toBeVisible();
}
