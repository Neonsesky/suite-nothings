import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { isMobile, resetApp, waitForStays, watchConsole, WRITE_CHECKPOINTS } from './helpers';

async function shot(page: Page, testInfo: TestInfo, name: string, fullPage = false) {
  if (!WRITE_CHECKPOINTS) {
    await testInfo.attach(name, { body: await page.screenshot({ fullPage }), contentType: 'image/png' });
    return;
  }
  mkdirSync('design/checkpoints/cp2/stays', { recursive: true });
  await page.screenshot({ path: `design/checkpoints/cp2/stays/${name}-${testInfo.project.name}.png`, fullPage });
}

const SECTIONS = ['stats', 'our-stays', 'story', 'install', 'moment', 'wishlist', 'faq', 'chains', 'footer'];

test.describe('Stays home', () => {
  test('renders every section in order', async ({ page }, testInfo) => {
    const errors = watchConsole(page);
    await resetApp(page);
    await waitForStays(page);
    await expect(page.locator('#hero-headline')).toBeVisible();
    const order = await page.locator('[data-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-section')));
    expect(order).toEqual(SECTIONS);
    await expect(page.getByText('Made by Nirsh for Shady')).toBeVisible();
    await expect(page.locator('[data-section="footer"] time')).toHaveText(/\d+ days, \d+ h, \d+ min together/);
    expect(await page.evaluate(() => document.documentElement.dataset.heroHeader)).toBe('1');
    await shot(page, testInfo, 'home-fold');
    await shot(page, testInfo, 'home-full', true);
    expect(errors).toEqual([]);
  });

  test('city tabs and filters narrow the grid', async ({ page }) => {
    await resetApp(page);
    await waitForStays(page);
    const cards = page.locator('[data-section="our-stays"] a[data-visit-id]');
    const all = page.getByRole('tab', { name: 'All' });
    await all.click();
    const total = await cards.count();
    expect(total).toBe(12);
    await page.getByRole('tab', { name: 'Abroad' }).click();
    await expect(cards).toHaveCount(2);
    await page.getByRole('tab', { name: 'Ras Al Khaimah' }).click();
    await expect(cards).toHaveCount(1);
    await all.click();
    await page.getByRole('button', { name: /^Filters/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Filters' });
    await sheet.getByRole('button', { name: 'Overnight' }).click();
    await sheet.getByRole('button', { name: 'Show our stays' }).click();
    const n = await cards.count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(total);
    await expect(page.getByRole('button', { name: 'Filters, 1 on' })).toBeVisible();
  });

  test('search finds a stay by note text', async ({ page }) => {
    await resetApp(page);
    await waitForStays(page);
    const input = page.getByRole('combobox', { name: "Find a stay we've had" });
    await input.fill('fountains');
    await expect(page.getByText('1 stay found')).toBeVisible();
    await expect(page.getByRole('option').first()).toContainText('Address Downtown');
    await input.fill('zzzz');
    await expect(page.getByText('No stays match that')).toBeVisible();
  });

  test('empty state after clearing demo data', async ({ page }, testInfo) => {
    await resetApp(page, { hash: '#/settings' });
    await page.getByRole('button', { name: 'Clear demo data' }).click();
    const confirm = page.getByRole('dialog', { name: 'Clear demo data?' });
    await confirm.getByRole('button', { name: 'Clear' }).click();
    await expect(confirm).toBeHidden();
    await page.goto('./#/');
    await expect(page.getByRole('heading', { name: 'Our first check-in is waiting' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add our first stay' })).toHaveAttribute('href', '#/add');
    await shot(page, testInfo, 'home-empty');
  });
});

test.describe('Stay detail', () => {
  test('card opens the detail with a shared-element name', async ({ page }, testInfo) => {
    const errors = watchConsole(page);
    await resetApp(page);
    await waitForStays(page);
    const card = page.locator('[data-section="our-stays"] a[data-visit-id]').first();
    const id = await card.getAttribute('data-visit-id');
    const vtName = await card.locator('div').first().evaluate((el) => getComputedStyle(el).viewTransitionName);
    await card.click();
    await expect(page).toHaveURL(new RegExp(`#/stay/${id}`));
    const header = page.locator(`[data-stay-header="${id}"]`);
    await expect(header).toBeVisible();
    expect(await header.evaluate((el) => getComputedStyle(el).viewTransitionName)).toBe(vtName);
    await shot(page, testInfo, 'detail', !isMobile(testInfo));
    expect(errors).toEqual([]);
  });

  test('map-app links use the exact SPEC URLs', async ({ page }) => {
    await resetApp(page);
    await waitForStays(page);
    await page.locator('[data-section="our-stays"] a[data-visit-id]').first().click();
    const g = await page.locator('[data-dir="google"]').getAttribute('href');
    expect(g).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=-?\d+(\.\d+)?,-?\d+(\.\d+)?$/);
    const [lat, lng] = g!.split('query=')[1].split(',');
    await expect(page.locator('[data-dir="apple"]')).toHaveAttribute('href', new RegExp(`^https://maps\\.apple\\.com/\\?ll=${lat},${lng}&q=.+`));
    await expect(page.locator('[data-dir="waze"]')).toHaveAttribute('href', `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
  });

  test('delete, then undo', async ({ page }) => {
    await resetApp(page);
    await waitForStays(page);
    await page.getByRole('tab', { name: 'All' }).click();
    const cards = page.locator('[data-section="our-stays"] a[data-visit-id]');
    await cards.first().click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remove this stay?' }).getByRole('button', { name: 'Delete' }).click();
    await waitForStays(page);
    await page.getByRole('tab', { name: 'All' }).click();
    await expect(cards).toHaveCount(11);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(cards).toHaveCount(12);
  });

  test('unknown stay shows the not-found state', async ({ page }) => {
    await resetApp(page, { hash: '#/stay/nope' });
    await expect(page.getByText("This room key doesn't open anything")).toBeVisible();
  });
});
