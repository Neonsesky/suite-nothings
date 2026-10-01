/**
 * Release QA (qa-final-2): evidence that isn't already produced by another spec —
 * intro timing against SPEC §14's budget, a visual contact sheet per viewport across every
 * route/state, the card→detail morph, and the price-level glyphs. Screenshots and videos only
 * write to design/checkpoints/qa/ with CHECKPOINTS=1; otherwise they're report attachments.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { resetApp, waitForStays, WRITE_CHECKPOINTS } from './helpers';

const QA = 'design/checkpoints/qa';

async function shot(page: Page, info: TestInfo, folder: string, name: string, opts: { fullPage?: boolean } = {}): Promise<string | null> {
  if (!WRITE_CHECKPOINTS) {
    await info.attach(name, { body: await page.screenshot({ fullPage: opts.fullPage ?? false }), contentType: 'image/png' });
    return null;
  }
  const path = `${folder}/${name}-${info.project.name}.png`;
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: opts.fullPage ?? false });
  return path;
}

/** Stacks screenshots into one tall PNG by loading them as `<img>`s and re-screenshotting —
 * avoids a raw PNG-compositing dependency; the browser already does pixel-perfect layout. */
async function stitchVertical(page: Page, paths: string[], outPath: string) {
  const imgs = paths.map((p) => `<img src="data:image/png;base64,${readFileSync(p).toString('base64')}" style="display:block" />`).join('');
  await page.setContent(`<!doctype html><html><body style="margin:0">${imgs}</body></html>`);
  await page.waitForTimeout(300);
  mkdirSync(dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath, fullPage: true });
}

/** Installs an in-page watcher that times the intro from first-contentful-paint to fully gone.
 * Node-side `expect().toBeVisible/Hidden()` round-trips over the CDP/IPC channel, which dwarfs a
 * sub-second budget with polling latency, so this times it with in-page performance entries
 * instead — same technique SPEC §14's own HARD_CEILING_MS uses (elapsed real time from mount). */
async function watchIntroTiming(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __introTiming: Promise<{ ms: number }> }).__introTiming = new Promise((resolve) => {
      const tick = () => {
        const el = document.querySelector('[data-testid="intro"]');
        const fcp = performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint');
        if (!el && fcp) {
          resolve({ ms: performance.now() - fcp.startTime });
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });
}

test.describe('intro timing', () => {
  test('first launch is fully gone within 2.5s; repeat launch within 400ms + fade', async ({ page }, info) => {
    test.setTimeout(30_000);
    await page.goto('./favicon.svg'); // same-origin static asset; never boots the app
    await page.evaluate(async () => {
      const dbs = (await indexedDB.databases?.()) ?? [];
      await Promise.all(dbs.map((d) => new Promise<void>((resolve) => { if (!d.name) return resolve(); const r = indexedDB.deleteDatabase(d.name); r.onsuccess = r.onerror = r.onblocked = () => resolve(); })));
      localStorage.clear();
      sessionStorage.clear();
    }).catch(() => undefined);
    await watchIntroTiming(page);
    await page.goto('./#/'); // single real navigation: a faithful first-ever-visit paint-to-gone measurement
    const full = await page.evaluate(() => (window as unknown as { __introTiming: Promise<{ ms: number }> }).__introTiming);
    await info.attach('full-launch-ms', { body: String(full.ms), contentType: 'text/plain' });
    expect(full.ms).toBeLessThanOrEqual(2500);

    // Repeat launch: introSeen is now true (set by the full intro finishing above). A same-URL
    // `goto` is a same-document navigation in Chromium (no reload, no new paint entries, and
    // addInitScript wouldn't rerun) — `reload()` forces a real new document.
    await watchIntroTiming(page);
    await page.reload();
    const repeat = await page.evaluate(() => (window as unknown as { __introTiming: Promise<{ ms: number }> }).__introTiming);
    await info.attach('repeat-launch-ms', { body: String(repeat.ms), contentType: 'text/plain' });
    // 400ms play + its own leave/fade (already inside that 400ms budget) + FCP-to-mount slack.
    expect(repeat.ms).toBeLessThanOrEqual(400 + 150);

    // Evidence pass: a fresh full-intro run, screenshotting key moments (overhead is fine here —
    // nothing is timed against this one).
    await resetApp(page, { me: null, intro: true });
    const intro = page.getByTestId('intro');
    await expect(intro).toBeVisible();
    const t2 = Date.now();
    const folder = `${QA}/intro`;
    for (const ms of [0, 100, 300, 600, 900, 1200, 1600, 2000]) {
      const wait = ms - (Date.now() - t2);
      if (wait > 0) await page.waitForTimeout(wait);
      await shot(page, info, folder, `intro-${ms}ms`);
    }
    await expect(intro).toBeHidden();
  });
});

test.describe('visual QA contact sheets', () => {
  test.setTimeout(120_000);

  test('every route/state, one contact sheet per viewport', async ({ page, context }, info) => {
    const shots: string[] = [];
    const record = async (name: string, fullPage = true) => {
      const p = await shot(page, info, `${QA}/screens`, name, { fullPage });
      if (p) shots.push(p);
    };

    // Onboarding (fresh device).
    await resetApp(page, { me: null, intro: false });
    await expect(page.getByRole('heading', { name: "Who's checking in?" })).toBeVisible();
    await record('onboarding-1-who');
    await page.getByRole('button', { name: 'Nirsh' }).click();
    await expect(page.getByRole('heading', { name: 'Connect our stays' })).toBeVisible();
    await record('onboarding-2-connect');
    await page.getByRole('button', { name: 'Try demo' }).click();
    await expect(page.getByRole('heading', { name: "Where's home base?" })).toBeVisible();
    await record('onboarding-3-home-base');
    await page.getByRole('button', { name: "That's home" }).click();
    await expect(page.getByRole('heading', { name: 'Add us to your home screen' })).toBeVisible();
    await record('onboarding-4-install');
    await page.getByRole('button', { name: 'Maybe later' }).click();
    await page.getByRole('button', { name: 'Take me in' }).click();
    await expect(page).toHaveURL(/#\/$/);

    // Core screens.
    await waitForStays(page);
    await record('stays-home');
    const firstVisit = await page.locator('[data-section="our-stays"] a[data-visit-id]').first().getAttribute('data-visit-id');

    await page.goto('./#/map');
    await expect(page.getByRole('heading', { name: 'Our map' })).toBeAttached();
    await page.waitForTimeout(500);
    await record('map');

    await page.goto(`./#/stay/${firstVisit}`);
    await expect(page.locator(`[data-stay-header="${firstVisit}"]`)).toBeVisible();
    await record('stay-detail');

    await page.goto('./#/journey');
    await expect(page.getByRole('heading', { name: 'Our journey' })).toBeAttached();
    await page.waitForTimeout(800);
    await record('journey');

    await page.goto('./#/us');
    await expect(page.getByRole('heading', { name: 'Us', level: 1 })).toBeVisible();
    await record('us');

    await page.goto('./#/letters');
    await expect(page.getByRole('heading', { name: 'A note on your pillow' })).toBeVisible();
    await record('letters-closed');

    await page.goto('./#/wishlist');
    await expect(page.getByRole('heading', { name: 'Next check-ins', level: 1 })).toBeVisible();
    await record('wishlist');

    await page.goto('./#/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await record('settings');

    // Add-a-stay, every step (fixture-free: manual pin, so no network fixtures needed).
    await page.goto('./#/add');
    const addSheet = page.getByRole('dialog', { name: 'Add a stay' });
    await expect(addSheet).toBeVisible();
    await record('add-1-hotel', false);
    await page.getByRole('button', { name: 'Add it by hand' }).click();
    await expect(page.getByTestId('manual-hotel')).toBeVisible();
    await record('add-1-hotel-manual', false);

    // Offline banner.
    await context.setOffline(true);
    await page.goto('./#/');
    await waitForStays(page);
    await expect(page.getByText(/You're offline/)).toBeVisible();
    await record('offline-banner');
    await context.setOffline(false);

    // Error boundary (QA-only crash probe, e2e-flag gated; see Shell.tsx CrashProbe).
    await page.evaluate(() => localStorage.setItem('sn:e2e', '1'));
    await page.goto('./#/us?__crash=1');
    await expect(page.getByRole('alert')).toBeVisible();
    await record('error-boundary');
    await page.evaluate(() => localStorage.setItem('sn:e2e', '0'));

    // Empty state: clear demo data.
    await page.goto('./#/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear demo data' }).click();
    const confirm = page.getByRole('dialog', { name: 'Clear demo data?' });
    await confirm.getByRole('button', { name: 'Clear' }).click();
    await expect(confirm).toBeHidden();
    await page.goto('./#/');
    await expect(page.getByRole('heading', { name: 'Our first check-in is waiting' })).toBeVisible();
    await record('stays-empty');

    if (WRITE_CHECKPOINTS && shots.length) {
      await stitchVertical(page, shots, `${QA}/contact-sheet-${info.project.name}.png`);
    }
  });
});

test.describe('card to detail morph', () => {
  test('records the shared-element transition and key frames', async ({ page }, info) => {
    test.skip(info.project.name !== 'iphone-390', 'one representative recording is enough');
    await resetApp(page);
    await waitForStays(page);
    const card = page.locator('[data-section="our-stays"] a[data-visit-id]').first();
    await expect(card).toBeVisible();
    const folder = `${QA}/morph`;
    await shot(page, info, folder, 'morph-0-card');
    await card.click();
    for (const ms of [40, 100, 160, 250]) {
      await page.waitForTimeout(ms === 40 ? 40 : 60);
      await shot(page, info, folder, `morph-${ms}ms`);
    }
    await expect(page.locator('[data-stay-header]')).toBeVisible();
    await page.waitForTimeout(400); // let the native View Transition's cross-fade fully settle
    await shot(page, info, folder, 'morph-done-detail');
  });
});

test.describe('price level', () => {
  test('renders filled vs empty ¤ glyphs with an accessible label, no tofu', async ({ page }, info) => {
    test.skip(info.project.name !== 'iphone-390', 'one viewport is enough for a glyph check');
    await resetApp(page);
    await waitForStays(page);
    // golden-tulip: price_level 2 of 4 (seed.ts) — a visible filled/empty contrast case.
    await page.goto('./#/');
    const card = page.getByText('Golden Tulip Al Barsha').first();
    await expect(card).toBeVisible();
    await card.click();
    const group = page.getByRole('radiogroup', { name: 'Price level' });
    const filled = page.getByRole('radio', { name: 'Price level 1 of 4' });
    const empty = page.getByRole('radio', { name: 'Price level 3 of 4' });
    await expect(filled).toBeVisible();
    await group.scrollIntoViewIfNeeded();
    if (WRITE_CHECKPOINTS) {
      mkdirSync(`${QA}/price-level`, { recursive: true });
      await group.screenshot({ path: `${QA}/price-level/price-level-golden-tulip-${info.project.name}.png` });
    } else {
      await info.attach('price-level-golden-tulip', { body: await group.screenshot(), contentType: 'image/png' });
    }
    expect(await filled.getAttribute('data-on')).toBe('true');
    expect(await empty.getAttribute('data-on')).toBeNull();
  });
});
