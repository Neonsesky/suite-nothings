import { expect, test } from '@playwright/test';
import { checkpoint, isMobile, resetApp, waitForStays, watchConsole } from './helpers';

test.describe('boot', () => {
  test('first launch asks who is checking in, then shows demo stays', async ({ page }, testInfo) => {
    const errors = watchConsole(page);
    await resetApp(page, { me: null });
    await expect(page).toHaveURL(/#\/welcome$/);
    await expect(page.getByRole('heading', { name: "Who's checking in?" })).toBeVisible();
    await checkpoint(page, testInfo, 'welcome');
    await page.getByRole('button', { name: 'Nirsh' }).click();
    await waitForStays(page);
    await expect(page.getByText('Demo', { exact: true }).locator('visible=true')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('stays home renders seeded data with the split-flap counter', async ({ page }, testInfo) => {
    const errors = watchConsole(page);
    await resetApp(page);
    await waitForStays(page);
    await expect(page.getByText('11 hotels together', { exact: true })).toBeAttached();
    await expect(page.locator('[data-visit-id]').first()).toBeVisible();
    await checkpoint(page, testInfo, 'stays');
    await checkpoint(page, testInfo, 'stays-full', { fullPage: true });
    // City tabs switch the grid.
    await page.getByRole('group', { name: 'City' }).getByRole('button', { name: /Abroad/ }).click();
    await expect(page.locator('[data-visit-id]')).toHaveCount(2);
    await expect(page.getByRole('link', { name: /Çırağan Palace/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('search finds a stay by a word from our notes', async ({ page }) => {
    await resetApp(page);
    await waitForStays(page);
    await page.getByRole('searchbox', { name: "Find a stay we've had" }).fill('lanterns');
    await expect(page.locator('[data-visit-id]')).toHaveCount(1);
    await expect(page.getByRole('link', { name: /The Chedi Muscat/ })).toBeVisible();
  });
});

test.describe('navigation', () => {
  test('tabs and header navigate between screens', async ({ page }, testInfo) => {
    const errors = watchConsole(page);
    await resetApp(page);
    await waitForStays(page);
    const nav = page.getByRole('navigation', { name: 'Main' }).locator('visible=true');
    await nav.getByRole('link', { name: 'Map' }).click();
    await expect(page).toHaveURL(/#\/map$/);
    await expect(page.getByRole('heading', { name: 'Our map' })).toBeVisible();
    await nav.getByRole('link', { name: 'Journey' }).click();
    await expect(page).toHaveURL(/#\/journey$/);
    await nav.getByRole('link', { name: 'Us' }).click();
    await expect(page).toHaveURL(/#\/us$/);
    await expect(page.getByRole('heading', { name: 'Us', exact: true })).toBeVisible();
    await checkpoint(page, testInfo, 'us');
    if (isMobile(testInfo)) {
      await nav.getByRole('link', { name: 'Stays' }).click();
    } else {
      await page.getByRole('link', { name: /Suite Nothings/ }).click();
    }
    await waitForStays(page);
    // A card opens its detail route.
    await page.locator('[data-visit-id]').first().click();
    await expect(page).toHaveURL(/#\/stay\/[0-9A-Z]{26}$/);
    expect(errors).toEqual([]);
  });

  test('keyboard shortcuts on desktop', async ({ page }, testInfo) => {
    test.skip(isMobile(testInfo), 'desktop only');
    await resetApp(page);
    await waitForStays(page);
    await page.keyboard.press('m');
    await expect(page).toHaveURL(/#\/map$/);
    await page.keyboard.press('j');
    await expect(page).toHaveURL(/#\/journey$/);
    await page.keyboard.press('/');
    await waitForStays(page);
    await expect(page.getByRole('searchbox')).toBeFocused();
    await page.keyboard.press('Escape');
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('n');
    await expect(page).toHaveURL(/#\/add$/);
    await expect(page.getByRole('dialog', { name: 'Add a stay' })).toBeVisible();
  });

  test('unknown routes show a friendly way home', async ({ page }) => {
    await resetApp(page, { hash: '#/nowhere' });
    await expect(page.getByRole('heading', { name: "This room doesn't exist" })).toBeVisible();
  });
});

test.describe('delete and undo', () => {
  test('a deleted stay comes back with Undo', async ({ page }) => {
    await resetApp(page);
    await waitForStays(page);
    const cards = page.locator('[data-visit-id]');
    const before = await cards.count();
    await cards.first().click();
    await page.getByRole('button', { name: 'Delete this stay' }).click();
    await waitForStays(page);
    await expect(cards).toHaveCount(before - 1);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(cards).toHaveCount(before);
  });
});
