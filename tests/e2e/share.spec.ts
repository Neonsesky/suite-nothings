/**
 * Share cards (SPEC §12): the preview sheet from stay detail, and in-page renders of all three
 * cards. With CHECKPOINTS=1 the PNGs land in design/checkpoints/cp3/delight/.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { checkpointTo, resetApp, waitForStays, watchConsole, WRITE_CHECKPOINTS } from './helpers';
/** Shape of `window.__snShare` (src/features/share/index.ts), kept structural so e2e needs no app types. */
type Row = Record<string, unknown>;
interface StayData {
  stay: Row & { hotel: Row; visit: Row & { visit_id: string } };
  total: number;
  photo?: Blob | null;
}
interface ShareHook {
  renderShareCard(kind: 'stay' | 'stats' | 'route', data: unknown): Promise<Blob>;
  stayCardData(visitId: string): Promise<StayData | null>;
  statsCardData(): { stays: StayData['stay'][]; home?: Row };
  routeCardData(): { stays: StayData['stay'][]; home?: Row };
}

const FOLDER = 'cp3/delight';

async function bootDemo(page: Page): Promise<void> {
  await resetApp(page);
  await page.evaluate(() => localStorage.setItem('sn:e2e', '1'));
  await page.reload();
  await waitForStays(page);
}

async function openFirstStay(page: Page): Promise<void> {
  const card = page.locator('[data-visit-id]').first();
  await expect(card).toBeVisible();
  const id = await card.getAttribute('data-visit-id');
  await page.goto(`./#/stay/${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('stay detail → share opens a preview sheet with the rendered card', async ({ page }, testInfo) => {
  const errors = watchConsole(page);
  await bootDemo(page);
  await openFirstStay(page);
  await page.getByRole('button', { name: 'Share this stay' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Share our stay' });
  await expect(sheet).toBeVisible();
  const img = sheet.locator('img[data-share-state], [data-share-state="ready"] img');
  await expect(img).toBeVisible({ timeout: 15_000 });
  const size = await img.evaluate(async (el: HTMLImageElement) => {
    await el.decode();
    return [el.naturalWidth, el.naturalHeight];
  });
  expect(size).toEqual([1080, 1920]);
  await expect(sheet.getByRole('button', { name: 'Save image' })).toBeVisible();
  await expect(sheet.getByText(/^Stay \d+ of \d+: /)).toBeVisible();
  await page.waitForTimeout(500); // let the card settle in
  await checkpointTo(page, testInfo, FOLDER, 'share-preview-sheet');

  // Save image downloads a PNG named after the hotel.
  const download = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Save image' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^suite-nothings-[a-z0-9-]+\.png$/);
  await expect(sheet).toBeHidden();
  expect(errors).toEqual([]);
});

test('renders the stay, stats and route cards as 1080×1920 PNGs', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440' && WRITE_CHECKPOINTS, 'checkpoint PNGs come from one engine');
  const errors = watchConsole(page);
  await bootDemo(page);
  await openFirstStay(page); // loads the share module (and its test hook)
  await page.waitForFunction(() => !!(window as unknown as { __snShare?: unknown }).__snShare);

  const cards = await page.evaluate(async () => {
    const api = (window as unknown as { __snShare: ShareHook }).__snShare;
    const toB64 = async (b: Blob) => {
      const buf = new Uint8Array(await b.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { b64: btoa(s), type: b.type };
    };
    const dims = async (b: Blob) => {
      const bm = await createImageBitmap(b);
      return [bm.width, bm.height];
    };
    const stays = api.statsCardData().stays;
    // Stay 8 (Muscat, the first trip abroad) has a mood, both ratings and a favourite moment.
    const pick = stays[7] ?? stays[0];
    const stay = (await api.stayCardData(pick.visit.visit_id))!;
    // A stress case: very long name, no times, no mood, no photo, unrated.
    const long = {
      ...stay,
      stay: {
        ...stay.stay,
        hotel: { ...stay.stay.hotel, name: 'The Extraordinarily Long Grand Palace Hotel and Residences by the Sea Boulevard', area: null },
        visit: { ...stay.stay.visit, check_in: null, check_out: null, mood: null, rating_nirsh: null, rating_shady: null, favourite_moment: null, nights: 0 },
      },
    };
    // A stay with a "photo" (demo has none): a generated gradient image.
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 1067;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, '#f7b267');
    grad.addColorStop(0.6, '#f4845f');
    grad.addColorStop(1, '#2b2d42');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#fff3b0';
    g.beginPath();
    g.arc(1100, 520, 160, 0, Math.PI * 2);
    g.fill();
    const photo = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));

    const out: Record<string, { b64: string; type: string; dims: number[] }> = {};
    const add = async (name: string, b: Blob) => (out[name] = { ...(await toB64(b)), dims: await dims(b) });
    await add('share-stay', await api.renderShareCard('stay', stay));
    await add('share-stats', await api.renderShareCard('stats', api.statsCardData()));
    await add('share-route', await api.renderShareCard('route', api.routeCardData()));
    await add('share-stay-long-name', await api.renderShareCard('stay', long));
    await add('share-stay-photo', await api.renderShareCard('stay', { ...stay, photo }));
    // Local-only journey (first five stays are all in the UAE).
    await add('share-route-local', await api.renderShareCard('route', { stays: stays.slice(0, 4), home: api.routeCardData().home }));
    return out;
  });

  for (const [name, card] of Object.entries(cards)) {
    expect(card.type, name).toBe('image/png');
    expect(card.dims, name).toEqual([1080, 1920]);
    const body = Buffer.from(card.b64, 'base64');
    if (WRITE_CHECKPOINTS) {
      mkdirSync(`design/checkpoints/${FOLDER}`, { recursive: true });
      writeFileSync(`design/checkpoints/${FOLDER}/${name}.png`, body);
    } else {
      await testInfo.attach(name, { body, contentType: 'image/png' });
    }
  }
  expect(errors).toEqual([]);
});
