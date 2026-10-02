import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { checkpointTo, resetApp, waitForStays, watchConsole, WRITE_CHECKPOINTS } from './helpers';

async function reviewShot(page: Page, info: TestInfo, name: string) {
  if (!WRITE_CHECKPOINTS) return void (await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' }));
  mkdirSync('docs/review/w3-b', { recursive: true });
  await page.screenshot({ path: `docs/review/w3-b/${name}-${info.project.name}.png` });
}

// generateSW emits a fixed `sw.js` filename; bumping its bytes on disk is how we simulate a
// deployed update without a second build, so the real workbox-window "waiting" → onNeedRefresh
// path fires exactly as it would for a real new release.
const SW_PATH = fileURLToPath(new URL('../../dist/sw.js', import.meta.url));

// The SW is blocked globally (playwright.config.ts) so other specs never see stale caches.
// This spec is the one place that needs it.
test.use({ serviceWorkers: 'allow' });

function isChromiumProject(name: string): boolean {
  return name === 'pixel-412' || name === 'desktop-1440';
}

test.describe('PWA manifest', () => {
  test('is linked, valid, and every icon resolves', async ({ page, request }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifestUrl = new URL(href!, page.url()).toString();

    const res = await request.get(manifestUrl);
    expect(res.ok()).toBe(true);
    const manifest = await res.json();

    expect(manifest.name).toBe('Suite Nothings');
    expect(manifest.short_name).toBe('Our Suites');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('portrait');
    expect(manifest.background_color).toBe('#FFF8E9');
    expect(manifest.theme_color).toBe('#FFFFFF');
    expect(manifest.categories).toEqual(expect.arrayContaining(['lifestyle', 'travel']));

    const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose);
    expect(purposes).toEqual(expect.arrayContaining(['any', 'maskable', 'monochrome']));

    expect(manifest.shortcuts).toHaveLength(2);
    const names = manifest.shortcuts.map((s: { name: string }) => s.name);
    expect(names).toEqual(expect.arrayContaining(['Add a stay', 'Map']));
    for (const shortcut of manifest.shortcuts) {
      expect(shortcut.url).toMatch(/#\/(add|map)$/);
    }

    for (const icon of manifest.icons) {
      const iconUrl = new URL(icon.src, manifestUrl).toString();
      const iconRes = await request.get(iconUrl);
      expect(iconRes.ok(), `${iconUrl} should 200`).toBe(true);
      expect(iconRes.headers()['content-type']).toContain('image/png');
    }
  });
});

test.describe('Service worker', () => {
  test('registers and controls the page after a reload', async ({ page }, testInfo) => {
    test.skip(!isChromiumProject(testInfo.project.name), 'WebKit SW registration under Playwright is flaky; Chromium projects cover this.');
    await resetApp(page);
    await waitForStays(page);
    const hasController = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      return navigator.serviceWorker.controller != null;
    });
    if (!hasController) {
      await page.reload();
      await waitForStays(page);
    }
    const controlled = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      return navigator.serviceWorker.controller != null;
    });
    expect(controlled).toBe(true);
  });

  test('the app shell and stays still render offline (IndexedDB), then comes back online', async ({ page, context }, testInfo) => {
    test.skip(!isChromiumProject(testInfo.project.name), 'WebKit SW registration under Playwright is flaky; Chromium projects cover this.');
    const errors = watchConsole(page);
    await resetApp(page);
    await waitForStays(page);
    await expect(page.locator('[data-visit-id]').first()).toBeVisible();

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    if (!(await page.evaluate(() => navigator.serviceWorker.controller != null))) {
      await page.reload();
      await waitForStays(page);
    }

    await context.setOffline(true);
    try {
      await page.reload();
      await waitForStays(page);
      await expect(page.locator('[data-visit-id]').first()).toBeVisible();
    } finally {
      await context.setOffline(false);
    }

    // Offline network noise is expected and not a real bug: failed tile/geocode fetches, and
    // Chromium's benign "cross-world service worker resource mismatch" preload warning (a
    // <link rel=modulepreload> racing the SW's own fetch handler when served from cache).
    const realErrors = errors.filter(
      (e) => !/tiles\.openfreemap\.org|photon\.komoot\.io|ERR_INTERNET_DISCONNECTED|Failed to fetch|cross-world service worker resource mismatch/i.test(e),
    );
    expect(realErrors).toEqual([]);
  });

  test('offers the "fresh version is ready" toast when a new sw.js is deployed', async ({ page }, testInfo) => {
    test.skip(!isChromiumProject(testInfo.project.name), 'WebKit SW registration under Playwright is flaky; Chromium projects cover this.');
    await resetApp(page);
    await waitForStays(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    if (!(await page.evaluate(() => navigator.serviceWorker.controller != null))) {
      await page.reload();
      await waitForStays(page);
    }

    const original = readFileSync(SW_PATH, 'utf8');
    writeFileSync(SW_PATH, `${original}\n// e2e update bump ${Date.now()}\n`);
    try {
      await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      });
      await expect(page.getByText('A fresh version is ready')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    } finally {
      writeFileSync(SW_PATH, original);
    }
  });
});

test.describe('iOS install sheet', () => {
  test('opens via the sn:open-ios-install event and shows the illustrated steps', async ({ page }, testInfo) => {
    await resetApp(page);
    await waitForStays(page);
    await page.evaluate(() => window.dispatchEvent(new Event('sn:open-ios-install')));
    await expect(page.getByRole('dialog', { name: 'Add us to your home screen' })).toBeVisible();
    await expect(page.getByText('Tap Share')).toBeVisible();
    await expect(page.getByText('Tap Add to Home Screen')).toBeVisible();
    await expect(page.getByText('Open Our Suites')).toBeVisible();
    await expect(page.getByText('Look for the square with an arrow, at the bottom of Safari.')).toBeVisible();
    await checkpointTo(page, testInfo, 'w1-shell/pwa', 'ios-install-sheet');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Add us to your home screen' })).toBeHidden();
  });
});

test.describe('"Add to home screen" banner', () => {
  test('"Already done" permanently hides it, even across a reload', async ({ page }, testInfo) => {
    await resetApp(page);
    await waitForStays(page);
    await expect(page.getByTestId('intro')).toBeHidden();
    const heading = page.getByRole('heading', { name: 'Put us on your home screen' });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    await reviewShot(page, testInfo, 'a2hs-banner-shown');
    await page.getByRole('button', { name: 'Already done' }).click();
    await expect(heading).toBeHidden();
    await reviewShot(page, testInfo, 'a2hs-banner-hidden');
    expect(await page.evaluate(() => localStorage.getItem('sn:device:installDismissed'))).toBe('true');
    await page.reload();
    await waitForStays(page);
    await expect(heading).toBeHidden();
  });
});

test.describe('Desktop header over a hero', () => {
  test('is transparent over a tall hero, then solid once scrolled past it', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'The transparent/solid header only renders at desktop widths.');
    await resetApp(page);
    await waitForStays(page);
    // Simulate the Stays screen's hero contract (owned by w1-stays) without depending on its code.
    await page.evaluate(() => {
      document.documentElement.dataset.heroHeader = '1';
      const hero = document.createElement('div');
      hero.dataset.hero = '';
      hero.style.height = '900px';
      hero.style.background = 'linear-gradient(#333, #999)';
      document.body.prepend(hero);
    });
    const header = page.locator('header');
    await expect(header).toHaveCSS('position', 'fixed');
    await expect(header).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await checkpointTo(page, testInfo, 'w1-shell/pwa', 'header-transparent');

    await page.evaluate(() => window.scrollTo(0, 900 * 0.85));
    await expect(header).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await checkpointTo(page, testInfo, 'w1-shell/pwa', 'header-solid');
  });
});

test.describe('Demo badge placement', () => {
  for (const hash of ['#/', '#/map', '#/settings', '#/us']) {
    test(`does not overlap the tab bar or map attribution on ${hash}`, async ({ page }, testInfo) => {
      await resetApp(page, { hash });
      // Both the desktop header and the mobile top bar render a DemoBadge; only one is ever
      // visible at a given viewport (the other is `display:none`).
      const badge = page.getByLabel('Demo mode: sample stays, nothing saved to our Sheet').locator('visible=true');
      await expect(badge).toBeVisible();
      const badgeBox = await badge.boundingBox();
      expect(badgeBox).not.toBeNull();
      const viewport = page.viewportSize();
      if (viewport && badgeBox) {
        // Never in the bottom 15% of the screen (tab bar / map attribution territory).
        expect(badgeBox.y).toBeLessThan(viewport.height * 0.85);
      }
      await checkpointTo(page, testInfo, 'w1-shell/pwa', `badge-${hash.replace(/[^a-z]/gi, '') || 'stays'}`);
    });
  }
});
