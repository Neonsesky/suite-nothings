/**
 * Release QA: axe-core sweep of the main routes at mobile (390×844) and desktop (1440×900).
 * Fails on any "serious" or "critical" violation; "moderate"/"minor" are logged, not failed,
 * so this stays a release gate rather than a style-nit gate.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { resetApp, waitForStays } from './helpers';

const ROUTES: { name: string; hash: string; ready: (page: Page) => Promise<unknown> }[] = [
  { name: 'home', hash: '#/', ready: (p) => waitForStays(p) },
  { name: 'map', hash: '#/map', ready: (p) => expect(p.getByRole('heading', { name: 'Our map' })).toBeAttached() },
  { name: 'add', hash: '#/add', ready: (p) => expect(p.getByRole('dialog', { name: 'Add a stay' })).toBeVisible() },
  { name: 'journey', hash: '#/journey', ready: (p) => expect(p.getByRole('heading', { name: 'Our journey' })).toBeAttached() },
  { name: 'us', hash: '#/us', ready: (p) => expect(p.getByRole('heading', { name: 'Us', level: 1 })).toBeVisible() },
  { name: 'wishlist', hash: '#/wishlist', ready: (p) => expect(p.getByRole('heading', { name: 'Next check-ins', level: 1 })).toBeVisible() },
  { name: 'letters', hash: '#/letters', ready: (p) => expect(p.getByRole('heading', { name: 'A note on your pillow' })).toBeVisible() },
  { name: 'settings', hash: '#/settings', ready: (p) => expect(p.getByRole('heading', { name: 'Settings' })).toBeVisible() },
];

const SEVERE = new Set(['serious', 'critical']);

for (const route of ROUTES) {
  test(`axe: ${route.name}`, async ({ page }, testInfo) => {
    await resetApp(page, { hash: route.hash });
    await route.ready(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const severe = results.violations.filter((v) => SEVERE.has(v.impact ?? ''));
    if (results.violations.length) {
      testInfo.annotations.push({
        type: 'axe',
        description: results.violations.map((v) => `${v.impact}: ${v.id} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})`).join('; '),
      });
    }
    expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
  });
}

test('map screen offers a list view alongside the 3D globe (no map-only access to stays)', async ({ page }) => {
  await resetApp(page, { hash: '#/map' });
  await expect(page.getByRole('heading', { name: 'Our map' })).toBeAttached();
  // SPEC §9: City → Country → World globe, pins, and a list view so the map isn't the only path to a stay.
  const listToggle = page.getByRole('button', { name: /list/i }).or(page.getByRole('link', { name: /list/i })).or(page.getByRole('tab', { name: /list/i }));
  await expect(listToggle.first()).toBeVisible();
});
