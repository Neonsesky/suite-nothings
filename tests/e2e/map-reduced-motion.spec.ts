/**
 * Release QA: the journey-replay signature animation under `prefers-reduced-motion: reduce`.
 * Filename matches playwright.config.ts's MAP_SPECS pattern so it runs in the map-* projects,
 * which launch Chromium with a software GL renderer — headless iphone-390/desktop-1440 have no
 * GPU, so the map/journey WebGL engine never initialises there.
 */
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { resetApp } from './helpers';

const DIR = 'design/checkpoints/final/reduced-motion';
function shot(page: Page, name: string) {
  mkdirSync(DIR, { recursive: true });
  return page.screenshot({ path: `${DIR}/${name}.png` });
}

test('journey replay crossfades instead of flying the camera, under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('sn:e2e', '1'));
  await resetApp(page, { hash: '#/journey' });
  await expect(page.locator('[data-testid="journey-screen"][data-status="ready"]')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __sn?: { journey?: unknown } }).__sn?.journey));
  await page.getByTestId('journey-start').click();
  await page.waitForFunction(() => (window as unknown as { __sn: { journey: { phase: string } } }).__sn.journey.phase !== 'ready');
  await page.waitForTimeout(400);
  await expect(page.getByTestId('journey-start')).not.toBeVisible();
  await shot(page, 'journey-replay-reduced');
});
