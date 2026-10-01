import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { resetApp, watchConsole } from './helpers';

/** Us dashboard, Next check-ins, Surprise me and wish → stay (SPEC §8.7, §12). */

const DIR = 'design/checkpoints/cp3/delight';
async function shot(page: Page, testInfo: TestInfo, name: string, fullPage = false) {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: `${DIR}/${name}-${testInfo.project.name}.png`, fullPage });
}

test.describe('us and wishlist', () => {
  test('the Us dashboard renders our numbers, picks, stamps and links', async ({ page }, testInfo) => {
    const errors = watchConsole(page);
    await resetApp(page, { hash: '#/us' });
    await expect(page.getByRole('heading', { name: 'Us', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Us, in numbers' })).toBeVisible();
    await expect(page.locator('[data-stat="hotels"] strong')).toHaveText('11');
    await expect(page.getByRole('heading', { name: 'Whose picks rate higher' })).toBeVisible();
    await expect(page.locator('[data-section="together"]')).toContainText('19 Jun 2026, 23:46');
    // The seed's 11 hotels earn at least "First stay", "5 hotels" and "10 hotels".
    await expect(page.locator('[data-milestone="hotels-10"]')).toHaveAttribute('data-earned', 'true');
    await expect(page.locator('[data-milestone="hotels-25"]')).toHaveAttribute('data-earned', 'false');
    await page.waitForTimeout(900);
    await shot(page, testInfo, 'us');
    await shot(page, testInfo, 'us-full', true);
    await page.locator('[data-milestone="hotels-10"]').click();
    await expect(page.getByTestId('stamp-detail')).toContainText('Earned');
    await page.waitForTimeout(400);
    await shot(page, testInfo, 'us-stamp-detail');
    await page.keyboard.press('Escape');
    await page.locator('[data-link="wishlist"]').click();
    await expect(page.getByRole('heading', { name: 'Next check-ins', level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Surprise me reveals a wish on the split-flap board', async ({ page }, testInfo) => {
    await resetApp(page, { hash: '#/wishlist' });
    await expect(page.locator('[data-wish-id]')).toHaveCount(2);
    await shot(page, testInfo, 'wishlist');
    await page.getByTestId('surprise-me').click();
    await expect(page.getByTestId('surprise')).toBeVisible();
    await page.waitForTimeout(350);
    await shot(page, testInfo, 'surprise-spinning');
    const name = page.getByTestId('surprise-name');
    await expect(name).toBeVisible({ timeout: 6000 });
    await page.waitForTimeout(300);
    await shot(page, testInfo, 'surprise-revealed');
    await expect(page.getByRole('link', { name: 'Turn into a stay' }).last()).toBeVisible();
  });

  test('a wish becomes a stay and moves to "came true"', async ({ page }) => {
    await resetApp(page, { hash: '#/wishlist' });
    const first = page.locator('[data-wish-id]').first();
    const wishName = (await first.locator('h3').textContent())?.trim() ?? '';
    await first.getByRole('link', { name: 'Turn into a stay' }).click();
    await expect(page.getByTestId('step-count')).toHaveText('2/5');
    for (let i = 0; i < 3; i++) await page.getByTestId('step-next').click();
    await page.getByTestId('save-stay').click();
    const c = page.getByTestId('celebration');
    await expect(c).toBeVisible();
    await c.click();
    await expect(page.getByText('Stay saved')).toBeVisible();
    // Any milestone unlock stamp sits on top; tap through it.
    const unlock = page.getByTestId('milestone-unlock');
    for (let i = 0; i < 4 && (await unlock.isVisible().catch(() => false)); i++) {
      await unlock.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(400);
    }
    await page.goto('./#/wishlist');
    await expect(page.locator('[data-wish-id]')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Wishes that came true' })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(wishName) })).toBeVisible();
  });

  test('add a wish by hand, then remove it with undo', async ({ page }) => {
    await page.route('https://photon.komoot.io/**', (route) => route.fulfill({ contentType: 'application/json', body: '{"features":[]}' }));
    await resetApp(page, { hash: '#/wishlist' });
    await page.getByTestId('add-wish').click();
    await page.getByRole('button', { name: 'Add it by hand' }).click();
    await page.getByLabel('Hotel name').fill('Desert Palm Cabins');
    await page.getByLabel('City').fill('Al Ain');
    await page.getByRole('button', { name: 'Top of the list' }).click();
    await page.getByTestId('save-wish').click();
    await expect(page.getByText('Added to Next check-ins')).toBeVisible();
    const card = page.locator('[data-wish-id]', { hasText: 'Desert Palm Cabins' });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: /Remove/ }).click();
    await expect(card).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('[data-wish-id]', { hasText: 'Desert Palm Cabins' })).toBeVisible();
  });
});
