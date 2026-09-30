import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { isMobile, resetApp, waitForStays, watchConsole, WRITE_CHECKPOINTS } from './helpers';

/** Same pattern as tests/e2e/helpers.ts checkpoint(), but writes to our own task folder. */
async function checkpoint(page: Page, testInfo: TestInfo, name: string, opts: { fullPage?: boolean } = {}): Promise<void> {
  if (!WRITE_CHECKPOINTS) {
    await testInfo.attach(name, { body: await page.screenshot({ fullPage: opts.fullPage ?? false }), contentType: 'image/png' });
    return;
  }
  const path = `design/checkpoints/w1-shell/settings/${name}-${testInfo.project.name}.png`;
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: opts.fullPage ?? false });
}

async function goToSettings(page: Page): Promise<void> {
  await page.goto('./#/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
}

test.describe('settings persistence', () => {
  test('who am I, map lighting, units, reduce motion and sound survive reload', async ({ page }, testInfo) => {
    const errors = watchConsole(page);
    await resetApp(page, { hash: '#/settings' });
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await checkpoint(page, testInfo, 'top');

    await page.getByRole('group', { name: 'Who am I' }).getByRole('button', { name: 'Shady' }).click();
    await page.getByRole('group', { name: 'Map lighting' }).getByRole('button', { name: 'Golden hour' }).click();
    await page.getByRole('group', { name: 'Units' }).getByRole('button', { name: 'Miles' }).click();
    await page.getByRole('group', { name: 'Reduce motion' }).getByRole('button', { name: 'Reduce' }).click();
    await page.getByRole('switch', { name: 'Sound' }).click();

    await checkpoint(page, testInfo, 'about', { fullPage: true });

    await page.reload();
    await expect(page.getByRole('group', { name: 'Who am I' }).getByRole('button', { name: 'Shady' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Map lighting' }).getByRole('button', { name: 'Golden hour' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Units' }).getByRole('button', { name: 'Miles' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Reduce motion' }).getByRole('button', { name: 'Reduce' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'false');
    expect(errors).toEqual([]);
  });
});

test.describe('export and import', () => {
  test('downloading, clearing and re-importing brings the demo stays back', async ({ page }, testInfo) => {
    test.slow();
    const errors = watchConsole(page);
    await resetApp(page);
    await waitForStays(page);
    await expect(page.getByText('11 hotels together', { exact: true })).toBeAttached();

    await goToSettings(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download our data' }).click(),
    ]);
    const savePath = join('.tmp', `settings-export-${testInfo.project.name}.zip`);
    mkdirSync(dirname(savePath), { recursive: true });
    await download.saveAs(savePath);

    await page.getByRole('button', { name: 'Clear demo data' }).click();
    const clearDialog = page.getByRole('dialog', { name: 'Clear demo data?' });
    await expect(clearDialog).toBeVisible();
    // Keyboard-activate: a pointer click on a BottomSheet footer button can be claimed by the
    // sheet's own drag handling on touch-emulated browsers (the footer sits outside the
    // scrollable `.content` region that skips drag capture for its own controls).
    await clearDialog.getByRole('button', { name: 'Clear' }).focus();
    await page.keyboard.press('Enter');
    await expect(clearDialog).toBeHidden();
    await page.goto('./#/');
    await expect(page.getByRole('heading', { name: 'Our first check-in is waiting' })).toBeVisible();

    await goToSettings(page);
    await page.locator('input[type="file"]').setInputFiles(savePath);
    const preview = page.getByRole('dialog', { name: 'Import this file?' });
    await expect(preview).toBeVisible();
    await checkpoint(page, testInfo, 'import-preview');
    await preview.getByRole('button', { name: 'Import' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Imported \d+ changes?/)).toBeVisible();

    await page.goto('./#/');
    await waitForStays(page);
    await expect(page.getByText('11 hotels together', { exact: true })).toBeAttached();
    expect(errors).toEqual([]);
  });
});

test.describe('home base', () => {
  test('changing the city with Photon mocked persists after reload', async ({ page }, testInfo) => {
    const errors = watchConsole(page);
    await page.route('**/photon.komoot.io/**', (route) =>
      route.fulfill({
        json: {
          features: [
            {
              geometry: { coordinates: [-0.1276, 51.5072] },
              properties: {
                name: 'London',
                country: 'United Kingdom',
                countrycode: 'gb',
                osm_type: 'R',
                osm_id: 65606,
                osm_key: 'place',
                osm_value: 'city',
                extent: [-0.5103, 51.6919, 0.3340, 51.2868],
              },
            },
          ],
        },
      }),
    );
    await resetApp(page, { hash: '#/settings' });
    await page.getByRole('button', { name: 'Change' }).click();
    const sheet = page.getByRole('dialog', { name: 'Change home base' });
    await expect(sheet).toBeVisible();
    await checkpoint(page, testInfo, 'home-base-sheet');
    await sheet.getByRole('combobox', { name: 'Search for a city' }).fill('London');
    await expect(sheet.getByRole('option', { name: /London/ })).toBeVisible();
    await sheet.getByRole('option', { name: /London/ }).click();
    await expect(page.getByText('Home base set to London')).toBeVisible();

    await page.reload();
    await expect(page.getByText('London, United Kingdom', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('layout', () => {
  test('no horizontal overflow at the phone width', async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo), 'mobile only');
    await resetApp(page, { hash: '#/settings' });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });
});
