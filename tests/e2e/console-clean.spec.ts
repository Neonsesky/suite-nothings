/**
 * Release QA: every route in the demo-mode app should load without console.error,
 * console.warn, or an uncaught pageerror (iphone-390 at minimum — see playwright.config.ts).
 * Run against the production preview build: `npm run e2e` (not `e2e:dev`).
 */
import { expect, test } from '@playwright/test';
import { resetApp, waitForStays, watchConsole } from './helpers';

test.describe('console is clean on every route', () => {
  test('#/ (stays home)', async ({ page }) => {
    const errors = watchConsole(page);
    await resetApp(page);
    await waitForStays(page);
    expect(errors).toEqual([]);
  });

  test('#/map', async ({ page }) => {
    const errors = watchConsole(page);
    await resetApp(page, { hash: '#/map' });
    await expect(page.getByRole('heading', { name: 'Our map' })).toBeAttached();
    expect(errors).toEqual([]);
  });

  test('#/add', async ({ page }) => {
    const errors = watchConsole(page);
    await resetApp(page, { hash: '#/add' });
    await expect(page.getByRole('dialog', { name: 'Add a stay' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('#/journey', async ({ page }) => {
    const errors = watchConsole(page);
    await resetApp(page, { hash: '#/journey' });
    await expect(page.getByRole('heading', { name: 'Our journey' })).toBeAttached();
    expect(errors).toEqual([]);
  });

  test('#/us', async ({ page }) => {
    const errors = watchConsole(page);
    await resetApp(page, { hash: '#/us' });
    await expect(page.getByRole('heading', { name: 'Us', level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('#/wishlist', async ({ page }) => {
    const errors = watchConsole(page);
    await resetApp(page, { hash: '#/wishlist' });
    await expect(page.getByRole('heading', { name: 'Next check-ins', level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('#/letters', async ({ page }) => {
    const errors = watchConsole(page);
    await resetApp(page, { hash: '#/letters' });
    await expect(page.getByRole('heading', { name: 'A note on your pillow' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('#/settings', async ({ page }) => {
    const errors = watchConsole(page);
    await resetApp(page, { hash: '#/settings' });
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('#/stay/:id (demo stay detail)', async ({ page }) => {
    const errors = watchConsole(page);
    await resetApp(page);
    await waitForStays(page);
    const id = await page.locator('[data-visit-id]').first().getAttribute('data-visit-id');
    await page.goto(`./#/stay/${id}`);
    await expect(page.locator(`[data-stay-header="${id}"]`)).toBeVisible();
    expect(errors).toEqual([]);
  });
});
