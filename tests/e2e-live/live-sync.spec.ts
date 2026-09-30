/**
 * Live sync against the mock Apps Script (real Code.gs in a Node harness, with Google's 302 hop).
 * SPEC §19 Phase 2 acceptance: two phones in sync, a hand edit shows up, nothing lost offline.
 */
import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const MOCK = `http://127.0.0.1:${process.env.AUX_PORT ?? 8787}`;
const KEY = 'our-secret-suite';
const API = `${MOCK}/macros/s/MOCK/exec`;
const WRITE = process.env.CHECKPOINTS === '1';

async function admin<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${MOCK}/__admin/${path}`, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
  return (await res.json()) as T;
}
const rows = (sheet: string) => admin<Record<string, unknown>[]>(`rows?sheet=${sheet}`);

async function shot(page: Page, info: TestInfo, name: string) {
  if (!WRITE) return void (await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' }));
  mkdirSync('design/checkpoints/w1-backend', { recursive: true });
  await page.screenshot({ path: `design/checkpoints/w1-backend/${name}.png` });
}

/** A fresh phone that joins through the invite link, as `me`. */
async function phone(browser: Browser, me: 'nirsh' | 'shady', api = API): Promise<{ ctx: BrowserContext; page: Page; errors: string[] }> {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./favicon.svg');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('sn:device:introSeen', 'true');
  });
  await page.goto(`./#/join?${new URLSearchParams({ api, key: KEY, as: me })}`);
  await expect(page.getByTestId('connection-result')).toHaveAttribute('data-outcome', 'connected');
  await expect(page).toHaveURL(/#\/join$/); // the passphrase is gone from the address bar
  await page.getByRole('button', { name: `Join as ${me === 'nirsh' ? 'Nirsh' : 'Shady'}` }).click();
  await expect(page).toHaveURL(/#\/$/);
  return { ctx, page, errors };
}

/** Add a stay through the store (the add-stay sheet belongs to another team). */
async function addStay(page: Page, name: string): Promise<string> {
  return page.evaluate(async (hotelName) => {
    type Store = {
      upsertHotel(h: Record<string, unknown>): Promise<{ hotel_id: string }>;
      upsertVisit(v: Record<string, unknown>): Promise<{ visit_id: string }>;
    };
    const w = window as unknown as { __sn: { store: () => Promise<Store> } };
    const st = await w.__sn.store();
    const h = await st.upsertHotel({ name: hotelName, lat: 25.08, lng: 55.14, city: 'Dubai', country: 'United Arab Emirates', country_code: 'AE' });
    const v = await st.upsertVisit({ hotel_id: h.hotel_id, date: '2026-10-01', visit_type: 'Dayuse', check_in: '14:00', check_out: '20:00' });
    return v.visit_id;
  }, name);
}

const focus = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('focus')));

test.beforeEach(async () => {
  await admin('reset', {});
});

test('two phones: a stay added on Nirsh’s appears on Shady’s with a toast', async ({ browser }, info) => {
  const a = await phone(browser, 'nirsh');
  const b = await phone(browser, 'shady');
  const id = await addStay(a.page, 'Rove Downtown');
  await expect.poll(async () => (await rows('Visits')).some((r) => r.visit_id === id), { timeout: 10_000 }).toBe(true);
  // B finds it on its own 20 s poll: no focus, no reload.
  await expect(b.page.getByText('Nirsh just checked in at Rove Downtown')).toBeVisible({ timeout: 25_000 });
  await expect(b.page.locator(`[data-visit-id="${id}"]`).first()).toBeVisible();
  await shot(b.page, info, 'two-phones-toast-412');
  expect([...a.errors, ...b.errors]).toEqual([]);
  await a.ctx.close();
  await b.ctx.close();
});

test('offline: three stays saved on the phone reach the Sheet exactly once', async ({ browser }, info) => {
  const a = await phone(browser, 'nirsh');
  await a.ctx.setOffline(true);
  await a.page.evaluate(() => window.dispatchEvent(new Event('offline')));
  const ids = [await addStay(a.page, 'Offline One'), await addStay(a.page, 'Offline Two'), await addStay(a.page, 'Offline Three')];
  await expect(a.page.getByText(/You're offline\. \d+ changes are saved on this phone and will sync\./)).toBeVisible();
  await shot(a.page, info, 'offline-banner-412');
  expect((await rows('Visits')).filter((r) => ids.includes(String(r.visit_id)))).toHaveLength(0);
  await a.ctx.setOffline(false);
  await a.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(async () => (await rows('Visits')).filter((r) => ids.includes(String(r.visit_id))).length, { timeout: 20_000 }).toBe(3);
  const stats = await admin<{ writes: { action: string; id: string }[] }>('stats');
  for (const id of ids) expect(stats.writes.filter((w) => w.action === 'upsertVisit' && w.id === id)).toHaveLength(1);
  await expect(a.page.getByText(/You're offline/)).toHaveCount(0);
  await a.ctx.close();
});

test('a hand edit in the Sheet shows up after the next poll', async ({ browser }) => {
  const a = await phone(browser, 'nirsh');
  const id = await addStay(a.page, 'Hand Edit Hotel');
  await expect.poll(async () => (await rows('Visits')).some((r) => r.visit_id === id)).toBe(true);
  const visit = (await rows('Visits')).find((r) => r.visit_id === id)!;
  await admin('edit', { sheet: 'Hotels', id: visit.hotel_id, column: 'name', value: 'Renamed By Hand' });
  await focus(a.page);
  await expect(a.page.getByText('Renamed By Hand').first()).toBeVisible({ timeout: 25_000 });
  await a.ctx.close();
});

test('link change: banner, then pasting the new link flushes the outbox', async ({ browser }, info) => {
  const a = await phone(browser, 'nirsh');
  await admin('deployments', { active: ['NEW'] });
  const id = await addStay(a.page, 'After The Move');
  await focus(a.page);
  await expect(a.page.getByText("Can't reach our Sheet. Paste the new link in Settings.")).toBeVisible({ timeout: 20_000 });
  await shot(a.page, info, 'link-broken-banner-412');
  await a.page.goto('./#/settings');
  await a.page.getByRole('button', { name: 'Change link' }).click();
  await a.page.getByLabel('Apps Script URL').fill(`${MOCK}/macros/s/NEW/exec`);
  await a.page.getByLabel('Passphrase').fill(KEY);
  await a.page.getByRole('button', { name: 'Test connection' }).click();
  await expect(a.page.getByTestId('connection-result')).toHaveAttribute('data-outcome', 'connected');
  await expect.poll(async () => (await rows('Visits')).some((r) => r.visit_id === id), { timeout: 20_000 }).toBe(true);
  await expect(a.page.getByText("Can't reach our Sheet. Paste the new link in Settings.")).toHaveCount(0);
  await a.ctx.close();
});

test('Test connection reports each result plainly', async ({ page }, info) => {
  await page.goto('./favicon.svg');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('sn:device:me', '"nirsh"');
    localStorage.setItem('sn:device:introSeen', 'true');
  });
  await page.goto('./#/settings');
  const url = page.getByLabel('Apps Script URL');
  const pass = page.getByLabel('Passphrase');
  const result = page.getByTestId('connection-result');
  const run = async (u: string, k: string) => {
    await url.fill(u);
    await pass.fill(k);
    await page.getByRole('button', { name: 'Test connection' }).click();
  };
  await run(API, 'not-our-passphrase');
  await expect(result).toHaveText('Wrong passphrase');
  await shot(page, info, 'test-wrong-passphrase-412');
  await run(`${MOCK}/macros/s/RETIRED/exec`, KEY);
  await expect(result).toHaveText("This isn't an Apps Script web app link");
  await run(`http://127.0.0.1:1/macros/s/MOCK/exec`, KEY);
  await expect(result).toHaveText("Can't reach Google right now");
  await run(API, KEY);
  await expect(result).toHaveText(/^Connected: \d+ stays? synced$/);
  await shot(page, info, 'test-connected-412');
  // Now connected: the section shows the link, last sync, Sync now, and the invite QR.
  await expect(page.getByTestId('connection-status')).toBeVisible();
  await page.getByRole('button', { name: 'Show invite QR' }).click();
  await expect(page.getByRole('img', { name: /QR code that connects Shady/ })).toBeVisible();
});

test('settings connection screenshots at three viewports', async ({ browser }, info) => {
  const a = await phone(browser, 'nirsh');
  await a.page.goto('./#/settings');
  await a.page.getByRole('button', { name: 'Show invite QR' }).click();
  await expect(a.page.getByRole('img', { name: /QR code/ })).toBeVisible();
  for (const [w, h] of [[390, 844], [412, 915], [1440, 900]] as const) {
    await a.page.setViewportSize({ width: w, height: h });
    await a.page.getByRole('heading', { name: 'Connection' }).scrollIntoViewIfNeeded();
    await shot(a.page, info, `settings-connection-${w}`);
  }
  const j = await a.ctx.newPage();
  await j.goto(`./#/join?${new URLSearchParams({ api: API, key: KEY, as: 'shady' })}`);
  await expect(j.getByTestId('connection-result')).toHaveAttribute('data-outcome', 'connected');
  await shot(j, info, 'join-412');
  await j.goto(`./#/join?api=nope`);
  await expect(j.getByRole('alert')).toBeVisible();
  await shot(j, info, 'join-invalid-412');
  await a.ctx.close();
});
