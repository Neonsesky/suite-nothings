import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { checkpoint, isMobile, resetApp, watchConsole } from './helpers';

test.describe('split-flap', () => {
  test('flips only changed cells, then settles on the new value', async ({ page }, testInfo) => {
    const errors = watchConsole(page);
    await resetApp(page, { hash: '#/gallery' });
    const board = page.getByTestId('flap-counter');
    await expect(board.getByText('11 hotels together')).toBeAttached();
    await board.getByRole('button', { name: 'Flip the board' }).click();
    // 11 → 12: only the second cell animates.
    await expect(board.locator('[data-flipping="true"]')).toHaveCount(1);
    const frames = `design/checkpoints/w0-foundation/splitflap-frames-${testInfo.project.name}`;
    if (testInfo.project.name === 'desktop-1440') {
      mkdirSync(frames, { recursive: true });
      for (let i = 0; i < 6; i++) await board.screenshot({ path: `${frames}/frame-${i}.png` });
    }
    await expect(board.locator('[data-flipping="true"]')).toHaveCount(0, { timeout: 3000 });
    await expect(board.getByText('12 hotels together')).toBeAttached();
    await expect(board.locator('[data-value="12"]')).toBeVisible();
    // A long word board flips many cells at once.
    const chapter = page.getByTestId('flap-chapter');
    await chapter.getByRole('button', { name: 'Next chapter' }).click();
    await expect(chapter.locator('[data-flipping="true"]').first()).toBeVisible();
    await expect(chapter.locator('[data-flipping="true"]')).toHaveCount(0, { timeout: 4000 });
    await expect(chapter.getByText('UNITED ARAB EMIRATES')).toBeAttached();
    await checkpoint(page, testInfo, 'gallery', { fullPage: true });
    expect(errors).toEqual([]);
  });

  test('reduced motion changes the value instantly', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await resetApp(page, { hash: '#/gallery' });
    const board = page.getByTestId('flap-counter');
    await board.getByRole('button', { name: 'Flip the board' }).click();
    await expect(board.locator('[data-value="12"]')).toBeVisible();
    await expect(board.locator('[data-flipping="true"]')).toHaveCount(0);
    await context.close();
  });
});

test.describe('bottom sheet', () => {
  test('opens, snaps up by drag, and closes by a downward flick', async ({ page }, testInfo) => {
    test.skip(!isMobile(testInfo), 'drag is mobile only; desktop is a modal');
    const errors = watchConsole(page);
    await resetApp(page, { hash: '#/gallery' });
    await page.getByTestId('open-sheet').click();
    const sheet = page.getByTestId('bottom-sheet');
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(500);
    const vh = page.viewportSize()!.height;
    const top0 = (await sheet.boundingBox())!.y;
    // Opened at the 50% snap.
    expect(Math.abs(top0 - vh * 0.5)).toBeLessThan(30);
    await checkpoint(page, testInfo, 'sheet-half');
    // Drag the handle up slowly → snaps to 90%.
    await page.mouse.move(200, top0 + 10);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(200, top0 + 10 - i * 25);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(600);
    const top1 = (await sheet.boundingBox())!.y;
    expect(Math.abs(top1 - vh * 0.1)).toBeLessThan(30);
    await checkpoint(page, testInfo, 'sheet-full');
    // A fast downward flick from the handle closes it.
    await page.mouse.move(200, top1 + 10);
    await page.mouse.down();
    for (let i = 1; i <= 4; i++) {
      await page.mouse.move(200, top1 + 10 + i * 60);
      await page.waitForTimeout(8);
    }
    await page.mouse.up();
    await expect(sheet).toBeHidden({ timeout: 3000 });
    expect(errors).toEqual([]);
  });

  test('Escape closes the sheet and focus returns', async ({ page }, testInfo) => {
    await resetApp(page, { hash: '#/gallery' });
    const opener = page.getByTestId('open-sheet');
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: "Somewhere we've been" });
    await expect(dialog).toBeVisible();
    if (!isMobile(testInfo)) await checkpoint(page, testInfo, 'sheet-modal');
    // Focus is trapped inside.
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('the add route opens as a sheet over the current screen and closes back', async ({ page }, testInfo) => {
    await resetApp(page);
    await expect(page.getByRole('heading', { name: 'Our stays' })).toBeVisible();
    await page.goto('./#/add');
    const dialog = page.getByRole('dialog', { name: 'Add a stay' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Our stays' })).toBeAttached();
    await checkpoint(page, testInfo, 'add-sheet');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/#\/$/);
  });
});
