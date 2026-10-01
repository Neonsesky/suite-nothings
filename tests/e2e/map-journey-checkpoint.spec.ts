/**
 * Checkpoint 3 evidence for the journey (w2-journey, SPEC §10/§19), only with `CHECKPOINTS=1`:
 * a deterministic key-frame strip (opening flip, glide, hop, flight, postcard, finale) taken by
 * seeking the paused player to exact moments, plus a short real-time video so the motion itself
 * — not just still frames — gets reviewed. There's no `ffmpeg` in this environment to extract
 * frames from a recording, so the frames are captured directly through Playwright instead; the
 * video is recorded at the player's own 2× speed (not the 20× e2e test-scale) to keep the file
 * small while the motion stays fully tweened, not jump-cut.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, renameSync, statSync } from 'node:fs';
import { resetApp, WRITE_CHECKPOINTS } from './helpers';

type LegStyle = 'glide' | 'hop' | 'flight';
type Player = {
  phase: string;
  total: number;
  schedule: { segments: { kind: string; start: number; duration: number; legIndex?: number }[]; stopTimes: number[] };
  plan: { legs: { style: LegStyle; duration: number }[] };
  seek(t: number): void;
  seekStop(i: number): void;
  pause(): void;
  play(): void;
  setSpeed(s: number): void;
};
type Sn = { journey?: Player };

const OUT = 'design/checkpoints/cp3/journey';

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem('sn:e2e', '1'));
  await resetApp(page, { hash: '#/journey' });
  await expect(page.locator('[data-testid="journey-screen"][data-status="ready"]')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __sn?: Sn }).__sn?.journey));
}

/** The midpoint time of the first leg with the given style, or null if the seed has none. */
async function midOfLeg(page: Page, style: LegStyle): Promise<number | null> {
  return page.evaluate((s) => {
    const p = (window as unknown as { __sn: Sn }).__sn.journey!;
    const i = p.plan.legs.findIndex((l) => l.style === s);
    if (i < 0) return null;
    const seg = p.schedule.segments.find((x) => x.kind === 'leg' && x.legIndex === i)!;
    return seg.start + seg.duration / 2;
  }, style);
}

test.describe('journey checkpoint 3', () => {
  test.skip(!WRITE_CHECKPOINTS, 'writes committed evidence only with CHECKPOINTS=1');
  test.setTimeout(120_000);

  test('key frames: opening, glide, hop, flight, postcard, finale', async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await open(page);
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${name}.png`, scale: 'css' });

    // 1. Before anything plays: the opening date, title and "Play our journey".
    await shot('01-start-card');

    await page.getByTestId('journey-start').click();
    await page.waitForFunction(() => (window as unknown as { __sn: Sn }).__sn.journey!.phase !== 'ready');
    await page.evaluate(() => (window as unknown as { __sn: Sn }).__sn.journey!.pause());

    // 2. Mid-flap, early in the opening flight toward the first stay.
    await page.evaluate(() => (window as unknown as { __sn: Sn }).__sn.journey!.seek(1.2));
    await page.waitForTimeout(150);
    await shot('02-opening-flip');

    // 3. The first stop's postcard and split-flap date.
    await page.evaluate(() => (window as unknown as { __sn: Sn }).__sn.journey!.seekStop(0));
    await page.waitForTimeout(900); // let the split-flap riffle settle
    await shot('03-postcard-stop1');

    // 4–6. One leg of each style, at its midpoint.
    for (const [i, style] of (['glide', 'hop', 'flight'] as const).entries()) {
      const t = await midOfLeg(page, style);
      if (t == null) continue;
      await page.evaluate((tt) => (window as unknown as { __sn: Sn }).__sn.journey!.seek(tt), t);
      await page.waitForTimeout(900); // let the split-flap settle after the (possibly large) date jump
      await shot(`0${4 + i}-${style}`);
    }

    // A later postcard, further into the route.
    const stops = await page.evaluate(() => (window as unknown as { __sn: Sn }).__sn.journey!.schedule.stopTimes.length);
    await page.evaluate((i) => (window as unknown as { __sn: Sn }).__sn.journey!.seekStop(i), Math.min(4, stops - 1));
    await page.waitForTimeout(900);
    await shot('07-postcard-later');

    // Reduced motion: a crossfade veil mid-move.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForFunction(() => Boolean((window as unknown as { __sn?: Sn }).__sn?.journey));
    await page.getByTestId('journey-start').click();
    await page.waitForFunction(() => (window as unknown as { __sn: Sn }).__sn.journey!.phase !== 'ready');
    await page.evaluate(() => (window as unknown as { __sn: Sn }).__sn.journey!.pause());
    const stopTimes = await page.evaluate(() => (window as unknown as { __sn: Sn }).__sn.journey!.schedule.stopTimes);
    await page.evaluate((t) => (window as unknown as { __sn: Sn }).__sn.journey!.seek(t - 0.6), stopTimes[1]);
    await page.waitForTimeout(100);
    await shot('08-reduced-motion-crossfade');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Finale: stats and "To be continued…".
    await page.reload();
    await page.waitForFunction(() => Boolean((window as unknown as { __sn?: Sn }).__sn?.journey));
    await page.getByTestId('journey-start').click();
    await page.waitForFunction(() => (window as unknown as { __sn: Sn }).__sn.journey!.phase !== 'ready');
    await page.evaluate(() => (window as unknown as { __sn: Sn }).__sn.journey!.pause());
    const fin = await page.evaluate(() => {
      const p = (window as unknown as { __sn: Sn }).__sn.journey!;
      return p.schedule.segments.find((s) => s.kind === 'finale')!;
    });
    await page.evaluate((f) => (window as unknown as { __sn: Sn }).__sn.journey!.seek(f.start + f.duration + 1), fin);
    await page.waitForTimeout(2200); // date board riffle + the stats' staggered roll-in
    await shot('09-finale');

    // Share sheet.
    await page.getByRole('button', { name: 'Share our journey' }).click();
    await page.waitForTimeout(300);
    await shot('10-share-sheet');
  });

  test('short real-time video of the replay', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'map-390', 'one recording is enough');
    const context = await browser.newContext({
      ...testInfo.project.use,
      recordVideo: { dir: 'test-results/journey-video', size: { width: 390, height: 844 } },
    });
    const page = await context.newPage();
    await open(page);
    await page.getByTestId('journey-start').click();
    await page.waitForFunction(() => (window as unknown as { __sn: Sn }).__sn.journey!.phase !== 'ready');
    // 2× keeps the file small while every frame is still a real tween, not a jump cut.
    await page.evaluate(() => (window as unknown as { __sn: Sn }).__sn.journey!.setSpeed(2));
    await page.waitForFunction(() => (window as unknown as { __sn: Sn }).__sn.journey!.phase === 'end', { timeout: 60_000 });
    await page.waitForTimeout(2000);
    const video = page.video();
    await context.close();
    if (video) renameSync(await video.path(), `${OUT}/replay-2x-390.webm`);
    const size = statSync(`${OUT}/replay-2x-390.webm`).size;
    await testInfo.attach('video size', { body: `${(size / 1024 / 1024).toFixed(2)} MB` });
    expect(size).toBeLessThan(8 * 1024 * 1024);
  });
});
