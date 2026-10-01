import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { checkpointTo, resetApp, watchConsole } from './helpers';

/**
 * Hotel info enrichment (SPEC §11): add a hotel, see skeletons, then the filled info; "Refresh
 * info" fetches again; everything renders offline. Every open API is routed to fixtures.
 */

/**
 * Going fully offline mid-session (no service worker, which Playwright blocks by default — see
 * pwa.spec.ts) means a lazy chunk the page hasn't fetched yet can fail to load; that's a known
 * WebKit + Playwright harness quirk (pwa.spec.ts skips WebKit for the same reason), not a bug in
 * the app. Filter that noise; a real bug would still show up as broken content or a stuck UI.
 */
function realErrors(errors: string[]): string[] {
  return errors.filter((e) => !/WebKit encountered an internal error|Unable to preload CSS|Importing a module script failed|Screen error Error: Unable to preload CSS|was preloaded using link preload but not used|ERR_INTERNET_DISCONNECTED|Failed to fetch dynamically imported module|Worker failed to load|Failed to fetch\b/i.test(e));
}

const photonSearch = readFileSync('tests/fixtures/photon/search-marina.json', 'utf8');
const IMAGE = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4c9a0"/><stop offset="1" stop-color="#3a5a78"/></linearGradient></defs><rect width="960" height="540" fill="url(#g)"/><rect x="380" y="140" width="200" height="400" fill="#1f2a36"/></svg>`;

interface Calls {
  overpass: number;
  summary: number;
}

async function routeOpenData(page: Page, summaries: string[]): Promise<Calls> {
  const calls: Calls = { overpass: 0, summary: 0 };
  await page.route('https://photon.komoot.io/**', (route) => route.fulfill({ contentType: 'application/json', body: photonSearch }));
  await page.route('https://overpass-api.de/**', async (route) => {
    calls.overpass++;
    await new Promise((r) => setTimeout(r, 6000)); // long enough to still be running once we navigate to stay detail
    await route.fulfill({
      json: { elements: [{ tags: { tourism: 'hotel', phone: '+971 4 555 0100', swimming_pool: 'yes', internet_access: 'wlan', price_range: '$$$' } }] },
    });
  });
  await page.route('https://www.wikidata.org/**', (route) => {
    const action = new URL(route.request().url()).searchParams.get('action');
    if (action === 'wbsearchentities') return route.fulfill({ json: { search: [{ id: 'Q130000001' }] } });
    return route.fulfill({
      json: {
        entities: {
          Q130000001: {
            id: 'Q130000001',
            labels: { en: { value: 'Marina Lanterns Hotel' } },
            claims: {
              P18: [{ mainsnak: { datavalue: { value: 'Marina Lanterns.jpg' } } }],
              P625: [{ mainsnak: { datavalue: { value: { latitude: 25.0772, longitude: 55.136 } } } }],
            },
            sitelinks: { enwiki: { title: 'Marina Lanterns Hotel' } },
          },
        },
      },
    });
  });
  await page.route('https://en.wikipedia.org/**', (route) => {
    const extract = summaries[Math.min(calls.summary, summaries.length - 1)];
    calls.summary++;
    return route.fulfill({ json: { type: 'standard', extract } });
  });
  await page.route('https://commons.wikimedia.org/**', (route) =>
    route.fulfill({
      json: {
        query: {
          pages: {
            '1': {
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Marina_Lanterns.jpg/960px-Marina_Lanterns.jpg',
                  extmetadata: { Artist: { value: '<a href="#">Dana Example</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } },
                },
              ],
            },
          },
        },
      },
    }),
  );
  await page.route('https://upload.wikimedia.org/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: IMAGE }));
  return calls;
}

const FIRST = 'A waterfront hotel on Al Marsa Street in Dubai Marina, with a pool deck facing the yachts.';
const SECOND = 'A waterfront hotel in Dubai Marina, known for the paper lanterns strung across its pool deck.';

async function addMarinaLanterns(page: Page) {
  await page.goto('./#/add');
  await page.getByRole('combobox', { name: 'Search hotels or areas' }).fill('marina');
  await page.getByRole('option', { name: /Marina Lanterns Hotel/ }).click();
  const next = page.getByTestId('step-next');
  for (const step of ['3/5', '4/5', '5/5']) {
    await next.click();
    await expect(page.getByTestId('step-count')).toHaveText(step);
  }
  await page.getByTestId('save-stay').click();
  const c = page.getByTestId('celebration');
  await expect(c).toBeVisible();
  await c.click();
  await expect(c).toBeHidden();
}

const info = (page: Page) => page.locator('section[aria-labelledby="hotel-info"]');

test('a new hotel shows skeletons, then sourced info; Refresh info fetches again; offline renders', async ({ page, context }, testInfo) => {
  const errors = watchConsole(page);
  await resetApp(page);
  const calls = await routeOpenData(page, [FIRST, SECOND]);
  await addMarinaLanterns(page);

  await page.getByRole('link', { name: /Marina Lanterns Hotel/ }).first().click();
  await expect(page).toHaveURL(/#\/stay\//);
  await info(page).scrollIntoViewIfNeeded();
  await expect(page.getByRole('status', { name: 'Fetching hotel info…' })).toBeVisible();
  await checkpointTo(page, testInfo, 'w2-enrich', '1-skeleton');

  await expect(info(page).getByText(FIRST)).toBeVisible({ timeout: 10_000 });
  await expect(info(page).getByText('From Wikipedia, CC BY-SA 4.0')).toBeVisible();
  await expect(info(page).getByRole('link', { name: 'Dana Example · CC BY-SA 4.0 · Wikimedia Commons' })).toBeVisible();
  await expect(info(page).getByText('+971 4 555 0100')).toBeVisible();
  await expect(info(page).getByRole('radio', { name: 'Price level 3 of 4' })).toHaveAttribute('aria-checked', 'true');
  await expect(info(page).getByRole('listitem').getByText('Pool', { exact: true })).toBeVisible();
  await info(page).scrollIntoViewIfNeeded();
  await checkpointTo(page, testInfo, 'w2-enrich', '2-filled');

  // Setting the price by hand makes it ours.
  await info(page).getByRole('radio', { name: 'Price level 2 of 4' }).click();
  await expect(info(page).getByRole('radio', { name: 'Price level 2 of 4' })).toHaveAttribute('aria-checked', 'true');
  await page.waitForTimeout(500); // let the IndexedDB write land before we reload (see add-stay.spec.ts)

  // Enrich once: reloading never fetches again.
  await page.reload();
  await expect(info(page).getByText(FIRST)).toBeVisible();
  expect(calls.summary).toBe(1);

  // Refresh info replaces what enrichment filled (Overpass stays cached), keeps our price.
  await info(page).getByRole('button', { name: 'Refresh info' }).click();
  await expect(info(page).getByText(SECOND)).toBeVisible({ timeout: 10_000 });
  expect(calls.summary).toBe(2);
  expect(calls.overpass).toBe(1);
  await expect(info(page).getByRole('radio', { name: 'Price level 2 of 4' })).toHaveAttribute('aria-checked', 'true');

  // Offline: everything still renders from the hotel row, no skeleton, no errors. (A hard reload
  // needs the service worker, which Playwright blocks by default — see pwa.spec.ts — so this
  // re-navigates within the already-loaded app instead, which is what staying on the page offline
  // actually looks like.)
  const stayUrl = page.url();
  await context.setOffline(true);
  await page.goto('./#/');
  await page.goto(stayUrl);
  await expect(info(page).getByText(SECOND)).toBeVisible();
  await expect(page.getByRole('status', { name: 'Fetching hotel info…' })).toHaveCount(0);
  await info(page).scrollIntoViewIfNeeded();
  await checkpointTo(page, testInfo, 'w2-enrich', '3-offline');
  await context.setOffline(false);
  expect(realErrors(errors)).toEqual([]);
});

test('a hotel added offline stays pending, then enriches when we are back online', async ({ page, context }) => {
  const errors = watchConsole(page);
  // Open Add while online so its route chunk is already loaded, then lose the network — matching
  // how someone who already has the app open would hit this.
  await resetApp(page, { hash: '#/add' });
  const calls = await routeOpenData(page, [FIRST]);
  await page.waitForTimeout(1500); // let the map engine's background prewarm (unrelated to this feature) settle before we go offline
  await context.setOffline(true);
  // Offline add-stay falls back to "add by hand" (Photon is unreachable), so this hotel has no osm_id.
  await page.getByRole('combobox', { name: 'Search hotels or areas' }).fill('Lantern Hideaway');
  await expect(page.getByText('Offline. Add it by hand.')).toBeVisible();
  await page.getByRole('button', { name: 'Add it by hand' }).first().click();
  await expect(page.getByTestId('manual-hotel')).toBeVisible();
  await page.getByLabel('Area').fill('Dubai Marina');
  await page.getByTestId('manual-hotel').getByRole('button', { name: 'Use this hotel' }).click();
  const next = page.getByTestId('step-next');
  for (const step of ['3/5', '4/5', '5/5']) {
    await next.click();
    await expect(page.getByTestId('step-count')).toHaveText(step);
  }
  await page.getByTestId('save-stay').click();
  const c = page.getByTestId('celebration');
  await expect(c).toBeVisible();
  await c.click();
  await expect(c).toBeHidden();

  await page.getByRole('link', { name: /Lantern Hideaway/ }).first().click();
  await expect(page.getByRole('status', { name: 'Fetching hotel info…' })).toHaveCount(0);
  expect(calls.overpass).toBe(0);

  // Back online: the queue picks up this still-`pending` hotel. Its coordinates (home base,
  // since there was no pin) are nowhere near Marina Lanterns' real entity, so the careful name
  // search finds no confident match — the point is that the run still ends on a final status
  // instead of leaving the skeleton stuck forever (the int-1 bug this orchestrator note calls out).
  await context.setOffline(false);
  await page.waitForTimeout(300); // WebKit needs a beat before a reload sees the network is back
  await page.reload();
  await expect(page.getByRole('status', { name: 'Fetching hotel info…' })).toHaveCount(0, { timeout: 10_000 });
  await expect(info(page).getByText("Couldn't fetch hotel info.")).toHaveCount(0);
  expect(realErrors(errors)).toEqual([]);
});

test('Settings has hotel info toggles, off by default, and the open-data credits', async ({ page }, testInfo) => {
  await resetApp(page, { hash: '#/settings' });
  const card = page.locator('section[aria-labelledby="hotel-info-label"]');
  await expect(card.getByRole('group', { name: 'AI descriptions' }).getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByRole('group', { name: 'Google Places' }).getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
  await card.scrollIntoViewIfNeeded();
  await checkpointTo(page, testInfo, 'w2-enrich', '4-settings');
  await expect(page.getByRole('link', { name: 'Wikipedia' })).toBeVisible();
});
