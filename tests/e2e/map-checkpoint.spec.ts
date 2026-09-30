import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, renameSync } from 'node:fs';
import { resetApp, WRITE_CHECKPOINTS } from './helpers';

// Checkpoint 2 evidence for the map (only with CHECKPOINTS=1): chapters × lighting × viewport,
// a zoom frame strip across both breakpoints, and a video of the zoom and a chip flyTo.
const OUT = 'design/checkpoints/cp2/map';

type Engine = { map: import('maplibre-gl').Map; setChapter(c: string, o?: { animate?: boolean }): void; setLighting(m: string): void; breakpoints: { city: number; country: number } };

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem('sn:e2e', '1'));
  await resetApp(page, { hash: '#/map' });
  await expect(page.locator('[data-status="ready"]')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __sn?: { map?: Engine } }).__sn?.map?.map.loaded()));
}

async function settle(page: Page, ms = 1500) {
  await page.evaluate(
    (t) =>
      new Promise<void>((resolve) => {
        const m = (window as unknown as { __sn: { map: Engine } }).__sn.map.map;
        const done = () => setTimeout(resolve, 250);
        m.once('idle', done);
        m.triggerRepaint();
        setTimeout(resolve, t + 6000);
      }),
    ms,
  );
  await page.waitForTimeout(ms);
}

test.describe('map checkpoint 2', () => {
  test.skip(!WRITE_CHECKPOINTS, 'writes committed evidence only with CHECKPOINTS=1');
  test.setTimeout(180_000);

  test('chapters in day and night lighting', async ({ page }, testInfo) => {
    const vp = testInfo.project.name.replace('map-', '');
    mkdirSync(OUT, { recursive: true });
    await open(page);
    for (const light of ['day', 'night'] as const) {
      await page.evaluate((l) => (window as unknown as { __sn: { map: Engine } }).__sn.map.setLighting(l), light);
      for (const chapter of ['city', 'country', 'world'] as const) {
        await page.evaluate((c) => (window as unknown as { __sn: { map: Engine } }).__sn.map.setChapter(c, { animate: false }), chapter);
        await settle(page);
        await page.screenshot({ path: `${OUT}/${chapter}-${light}-${vp}.png`, scale: 'css' });
      }
    }
  });

  test('zoom frame strip and video', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'map-390', 'one recording is enough');
    mkdirSync(`${OUT}/frames`, { recursive: true });
    const context = await browser.newContext({
      ...testInfo.project.use,
      recordVideo: { dir: 'test-results/map-video', size: { width: 390, height: 844 } },
    });
    const page = await context.newPage();
    await open(page);
    await page.evaluate(() => (window as unknown as { __sn: { map: Engine } }).__sn.map.setLighting('day'));
    await settle(page, 800);

    // Frames stepped across both breakpoints, to check the crossfades and where the title flips.
    const bp = await page.evaluate(() => (window as unknown as { __sn: { map: Engine } }).__sn.map.breakpoints);
    const zooms = [11, 10.2, bp.city + 0.3, bp.city + 0.05, bp.city - 0.2, 8, 6.8, bp.country + 0.35, bp.country + 0.05, bp.country - 0.3, 3.5, 1.2];
    for (const [i, z] of zooms.entries()) {
      await page.evaluate((zz) => (window as unknown as { __sn: { map: Engine } }).__sn.map.map.jumpTo({ zoom: zz, pitch: Math.max(0, Math.min(55, (zz - 5) * 11)), bearing: 0 }), z);
      await settle(page, 900);
      await page.screenshot({ path: `${OUT}/frames/${String(i + 1).padStart(2, '0')}-z${z.toFixed(2)}.png`, scale: 'css' });
    }

    // Video: a continuous zoom from Dubai to the globe, then the City chip flies back.
    await page.evaluate(() => (window as unknown as { __sn: { map: Engine } }).__sn.map.setChapter('city', { animate: false }));
    await settle(page, 800);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const m = (window as unknown as { __sn: { map: Engine } }).__sn.map.map;
          m.easeTo({ zoom: 1.3, pitch: 0, bearing: 0, duration: 7000 });
          m.once('moveend', () => resolve());
        }),
    );
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'City', exact: true }).click();
    await page.waitForTimeout(3500);
    await page.getByRole('button', { name: 'Country', exact: true }).click();
    await page.waitForTimeout(3000);
    const video = page.video();
    await context.close();
    if (video) renameSync(await video.path(), `${OUT}/zoom-and-chips-390.webm`);
  });
});
