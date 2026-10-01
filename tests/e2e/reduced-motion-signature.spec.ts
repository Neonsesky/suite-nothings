/**
 * Release QA: confirm every signature animation (intro, milestone unlock, journey replay,
 * split-flap) degrades to a calm, non-full-motion treatment under `prefers-reduced-motion:
 * reduce`, with one screenshot per animation saved as committed evidence.
 *
 * This is a spot-check layered on top of the per-feature reduced-motion assertions that already
 * exist (components.spec.ts for split-flap, milestones.spec.ts for the unlock, map-journey-
 * checkpoint.spec.ts for the journey crossfade) — it just also captures the screenshot set the
 * release QA pass asks for in one place.
 *
 * The journey-replay check lives in map-reduced-motion.spec.ts instead of here: it needs WebGL,
 * which only the map-* Playwright projects launch with a software GL renderer (see
 * playwright.config.ts's MAP_GL/MAP_SPECS) — headless iphone-390/desktop-1440 have no GPU, so
 * the map/journey engine never initialises there and `window.__sn.journey` stays undefined.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { resetApp, watchConsole } from './helpers';

const DIR = 'design/checkpoints/final/reduced-motion';
function shot(page: Page, name: string) {
  mkdirSync(DIR, { recursive: true });
  return page.screenshot({ path: `${DIR}/${name}.png` });
}

test.describe('reduced motion: signature animations', () => {
  test.use({ reducedMotion: 'reduce' });

  test('intro skips the 3D door and settles in the "still" variant', async ({ page }) => {
    const errors = watchConsole(page);
    await resetApp(page, { me: null, intro: true });
    const intro = page.locator('[data-kind]').first();
    await expect(intro).toHaveAttribute('data-kind', 'still');
    await shot(page, 'intro-still');
    expect(errors).toEqual([]);
  });

  test('milestone unlock is a calm fade with no specks', async ({ page }) => {
    const photonSearch = readFileSync('tests/fixtures/photon/search-marina.json', 'utf8');
    await page.route('https://photon.komoot.io/**', (route) => route.fulfill({ contentType: 'application/json', body: photonSearch }));
    await resetApp(page, { hash: '#/settings' });
    await page.getByRole('button', { name: 'Clear demo data' }).click();
    await page.getByRole('dialog', { name: 'Clear demo data?' }).getByRole('button', { name: 'Clear' }).click();
    await page.goto('./#/add');
    await page.getByRole('combobox', { name: 'Search hotels or areas' }).fill('marina');
    await page.getByRole('option', { name: /Marina Lanterns Hotel/ }).click();
    for (let i = 0; i < 3; i++) await page.getByTestId('step-next').click();
    await page.getByTestId('save-stay').click();
    await page.getByTestId('celebration').click();
    const unlock = page.getByTestId('milestone-unlock');
    await expect(unlock).toBeVisible();
    await expect(unlock).toHaveAttribute('data-reduced', 'true');
    await expect(unlock.locator('[class*="speck"]')).toHaveCount(0);
    await shot(page, 'milestone-unlock-reduced');
  });

  test('split-flap counter changes value instantly, no flip', async ({ page }) => {
    await resetApp(page, { hash: '#/gallery' });
    const board = page.getByTestId('flap-counter');
    await board.getByRole('button', { name: 'Flip the board' }).click();
    await expect(board.locator('[data-value="12"]')).toBeVisible();
    await expect(board.locator('[data-flipping="true"]')).toHaveCount(0);
    await shot(page, 'split-flap-reduced');
  });
});
