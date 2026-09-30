import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { resetApp, watchConsole, WRITE_CHECKPOINTS } from './helpers';

/**
 * Add a stay (SPEC §8.3). Photon is routed to fixture JSON so every run is deterministic.
 * The acceptance bar: a stay in under 30 s on a phone, and a revisit in one tap.
 */

const photonSearch = readFileSync('tests/fixtures/photon/search-marina.json', 'utf8');
const photonNearby = readFileSync('tests/fixtures/photon/nearby-jbr.json', 'utf8');
const PHOTO = 'tests/fixtures/images/exif-64x48.jpg';

async function routePhoton(page: Page) {
  await page.route('https://photon.komoot.io/**', (route) => {
    const url = route.request().url();
    return route.fulfill({ contentType: 'application/json', body: url.includes('/reverse') ? photonNearby : photonSearch });
  });
}

/** Committed evidence under design/checkpoints/w1-add-stay/ with CHECKPOINTS=1; a report attachment otherwise. */
async function shot(page: Page, testInfo: TestInfo, name: string) {
  if (!WRITE_CHECKPOINTS) {
    await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
    return;
  }
  const path = `design/checkpoints/w1-add-stay/${name}-${testInfo.project.name}.png`;
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path });
}

const sheet = (page: Page) => page.getByRole('dialog', { name: /Add a stay|Edit our stay/ });
const next = (page: Page) => page.getByTestId('step-next');
const stepCount = (page: Page) => page.getByTestId('step-count');

async function openAdd(page: Page, hash = '#/add') {
  await resetApp(page, { hash });
  await expect(sheet(page)).toBeVisible();
  await expect(stepCount(page)).toBeVisible();
}

async function skipCelebration(page: Page) {
  const c = page.getByTestId('celebration');
  await expect(c).toBeVisible();
  await c.click();
  await expect(c).toBeHidden();
}

test.describe('add a stay', () => {
  test.beforeEach(async ({ page }) => {
    await routePhoton(page);
  });

  test('new stay through Photon search, every step, then celebration', async ({ page }, testInfo) => {
    const errors = watchConsole(page);
    await openAdd(page);
    await shot(page, testInfo, '1-hotel');
    await page.getByRole('combobox', { name: 'Search hotels or areas' }).fill('marina');
    const result = page.getByRole('option', { name: /Marina Lanterns Hotel/ });
    await expect(result).toBeVisible();
    await shot(page, testInfo, '1-hotel-search');
    await result.click();
    await expect(stepCount(page)).toHaveText('2/5');
    await page.getByRole('button', { name: '14:00' }).first().click();
    await page.getByRole('button', { name: '18:00' }).click();
    await expect(page.getByTestId('time-preview')).toContainText('14:00 → 18:00 · 4 h');
    await shot(page, testInfo, '2-when');
    await next(page).click();
    await expect(stepCount(page)).toHaveText('3/5');
    await page.getByRole('button', { name: 'Pool day' }).click();
    await page.getByRole('button', { name: 'Direct' }).click();
    await shot(page, testInfo, '3-what');
    await next(page).click();
    await expect(stepCount(page)).toHaveText('4/5');
    await page.getByTestId('photo-input').setInputFiles(PHOTO);
    await expect(page.getByTestId('photo-cell')).toHaveCount(1);
    await expect(page.getByTestId('exif-suggestion')).toContainText('These photos say 12 Jul 2026');
    await shot(page, testInfo, '4-photos');
    await page.getByRole('button', { name: 'Keep what I entered' }).click();
    await next(page).click();
    await expect(stepCount(page)).toHaveText('5/5');
    await page.getByLabel('Note').fill('Sunset swim, then the lanterns came on');
    await page.getByRole('button', { name: 'Giggly' }).click();
    await page.getByRole('radio', { name: '5 of 5' }).click();
    await page.getByRole('button', { name: 'Both of us' }).click();
    await shot(page, testInfo, '5-good-part');
    await page.getByTestId('save-stay').click();
    await expect(page.getByTestId('celebration')).toBeVisible();
    await page.waitForTimeout(900);
    await shot(page, testInfo, '6-celebration');
    await expect(page.getByTestId('celebration')).toBeHidden({ timeout: 5000 });
    await expect(page.getByText('Stay saved')).toBeVisible();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByText('Marina Lanterns Hotel').first()).toBeAttached();
    expect(errors).toEqual([]);
  });

  test('one-tap revisit with a photo takes under 30 seconds', async ({ page }, testInfo) => {
    await resetApp(page, { hash: '#/' });
    // A person taps at roughly this pace; the stopwatch includes it.
    const human = () => page.waitForTimeout(700);
    const started = Date.now();
    await page.getByRole('link', { name: 'Add a stay' }).locator('visible=true').first().click();
    await expect(sheet(page)).toBeVisible();
    await human();
    const first = page.getByRole('option').first();
    const name = (await first.textContent())?.trim() ?? '';
    await first.click(); // the one tap
    await expect(stepCount(page)).toHaveText('2/5');
    await human();
    await next(page).click();
    await human();
    await next(page).click();
    await human();
    await page.getByTestId('photo-input').setInputFiles(PHOTO);
    await expect(page.getByTestId('photo-cell')).toHaveCount(1);
    await human();
    await next(page).click();
    await human();
    await page.getByRole('radio', { name: '4 of 5' }).click();
    await human();
    await page.getByTestId('save-stay').click();
    await skipCelebration(page);
    await expect(page.getByText('Stay saved')).toBeVisible();
    const seconds = (Date.now() - started) / 1000;
    await testInfo.attach('revisit-seconds', { body: `${seconds.toFixed(1)} s for a revisit at ${name}`, contentType: 'text/plain' });
    expect(seconds).toBeLessThan(30);
  });

  test('offline save says it will sync', async ({ page, context }) => {
    await openAdd(page);
    await page.getByRole('option').first().click();
    await context.setOffline(true);
    for (let i = 0; i < 3; i++) await next(page).click();
    await page.getByTestId('save-stay').click();
    await skipCelebration(page);
    await expect(page.getByText('Saved on this phone, will sync')).toBeVisible();
    await context.setOffline(false);
  });

  test('offline search falls back to adding by hand with a pin', async ({ page, context }, testInfo) => {
    await openAdd(page);
    await context.setOffline(true);
    await page.getByRole('combobox', { name: 'Search hotels or areas' }).fill('Lantern Nest');
    await expect(page.getByText('Offline. Add it by hand.')).toBeVisible();
    await page.getByRole('button', { name: 'Add it by hand' }).first().click();
    const manual = page.getByTestId('manual-hotel');
    await expect(manual).toBeVisible();
    await expect(page.getByLabel('Hotel name')).toHaveValue('Lantern Nest');
    await page.getByLabel('Area').fill('Al Barsha');
    await shot(page, testInfo, '1-hotel-manual');
    await manual.getByRole('button', { name: 'Use this hotel' }).click();
    await expect(stepCount(page)).toHaveText('2/5');
    for (let i = 0; i < 3; i++) await next(page).click();
    await page.getByTestId('save-stay').click();
    await skipCelebration(page);
    await expect(page.getByText('Lantern Nest').first()).toBeAttached();
    await context.setOffline(false);
  });

  test('"We\'re here now" lists nearby hotels, nearest first', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 25.0785, longitude: 55.1347 });
    await openAdd(page, '#/add?here=1');
    const options = page.getByRole('option');
    await expect(options.first()).toContainText('JBR Sands Hotel');
    await expect(options.first()).toContainText(/\d+ m|km/);
  });

  test('reduced motion gets the calm celebration', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openAdd(page);
    await page.getByRole('option').first().click();
    for (let i = 0; i < 3; i++) await next(page).click();
    await page.getByTestId('save-stay').click();
    const c = page.getByTestId('celebration');
    await expect(c).toHaveAttribute('data-phase', 'locked');
    await expect(c).toBeHidden({ timeout: 4000 });
    await expect(page.getByText('Stay saved')).toBeVisible();
  });

  test('a draft survives a reload', async ({ page }) => {
    await openAdd(page);
    await page.getByRole('option').first().click();
    await next(page).click();
    await page.getByRole('button', { name: 'Spa' }).click();
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByTestId('resume-draft')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(stepCount(page)).toHaveText('3/5');
    await expect(page.getByRole('button', { name: 'Spa' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('closing with changes asks before discarding', async ({ page }) => {
    await openAdd(page);
    await page.getByRole('option').first().click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog', { name: 'Discard this stay?' })).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(stepCount(page)).toHaveText('2/5');
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(sheet(page)).toBeHidden();
  });

  test('edit mode prefills the stay and saves changes', async ({ page }) => {
    await resetApp(page, { hash: '#/' });
    const card = page.locator('[data-visit-id]').first();
    const visitId = await card.getAttribute('data-visit-id');
    await page.goto(`./#/add?edit=${visitId}`);
    await expect(page.getByRole('dialog', { name: 'Edit our stay' })).toBeVisible();
    await expect(page.getByTestId('picked-hotel')).toBeVisible();
    await page.getByRole('button', { name: /The good part, step 5/ }).click();
    await page.getByLabel('Favourite moment').fill('Room service at midnight');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Stay saved')).toBeVisible();
    await expect(page).not.toHaveURL(/#\/add/);
    await page.goto(`./#/add?edit=${visitId}`);
    await page.getByRole('button', { name: /The good part, step 5/ }).click();
    await expect(page.getByLabel('Favourite moment')).toHaveValue('Room service at midnight');
  });

  test('opening add over a stay detail keeps the stay behind it', async ({ page }) => {
    await resetApp(page, { hash: '#/' });
    const visitId = await page.locator('[data-visit-id]').first().getAttribute('data-visit-id');
    await page.goto(`./#/stay/${visitId}`);
    const heading = page.locator('main').getByRole('heading').first();
    await expect(heading).toBeVisible();
    const before = await heading.innerText();
    await page.evaluate(() => (location.hash = '#/add'));
    await expect(sheet(page)).toBeVisible();
    await expect(page.getByText(/can.t find that stay/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(sheet(page)).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`#/stay/${visitId}$`));
    await expect(page.locator('main').getByRole('heading').first()).toHaveText(before);
  });
});
