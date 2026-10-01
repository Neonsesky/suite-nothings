/**
 * Journey replay (w2-journey, SPEC §10). Named map-* so it runs in the WebGL map projects.
 * The e2e hook (`localStorage['sn:e2e']==='1'`) runs the timeline at 20× and exposes the player.
 */
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resetApp, watchConsole, WRITE_CHECKPOINTS } from './helpers';

type Player = {
  time: number;
  total: number;
  stopIndex: number;
  phase: string;
  playing: boolean;
  schedule: { stopTimes: number[] };
  seek(t: number): void;
  seekStop(i: number): void;
  pause(): void;
  setSpeed(s: number): void;
};
const player = (w: Window) => (w.__sn as { journey?: Player } | undefined)?.journey;

const OUT = 'design/checkpoints/w2-journey';

async function openJourney(page: Page, opts: { reduced?: boolean } = {}) {
  await page.addInitScript(() => localStorage.setItem('sn:e2e', '1'));
  if (opts.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await resetApp(page, { hash: '#/journey' });
  await expect(page.getByTestId('journey-screen')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await page.waitForFunction(() => Boolean(player(window)));
}

async function save(page: Page, testInfo: TestInfo, name: string) {
  if (!WRITE_CHECKPOINTS) return;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}-${testInfo.project.name.replace('map-', '')}.png` });
}

test.describe('journey', () => {
  test('plays start to finish at high speed', async ({ page }, testInfo) => {
    const errors = watchConsole(page);
    await openJourney(page);
    await expect(page.getByRole('heading', { name: 'Our journey' }).last()).toBeVisible();
    await save(page, testInfo, 'start');
    await page.getByTestId('journey-start').click();
    await expect(page.getByTestId('journey-date')).toHaveAttribute('data-date', '19 JUN 2026');
    // The first postcard appears once we land.
    await expect(page.getByTestId('journey-postcard')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('journey-postcard')).toContainText('Stay 1 of 12');
    await page.evaluate(() => player(window)!.pause());
    await save(page, testInfo, 'postcard');
    await page.getByTestId('journey-play').click();
    // At 20× the whole seed replay is ~4–5 s; allow generous slack for software GL.
    await expect(page.getByTestId('journey-screen')).toHaveAttribute('data-phase', 'end', { timeout: 40_000 });
    await expect(page.getByTestId('journey-finale')).toContainText('To be continued…');
    await expect(page.getByTestId('journey-finale')).toContainText('Hotels');
    await expect(page.getByRole('button', { name: 'Share our journey' })).toBeVisible();
    const state = await page.evaluate(() => ({ stop: player(window)!.stopIndex, playing: player(window)!.playing }));
    expect(state.stop).toBe(11);
    expect(state.playing).toBe(false);
    await page.waitForTimeout(1600);
    await save(page, testInfo, 'finale');
    expect(errors).toEqual([]);
  });

  test('scrubbing jumps to the right stop, pause and play work', async ({ page }) => {
    await openJourney(page);
    const times = await page.evaluate(() => player(window)!.schedule.stopTimes);
    const total = await page.evaluate(() => player(window)!.total);
    // Drop the scrubber just after stop 5's arrival (index 4).
    const value = Math.ceil(((times[4] + 0.3) / total) * 1000);
    await page.getByTestId('journey-scrubber').evaluate((el, v) => {
      const input = el as HTMLInputElement;
      input.value = String(v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await expect.poll(() => page.evaluate(() => player(window)!.stopIndex)).toBe(4);
    await expect(page.getByTestId('journey-postcard')).toContainText('Stay 5 of 12');
    await expect(page.getByTestId('journey-date')).toHaveAttribute('data-date', '19 JUL 2026');

    // Play, then pause: time advances only while playing.
    await page.getByTestId('journey-play').click();
    await expect.poll(() => page.evaluate(() => player(window)!.playing)).toBe(true);
    await page.getByRole('button', { name: 'Pause' }).click();
    const t1 = await page.evaluate(() => player(window)!.time);
    await page.waitForTimeout(400);
    const t2 = await page.evaluate(() => player(window)!.time);
    expect(t2).toBeCloseTo(t1, 5);

    // Next / previous stop.
    await page.getByRole('button', { name: 'Next stop' }).click();
    await expect.poll(() => page.evaluate(() => player(window)!.stopIndex)).toBe(5);
    await page.getByRole('button', { name: 'Previous stop' }).click();
    await expect.poll(() => page.evaluate(() => player(window)!.stopIndex)).toBe(4);
    // Keyboard: arrow right steps forward, 3 picks 2×.
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => page.evaluate(() => player(window)!.stopIndex)).toBe(5);
    await page.keyboard.press('3');
    await expect(page.getByTestId('journey-speed')).toHaveText('2×');
  });

  test('tapping a postcard pauses and opens the stay', async ({ page }) => {
    await openJourney(page);
    await page.evaluate(() => player(window)!.seekStop(2));
    const card = page.getByTestId('journey-postcard');
    await expect(card).toContainText('Stay 3 of 12');
    const visitId = await card.getAttribute('data-visit-id');
    await card.click();
    await expect(page).toHaveURL(new RegExp(`#/stay/${visitId}`));
  });

  test('filter: home city only replays Dubai stays', async ({ page }) => {
    await openJourney(page);
    await page.getByTestId('journey-filter').selectOption('home');
    await page.waitForFunction(() => player(window)?.schedule.stopTimes.length === 7);
    await page.evaluate(() => player(window)!.seekStop(0));
    await expect(page.getByTestId('journey-postcard')).toContainText('Stay 1 of 7');
  });

  test('reduced motion crossfades between stops', async ({ page }, testInfo) => {
    await openJourney(page, { reduced: true });
    await expect(page.getByText("We'll crossfade between stops instead of flying.")).toBeVisible();
    await expect(page.getByTestId('journey-screen')).toHaveAttribute('data-reduced', 'true');
    // Mid-move the veil covers the cut; the traveller never flies.
    const veil = await page.evaluate(() => {
      const p = player(window)!;
      const t = p.schedule.stopTimes[1];
      p.seek(t - 0.6); // middle of the 1.2 s crossfade into stop 2
      const v = document.querySelector('[data-testid="journey-screen"] [class*="veil"]') as HTMLElement;
      return Number(v.style.opacity);
    });
    expect(veil).toBeGreaterThan(0.8);
    await page.getByTestId('journey-start').click();
    await expect(page.getByTestId('journey-screen')).toHaveAttribute('data-phase', 'end', { timeout: 40_000 });
    await save(page, testInfo, 'reduced-finale');
  });
});
