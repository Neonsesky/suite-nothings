#!/usr/bin/env node
/**
 * Screenshot the Suite Nothings prototype (design/prototype/*.html) at mobile and desktop
 * widths, plus the add-sheet and map pin-card interactions, into design/checkpoints/cp1/proto/.
 * Usage: node shoot-prototype.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_DIR = path.resolve(__dirname, '../prototype');
const OUT_DIR = path.resolve(__dirname, '../checkpoints/cp1/proto');

const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

async function shoot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}-fold.png`) });
  await page.screenshot({ path: path.join(OUT_DIR, `${name}-full.png`), fullPage: true });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];

  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.deviceScaleFactor });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`[${vpName}] console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`[${vpName}] pageerror: ${err.message}`));

    // Home
    await page.goto(`file://${PROTO_DIR}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    await shoot(page, `home-${vpName}`);

    // Add sheet — step 1
    await page.click('[data-open-add]');
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(OUT_DIR, `addsheet-step1-${vpName}.png`) });
    // advance to step 5
    for (let i = 0; i < 4; i++) {
      await page.click('#add-sheet [data-next]');
      await page.waitForTimeout(120);
    }
    await page.screenshot({ path: path.join(OUT_DIR, `addsheet-step5-${vpName}.png`) });
    await page.click('#add-sheet [data-close-add]');
    await page.waitForTimeout(150);

    // Stay detail
    await page.goto(`file://${PROTO_DIR}/stay.html?id=rove-downtown-3`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    await shoot(page, `stay-${vpName}`);

    // Map
    await page.goto(`file://${PROTO_DIR}/map.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT_DIR, `map-${vpName}.png`) });
    const pin = await page.$('.map-pin-btn');
    if (pin) {
      await pin.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT_DIR, `map-pincard-${vpName}.png`) });
    }

    await context.close();
  }

  await browser.close();

  if (errors.length) {
    console.log('Console/page errors found:');
    errors.forEach((e) => console.log(' -', e));
  } else {
    console.log('No console errors detected.');
  }
  console.log(`Screenshots written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
