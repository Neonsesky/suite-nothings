import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { resetApp, watchConsole } from './helpers';

/**
 * Milestone stamps (SPEC §12): the unlock after a first stay, frame by frame, and the calm
 * reduced-motion version. Frames go to design/checkpoints/cp3/delight/.
 */

const photonSearch = readFileSync('tests/fixtures/photon/search-marina.json', 'utf8');
const DIR = 'design/checkpoints/cp3/delight';

async function routePhoton(page: Page) {
  await page.route('https://photon.komoot.io/**', (route) => route.fulfill({ contentType: 'application/json', body: photonSearch }));
}

/** Settings → Clear demo data, leaving an empty diary. */
async function emptyDiary(page: Page) {
  await resetApp(page, { hash: '#/settings' });
  await page.getByRole('button', { name: 'Clear demo data' }).click();
  const confirm = page.getByRole('dialog', { name: 'Clear demo data?' });
  await confirm.getByRole('button', { name: 'Clear' }).click();
  await expect(confirm).toBeHidden();
}

/** The quickest possible first stay: pick the first Photon result, keep the defaults, save. */
async function addFirstStay(page: Page) {
  await page.goto('./#/add');
  await page.getByRole('combobox', { name: 'Search hotels or areas' }).fill('marina');
  await page.getByRole('option', { name: /Marina Lanterns Hotel/ }).click();
  for (let i = 0; i < 3; i++) await page.getByTestId('step-next').click();
  await page.getByTestId('save-stay').click();
  const c = page.getByTestId('celebration');
  await expect(c).toBeVisible();
  await c.click();
  await expect(c).toBeHidden();
}

/** Pause every running animation at `ms` from its start, so a frame is deterministic. */
async function seek(page: Page, ms: number) {
  await page.evaluate((t) => {
    for (const a of document.getAnimations()) {
      const el = (a.effect as KeyframeEffect | null)?.target as Element | null;
      if (!el?.closest('[data-testid="milestone-unlock"]')) continue;
      a.pause();
      a.currentTime = t;
    }
  }, ms);
}

async function frame(page: Page, testInfo: TestInfo, name: string) {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: `${DIR}/${name}.png` });
  await testInfo.attach(name, { path: `${DIR}/${name}.png`, contentType: 'image/png' });
}

test.describe('milestone unlock', () => {
  test.beforeEach(async ({ page }) => {
    await routePhoton(page);
  });

  test('first stay slams the "First stay" stamp, then never again', async ({ page }, testInfo) => {
    const errors = watchConsole(page);
    await emptyDiary(page);
    await addFirstStay(page);
    const unlock = page.getByTestId('milestone-unlock');
    await expect(unlock).toBeVisible();
    await expect(unlock).toHaveAttribute('data-milestone-id', 'first-stay');
    await expect(page.getByRole('dialog', { name: 'First stay' })).toBeVisible();
    await expect(unlock).toContainText('Every room starts somewhere.');
    await expect(page.getByTestId('milestone-continue')).toBeFocused();

    const mobile = testInfo.project.name === 'iphone-390';
    const desktop = testInfo.project.name === 'desktop-1440';
    if (mobile) {
      for (const [ms, n] of [[40, 1], [200, 2], [300, 3], [420, 4], [650, 5], [1400, 6]] as const) {
        await seek(page, ms);
        await frame(page, testInfo, `milestone-${n}-${ms}ms-390`);
      }
    } else if (desktop) {
      await seek(page, 650);
      await frame(page, testInfo, 'milestone-1440');
    }
    await seek(page, 5000);

    await page.getByTestId('milestone-continue').click();
    await expect(unlock).toBeHidden();

    // Reload: already awarded, so nothing replays.
    await page.reload();
    await expect(page.getByText('Marina Lanterns Hotel').first()).toBeAttached();
    await expect(unlock).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('reduced motion: a calm fade, no specks, dismiss with Escape', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await emptyDiary(page);
    await addFirstStay(page);
    const unlock = page.getByTestId('milestone-unlock');
    await expect(unlock).toBeVisible();
    await expect(unlock).toHaveAttribute('data-reduced', 'true');
    await expect(unlock.locator('[class*="speck"]')).toHaveCount(0);
    if (testInfo.project.name === 'iphone-390') await frame(page, testInfo, 'milestone-reduced-390');
    await page.keyboard.press('Escape');
    await expect(unlock).toBeHidden();
  });

  test('the demo diary is backfilled silently', async ({ page }) => {
    await resetApp(page, { hash: '#/' });
    await expect(page.getByRole('heading', { name: 'Our stays' })).toBeVisible();
    await page.goto('./#/add');
    await page.getByRole('combobox', { name: 'Search hotels or areas' }).fill('marina');
    await page.getByRole('option', { name: /Marina Lanterns Hotel/ }).click();
    for (let i = 0; i < 3; i++) await page.getByTestId('step-next').click();
    await page.getByTestId('save-stay').click();
    const c = page.getByTestId('celebration');
    await c.click();
    await expect(c).toBeHidden();
    await page.waitForTimeout(600);
    const unlock = page.getByTestId('milestone-unlock');
    // Anything shown must be genuinely new (never the seed's first stay or hotel counts).
    if (await unlock.isVisible()) {
      const id = await unlock.getAttribute('data-milestone-id');
      expect(['first-stay', 'hotels-5', 'hotels-10']).not.toContain(id);
    }
  });
});
