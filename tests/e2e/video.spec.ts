import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resetApp } from './helpers';

// Records the signature split-flap animation for the checkpoint folder (desktop only).
test.use({ video: { mode: 'on', size: { width: 720, height: 360 } }, viewport: { width: 720, height: 360 } });

test.describe('split-flap recording', () => {
  test('records flips of the counter and the chapter board', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'one recording is enough');
    await resetApp(page, { hash: '#/gallery' });
    const counter = page.getByTestId('flap-counter');
    const chapter = page.getByTestId('flap-chapter');
    await counter.scrollIntoViewIfNeeded();
    for (let i = 0; i < 3; i++) {
      await counter.getByRole('button', { name: 'Flip the board' }).click();
      await page.waitForTimeout(900);
    }
    for (let i = 0; i < 3; i++) {
      await chapter.getByRole('button', { name: 'Next chapter' }).click();
      await page.waitForTimeout(1300);
    }
    await expect(counter.locator('[data-value="14"]')).toBeVisible();
    const video = page.video();
    await page.close();
    if (video) {
      mkdirSync('design/checkpoints/w0-foundation', { recursive: true });
      await video.saveAs('design/checkpoints/w0-foundation/splitflap.webm');
    }
  });
});
