import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resetApp } from './helpers';

type Player = { pause(): void; seekStop(i: number): void };
type Sn = { journey?: Player };
declare global {
  interface Window {
    __sn?: Record<string, unknown>;
  }
}

const OUT = 'design/checkpoints/w3-e';

async function openJourney(page: Page) {
  await page.addInitScript(() => localStorage.setItem('sn:e2e', '1'));
  await resetApp(page);
  await page.goto('/#/journey');
  await page.waitForSelector('[data-testid="journey-start"]');
}

test('floating tags checkpoint', async ({ page }, testInfo) => {
  mkdirSync(OUT, { recursive: true });
  await openJourney(page);
  await page.getByTestId('journey-start').click();
  await page.evaluate(() => {
    (window.__sn as Sn).journey!.pause();
    (window.__sn as Sn).journey!.seekStop(3);
  });
  await page.waitForTimeout(900);
  await expect(page.getByTestId('journey-postcard')).toBeVisible();
  await page.screenshot({ path: `${OUT}/tags-${testInfo.project.name.replace('map-', '')}.png` });
});
