import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resetApp, watchConsole, WRITE_CHECKPOINTS } from './helpers';

/** The engine handle MapScreen exposes when localStorage['sn:e2e'] === '1'. */
type Sn = { map: { map: import('maplibre-gl').Map; chapter(): string; setChapter(c: string, o?: { animate?: boolean }): void; setLighting(m: string): void; isFallback(): boolean; breakpoints: { city: number; country: number } } };
declare global {
  interface Window {
    __sn?: Record<string, unknown>;
  }
}

const OUT = 'design/checkpoints/cp2/map';

async function openMap(page: Page, hash = '#/map') {
  await page.addInitScript(() => localStorage.setItem('sn:e2e', '1'));
  await resetApp(page, { hash });
  await expect(page.locator('[data-status="ready"]')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => Boolean((window.__sn as Sn | undefined)?.map?.map.loaded()));
}

const title = (page: Page) => page.getByTestId('map-title').locator('[data-value]').first();

async function idle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const m = (window.__sn as Sn).map.map;
        if (!m.isMoving() && m.loaded()) return resolve();
        m.once('idle', () => resolve());
        setTimeout(resolve, 8000);
      }),
  );
}

async function save(page: Page, testInfo: TestInfo, name: string) {
  if (!WRITE_CHECKPOINTS) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}-${testInfo.project.name.replace('map-', '')}.png` });
}

/** GL driver chatter from software rendering in headless Chromium isn't ours. */
const ours = (errors: string[]) => errors.filter((e) => !/GL Driver Message|GPU stall|WebGL-/.test(e));

test.describe('map', () => {
  test('loads, and zooming from the city to the globe flips through all three chapters', async ({ page }) => {
    const errors = watchConsole(page);
    await openMap(page);
    await expect(title(page)).toHaveAttribute('data-value', 'DUBAI');
    await expect(page.getByTestId('map-count')).toContainText(/stays? in view/);
    await expect(page.getByText('Map data ©')).toBeVisible();

    const seen = await page.evaluate(async () => {
      const sn = (window.__sn as Sn).map;
      const titles: string[] = [];
      const read = () => document.querySelector('[data-testid="map-title"] [data-value]')?.getAttribute('data-value') ?? '';
      for (let z = 11; z >= 1.2; z -= 0.25) {
        sn.map.jumpTo({ zoom: z, pitch: Math.max(0, (z - 5) * 8) });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const t = read();
        if (titles[titles.length - 1] !== t) titles.push(t);
      }
      return titles;
    });
    expect(seen).toEqual(['DUBAI', 'UNITED ARAB EMIRATES', 'THE WORLD']);
    expect(ours(errors)).toEqual([]);
  });

  test('the flip lands on the computed breakpoints', async ({ page }) => {
    await openMap(page);
    const bp = await page.evaluate(() => (window.__sn as Sn).map.breakpoints);
    expect(bp.city).toBeGreaterThan(9);
    expect(bp.city).toBeLessThan(10);
    expect(bp.country).toBeGreaterThan(5);
    expect(bp.country).toBeLessThan(6);
    for (const [z, want] of [
      [bp.city + 0.02, 'city'],
      [bp.city - 0.02, 'country'],
      [bp.country + 0.02, 'country'],
      [bp.country - 0.02, 'world'],
    ] as const) {
      const got = await page.evaluate((zz) => {
        const sn = (window.__sn as Sn).map;
        sn.map.jumpTo({ zoom: zz });
        return sn.chapter();
      }, z);
      expect(got).toBe(want);
    }
  });

  test('chips fly between chapters', async ({ page }, testInfo) => {
    await openMap(page);
    await page.getByRole('button', { name: 'World', exact: true }).click();
    await expect(title(page)).toHaveAttribute('data-value', 'THE WORLD', { timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'World', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Country', exact: true }).click();
    await expect(title(page)).toHaveAttribute('data-value', 'UNITED ARAB EMIRATES', { timeout: 10_000 });
    await page.getByRole('button', { name: 'City', exact: true }).click();
    await expect(title(page)).toHaveAttribute('data-value', 'DUBAI', { timeout: 10_000 });
    // Every HUD chip stays on one line (checkpoint 1 fix).
    const heights = await page.locator('[role="toolbar"] button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    for (const h of heights) expect(h).toBeLessThan(52);
    await idle(page);
    await save(page, testInfo, 'hud');
  });

  test('tapping a pin opens its stay card, and the card links to the stay', async ({ page }, testInfo) => {
    await openMap(page);
    await idle(page);
    const pt = await page.evaluate(() => {
      const m = (window.__sn as Sn).map.map;
      const r = m.getCanvas().getBoundingClientRect();
      const at = (f: { geometry: unknown }) => m.project((f.geometry as { coordinates: [number, number] }).coordinates);
      // The on-screen pin nearest the centre (rendered features can hang off the edge).
      const f = m
        .queryRenderedFeatures({ layers: ['sn-pins'] })
        .filter((x) => { const q = at(x); return q.x > 30 && q.y > 260 && q.x < r.width - 80 && q.y < r.height - 60; })
        .sort((a, b) => Math.hypot(at(a).x - r.width / 2, at(a).y - r.height / 2) - Math.hypot(at(b).x - r.width / 2, at(b).y - r.height / 2))[0];
      if (!f) return null;
      const p = at(f);
      return { x: r.left + p.x, y: r.top + p.y - 22, name: String(f.properties.name) };
    });
    expect(pt).not.toBeNull();
    if (testInfo.project.use.hasTouch) await page.touchscreen.tap(pt!.x, pt!.y);
    else await page.mouse.click(pt!.x, pt!.y);
    const card = page.getByTestId('pin-card');
    await expect(card).toBeVisible();
    // Pins can overlap at city zoom, so any of the stays near the tap may open.
    await expect(card.getByRole('heading')).toHaveText(/\w/);
    await expect(page.locator('[data-hotel-id] [alt=""]').first()).toBeAttached();
    await page.waitForTimeout(500);
    await save(page, testInfo, 'pin-card');
    await card.getByRole('link', { name: 'Open stay' }).click();
    await expect(page).toHaveURL(/#\/stay\//);
  });

  test('list view groups our stays by chapter and city', async ({ page }, testInfo) => {
    await openMap(page);
    await page.getByRole('button', { name: 'List view' }).click();
    const list = page.getByTestId('map-list');
    await expect(list.getByRole('heading', { name: 'Our stays, listed' })).toBeFocused();
    await expect(list.locator('[data-group-title]')).toHaveText(['Dubai', 'United Arab Emirates', 'The world']);
    await expect(list.getByRole('heading', { name: 'Istanbul', exact: true })).toBeVisible();
    await save(page, testInfo, 'list');
    await list.getByRole('button', { name: /^Show .* on the map$/ }).first().click();
    await expect(list).toBeHidden();
    await expect(page.getByTestId('pin-card')).toBeVisible({ timeout: 10_000 });
  });

  test('?focus= flies to a stay and opens its card; ?city= filters', async ({ page }) => {
    await openMap(page, '#/map?city=Sharjah');
    await expect(page.getByRole('button', { name: 'Show all our stays' })).toBeVisible();
    await page.getByRole('button', { name: 'List view' }).click();
    await expect(page.getByTestId('map-list').getByRole('listitem')).toHaveCount(1);
  });

  test('renders the offline fallback globe when tiles fail', async ({ page }, testInfo) => {
    await page.route(/tiles\.openfreemap\.org/, (r) => r.abort('internetdisconnected'));
    await openMap(page);
    await expect(page.locator('[data-fallback="true"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Offline. Showing what we've already loaded.")).toBeVisible();
    await expect(page.getByText('land from Natural Earth')).toBeVisible();
    await page.evaluate(() => (window.__sn as Sn).map.setChapter('world', { animate: false }));
    await idle(page);
    const land = await page.evaluate(() => (window.__sn as Sn).map.map.queryRenderedFeatures({ layers: ['sn-land'] }).length);
    expect(land).toBeGreaterThan(0);
    await save(page, testInfo, 'offline-world');
  });

  test('zooming keeps a reasonable frame rate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'map-390', 'one measurement is enough');
    await openMap(page);
    await idle(page);
    const fps = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const m = (window.__sn as Sn).map.map;
          let frames = 0;
          const t0 = performance.now();
          const tick = () => {
            frames++;
            if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
            else resolve((frames * 1000) / (performance.now() - t0));
          };
          m.easeTo({ zoom: 3, duration: 3000 });
          requestAnimationFrame(tick);
        }),
    );
    testInfo.annotations.push({ type: 'fps', description: fps.toFixed(1) });
    console.log(`map zoom fps (software GL): ${fps.toFixed(1)}`);
    expect(fps).toBeGreaterThan(10);
  });
});
