import { existsSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { resetApp, watchConsole, WRITE_CHECKPOINTS } from './helpers';

async function shot(page: Page, info: TestInfo, folder: string, name: string) {
  if (!WRITE_CHECKPOINTS) return void (await info.attach(name, { body: await page.screenshot(), contentType: 'image/png' }));
  mkdirSync(folder, { recursive: true });
  await page.screenshot({ path: `${folder}/${name}-${info.project.name}.png` });
}

test('first launch: intro → welcome → who → demo → home base → install → home', async ({ page }, info) => {
  const errors = watchConsole(page);
  await resetApp(page, { me: null, intro: true });
  const intro = page.getByTestId('intro');
  await expect(intro).toBeVisible();
  await expect(intro).toBeHidden({ timeout: 4000 });
  await expect(page.getByRole('heading', { name: "Who's checking in?" })).toBeVisible();
  await shot(page, info, 'design/checkpoints/w1-shell/onboarding', '1-who');
  await page.getByRole('button', { name: 'Nirsh' }).click();
  await expect(page.getByRole('heading', { name: 'Connect our stays' })).toBeVisible();
  await shot(page, info, 'design/checkpoints/w1-shell/onboarding', '2-connect');
  await page.getByRole('button', { name: 'Try demo' }).click();
  await expect(page.getByRole('heading', { name: "Where's home base?" })).toBeVisible();
  await expect(page.getByText('Dubai, United Arab Emirates')).toBeVisible();
  await shot(page, info, 'design/checkpoints/w1-shell/onboarding', '3-home');
  await page.getByRole('button', { name: "That's home" }).click();
  await expect(page.getByRole('heading', { name: 'Add us to your home screen' })).toBeVisible();
  await shot(page, info, 'design/checkpoints/w1-shell/onboarding', '4-install');
  await page.getByRole('button', { name: 'Maybe later' }).click();
  await page.getByRole('button', { name: 'Take me in' }).click();
  await expect(page).toHaveURL(/#\/$/);
  expect(await page.evaluate(() => localStorage.getItem('sn:device:introSeen'))).toBe('true');
  expect(errors).toEqual([]);
});

test('later launches get the short intro and never block taps', async ({ page }) => {
  await resetApp(page, { me: 'nirsh' });
  await expect(page.getByTestId('intro')).toBeHidden({ timeout: 1500 });
});

test("Shady's first launch shows the pillow note, and reading it sets read_at", async ({ page }, info) => {
  test.skip(!existsSync('private/letter.md'), 'private letter not present');
  const errors = watchConsole(page);
  await resetApp(page, { me: 'shady' });
  const pillow = page.getByRole('button', { name: /A note on your pillow from Nirsh/ });
  await expect(pillow).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(1200);
  await shot(page, info, 'design/checkpoints/w1-shell/letter', 'pillow');
  await pillow.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Written in Dubai, September 2026')).toBeVisible();
  // The body screenshot is private: never under design/.
  if (WRITE_CHECKPOINTS) {
    mkdirSync('private/checkpoints/letter', { recursive: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `private/checkpoints/letter/open-${info.project.name}.png` });
  }
  await expect
    .poll(() => page.evaluate(() => new Promise<string | null>((res) => {
      const req = indexedDB.open('suite-nothings-demo');
      req.onsuccess = () => {
        const all = req.result.transaction('letters').objectStore('letters').getAll();
        all.onsuccess = () => res((all.result as { read_at: string | null }[])[0]?.read_at ?? null);
      };
    })), { timeout: 30000 })
    .not.toBeNull();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.goto('./#/letters');
  await expect(page.getByText(/From Nirsh · Read/)).toBeVisible();
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.getByRole('button', { name: /A note on your pillow from Nirsh/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Nirsh sees the letters list, a sealed note and can write a future note', async ({ page }, info) => {
  await resetApp(page, { me: 'nirsh', hash: '#/letters' });
  await page.getByRole('button', { name: 'Write a future note' }).first().click();
  await page.getByLabel('Title').fill('For our 25th hotel');
  await page.getByLabel('The note').fill('A test note for the e2e run.');
  await shot(page, info, 'design/checkpoints/w1-shell/letter', 'write-note');
  await page.getByRole('button', { name: 'Seal the note' }).click();
  await expect(page.getByText('Sealed. Opens at 25 hotels')).toBeVisible();
  await shot(page, info, 'design/checkpoints/w1-shell/letter', 'letters-nirsh');
  await page.evaluate(() => localStorage.setItem('sn:device:me', JSON.stringify('shady')));
  await page.reload();
  await page.goto('./#/letters');
  await expect(page.getByText('Opens at 25 hotels')).toBeVisible();
});
