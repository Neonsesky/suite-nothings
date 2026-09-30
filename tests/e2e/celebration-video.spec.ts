import { copyFileSync, mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { resetApp, WRITE_CHECKPOINTS } from './helpers';

/**
 * Checkpoint 2 evidence: records the save celebration and grabs a burst of frames so the
 * timeline can be checked frame by frame. Runs only with CHECKPOINTS=1 on the 390 px phone.
 */
const OUT = 'design/checkpoints/cp2/save-celebration';

test.skip(!WRITE_CHECKPOINTS, 'writes committed checkpoint evidence only with CHECKPOINTS=1');

test('save celebration, recorded', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-390', 'one recording is enough');
  mkdirSync(`${OUT}/frames`, { recursive: true });
  const context = await browser.newContext({
    ...testInfo.project.use,
    baseURL: testInfo.project.use.baseURL,
    recordVideo: { dir: 'test-results/celebration-video', size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();
  await page.route('https://photon.komoot.io/**', (r) => r.fulfill({ contentType: 'application/json', body: '{"features":[]}' }));
  await resetApp(page, { hash: '#/add' });
  await page.getByRole('combobox', { name: 'Search hotels or areas' }).waitFor();
  await page.getByRole('button', { name: 'Add it by hand' }).first().click();
  await page.getByLabel('Hotel name').fill('Lantern Nest');
  await page.getByRole('button', { name: 'Use this hotel' }).click();
  for (let i = 0; i < 3; i++) await page.getByTestId('step-next').click();
  await page.getByTestId('save-stay').click();
  const c = page.getByTestId('celebration');
  await expect(c).toBeVisible();
  const t0 = Date.now();
  for (let i = 0; i < 14; i++) {
    const ms = Date.now() - t0;
    await page.screenshot({ path: `${OUT}/frames/${String(i).padStart(2, '0')}-${String(ms).padStart(4, '0')}ms.png`, scale: 'css' });
    await page.waitForTimeout(90);
    if (!(await c.isVisible())) break;
  }
  await expect(c).toBeHidden({ timeout: 5000 });
  const video = page.video();
  await context.close();
  if (video) copyFileSync(await video.path(), `${OUT}/save-celebration-390.webm`);
});
