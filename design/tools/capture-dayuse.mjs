#!/usr/bin/env node
/**
 * Capture reference screenshots + computed-style snapshots from dayuse.ae
 * for design-token extraction (reference-only, never committed as assets).
 *
 * Output:
 *   design/references/<page>-<width>-fold.png   (viewport-only screenshot)
 *   design/references/<page>-<width>-full.png   (full page screenshot)
 *   design/references/crops/<name>-<width>.png  (element crops, home page)
 *   design/references/computed.json             (getComputedStyle snapshots)
 *
 * Usage: node capture-dayuse.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF_DIR = path.resolve(__dirname, '../references');
const CROPS_DIR = path.join(REF_DIR, 'crops');

const UA_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const UA_MOBILE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const PAGES = {
  home: 'https://www.dayuse.ae/',
  dubai: 'https://www.dayuse.ae/s/united-arab-emirates/dubai',
  hotel: 'https://www.dayuse.ae/hotels/united-arab-emirates/golden-tulip-al-barsha',
};

const VIEWPORTS = [
  {
    name: 'mobile',
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: UA_MOBILE,
  },
  {
    name: 'desktop',
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent: UA_DESKTOP,
  },
];

const COOKIE_SELECTORS = [
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Accept")',
  'button:has-text("Agree")',
  'button:has-text("OK")',
  '#didomi-notice-agree-button',
  '.didomi-continue-without-agreeing',
  '#onetrust-accept-btn-handler',
];

async function dismissCookies(page) {
  for (const sel of COOKIE_SELECTORS) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 })) {
        await el.click({ timeout: 2000 });
        return sel;
      }
    } catch {}
  }
  return null;
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = 400;
    let last = -1;
    for (let i = 0; i < 60; i++) {
      window.scrollTo(0, i * step);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 120));
      if (window.scrollY === last && i > 3) break;
      last = window.scrollY;
    }
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------
// Element finders. Each must be a self-contained function (no outer
// closures) because Playwright serialises it via .toString() for
// page.evaluateHandle(). Discovered via manual DOM inspection against
// the live site (see design/references/NOTES.md for anatomy notes).
// ---------------------------------------------------------------------
const FINDERS = {
  body: () => document.body,
  header: () => document.querySelector('header'),
  headerLogoLink: () => document.querySelector('header a[href="/"]'),
  headerLogoSvg: () => document.querySelector('header a[href="/"] svg'),
  navLink: () => {
    const btns = [...document.querySelectorAll('header button, header a')];
    return (
      btns.find((b) => b.textContent.trim() === 'Destinations') ||
      btns.find((b) => b.textContent.trim().length > 0) ||
      null
    );
  },
  heroContainer: () =>
    document.querySelector('[class*="h-[590px]"]') ||
    document.querySelector('[class*="h-[700px]"]') ||
    null,
  heroHeadline: () => document.querySelector('h1'),
  searchBarButton: () => document.querySelector('[data-test="homePage_SearchBarForm_SearchButton"]'),
  searchBarDateButton: () => {
    const btns = [...document.querySelectorAll('button')];
    return btns.find((b) => b.textContent.trim() === 'Tomorrow') || null;
  },
  searchBarContainer: () => {
    const btn = document.querySelector('[data-test="homePage_SearchBarForm_SearchButton"]');
    return btn ? btn.parentElement : null;
  },
  primaryButton: () => {
    const els = [...document.querySelectorAll('button,a')];
    return (
      els.find((e) => e.textContent.trim() === 'See hotels') ||
      els.find((e) => /gradient-to-bl/.test(e.className)) ||
      null
    );
  },
  hotelCard: () => {
    const badge = [...document.body.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && /^-\d+%$/.test(e.textContent.trim())
    );
    let cur = badge;
    for (let i = 0; i < 10 && cur; i++) {
      cur = cur.parentElement;
      if (cur && cur.parentElement) {
        const sibs = [...cur.parentElement.children].filter((c) => c.className === cur.className);
        if (sibs.length >= 2) return cur;
      }
    }
    return null;
  },
  hotelCardImageWrapper: () => {
    const badge = [...document.body.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && /^-\d+%$/.test(e.textContent.trim())
    );
    let cur = badge,
      card = null;
    for (let i = 0; i < 10 && cur; i++) {
      cur = cur.parentElement;
      if (cur && cur.parentElement) {
        const sibs = [...cur.parentElement.children].filter((c) => c.className === cur.className);
        if (sibs.length >= 2) {
          card = cur;
          break;
        }
      }
    }
    return card ? card.querySelector('img')?.parentElement || null : null;
  },
  hotelCardImage: () => {
    const badge = [...document.body.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && /^-\d+%$/.test(e.textContent.trim())
    );
    let cur = badge,
      card = null;
    for (let i = 0; i < 10 && cur; i++) {
      cur = cur.parentElement;
      if (cur && cur.parentElement) {
        const sibs = [...cur.parentElement.children].filter((c) => c.className === cur.className);
        if (sibs.length >= 2) {
          card = cur;
          break;
        }
      }
    }
    return card ? card.querySelector('img') : null;
  },
  hotelCardName: () => {
    const badge = [...document.body.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && /^-\d+%$/.test(e.textContent.trim())
    );
    let cur = badge,
      card = null;
    for (let i = 0; i < 10 && cur; i++) {
      cur = cur.parentElement;
      if (cur && cur.parentElement) {
        const sibs = [...cur.parentElement.children].filter((c) => c.className === cur.className);
        if (sibs.length >= 2) {
          card = cur;
          break;
        }
      }
    }
    return card ? card.querySelector('p.truncate') : null;
  },
  hotelCardLocation: () => null, // not present on homepage "Our selection" cards
  hotelCardPrice: () => {
    const badge = [...document.body.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && /^-\d+%$/.test(e.textContent.trim())
    );
    let cur = badge,
      card = null;
    for (let i = 0; i < 10 && cur; i++) {
      cur = cur.parentElement;
      if (cur && cur.parentElement) {
        const sibs = [...cur.parentElement.children].filter((c) => c.className === cur.className);
        if (sibs.length >= 2) {
          card = cur;
          break;
        }
      }
    }
    return card ? card.querySelector('p.text-2xl') : null;
  },
  hotelCardStruckPrice: () => {
    const badge = [...document.body.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && /^-\d+%$/.test(e.textContent.trim())
    );
    return badge ? badge.parentElement.querySelector('.line-through') : null;
  },
  hotelCardDiscountBadge: () =>
    [...document.body.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && /^-\d+%$/.test(e.textContent.trim())
    ) || null,
  hotelCardRating: () => {
    const star = document.querySelector('svg use[href*="solid-star"]');
    return star ? star.closest('svg').parentElement : null;
  },
  cityTabActive: () => {
    const btns = [...document.querySelectorAll('button')];
    return btns.find((b) => b.textContent.trim() === 'Dubai') || null;
  },
  cityTabInactive: () => {
    const btns = [...document.querySelectorAll('button')];
    return btns.find((b) => b.textContent.trim() === 'Sharjah') || null;
  },
  cityTabsContainer: () => {
    const btns = [...document.querySelectorAll('button')];
    const dubai = btns.find((b) => b.textContent.trim() === 'Dubai');
    return dubai ? dubai.parentElement : null;
  },
  sectionHeading: () => {
    const h2s = [...document.querySelectorAll('h2')];
    return h2s.find((h) => /title1/.test(h.className)) || h2s[0] || null;
  },
  trustBadgeContainer: () => {
    const fc = [...document.body.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && e.textContent.trim() === 'Free cancellation'
    );
    return fc ? fc.closest('div')?.parentElement?.parentElement || null : null;
  },
  trustBadgeIcon: () => {
    const fc = [...document.body.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && e.textContent.trim() === 'Free cancellation'
    );
    const row = fc ? fc.closest('div')?.parentElement?.parentElement : null;
    return row ? row.querySelector('svg') : null;
  },
  trustBadgeText: () =>
    [...document.body.querySelectorAll('*')].find(
      (e) => e.children.length === 0 && e.textContent.trim() === 'Free cancellation'
    ) || null,
  faqItem: () => {
    const q = [...document.querySelectorAll('h3')].find((e) => /title6/.test(e.className));
    return q ? q.closest('div[class*="py-6"], div[class*="py-8"]') || q.parentElement?.parentElement : null;
  },
  faqQuestion: () => [...document.querySelectorAll('h3')].find((e) => /title6/.test(e.className)) || null,
  faqAnswer: () => {
    const q = [...document.querySelectorAll('h3')].find((e) => /title6/.test(e.className));
    const item = q ? q.closest('div[class*="py-6"], div[class*="py-8"]') : null;
    return item ? item.querySelector('p') : null;
  },
  faqChevron: () => {
    const use = document.querySelector('svg use[href*="chevron-down"]');
    return use ? use.closest('svg') : null;
  },
  appBanner: () => document.querySelector('.inline-grid.grid-cols-3') || null,
  footer: () => document.querySelector('footer'),
  footerLink: () => document.querySelector('footer ul a'),
  footerText: () => document.querySelector('footer p.body3') || document.querySelector('footer p'),
  galleryTitleArea: () => {
    const h1 = document.querySelector('h1');
    let cur = h1;
    for (let i = 0; i < 8 && cur; i++) {
      if (/gallery/i.test(cur.className || '')) return cur;
      cur = cur.parentElement;
    }
    return h1 ? h1.closest('section') || h1.parentElement : null;
  },
};

// Crops to capture on the home page, at both widths.
const HOME_CROPS = [
  'header',
  'searchBarContainer',
  'hotelCard',
  'cityTabsContainer',
  'trustBadgeContainer',
  'faqItem',
  'appBanner',
  'footer',
];

async function getHandle(page, finderFn) {
  try {
    const handle = await page.evaluateHandle(finderFn);
    const el = handle.asElement();
    if (!el) {
      await handle.dispose();
      return null;
    }
    return el;
  } catch {
    return null;
  }
}

async function describeElement(page, handle) {
  if (!handle) return null;
  try {
    const data = await page.evaluate((el) => {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const props = [
        'color',
        'backgroundColor',
        'backgroundImage',
        'fontFamily',
        'fontSize',
        'fontWeight',
        'lineHeight',
        'letterSpacing',
        'textTransform',
        'border',
        'borderRadius',
        'boxShadow',
        'padding',
        'margin',
        'gap',
        'height',
        'width',
        'display',
        'transition',
      ];
      const styles = {};
      for (const p of props) styles[p] = cs[p];
      return {
        tag: el.tagName.toLowerCase(),
        class: typeof el.className === 'string' ? el.className : null,
        textSnippet: (el.textContent || '').trim().slice(0, 60),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        styles,
      };
    }, handle);
    return data;
  } catch (e) {
    return { note: `evaluate failed: ${e.message}` };
  }
}

async function safeCropScreenshot(handle, filePath) {
  if (!handle) return false;
  try {
    const box = await handle.boundingBox();
    if (!box || box.width === 0 || box.height === 0) return false;
    await handle.screenshot({ path: filePath });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(REF_DIR, { recursive: true });
  await mkdir(CROPS_DIR, { recursive: true });

  const browser = await chromium.launch();
  const computed = {};

  for (const [pageName, url] of Object.entries(PAGES)) {
    computed[pageName] = {};

    for (const vp of VIEWPORTS) {
      console.log(`\n=== ${pageName} @ ${vp.name} (${vp.width}x${vp.height}) ===`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
        userAgent: vp.userAgent,
      });
      const page = await context.newPage();

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (e) {
        console.warn(`  goto failed: ${e.message}`);
        await context.close();
        continue;
      }
      await page.waitForTimeout(4000);
      const clicked = await dismissCookies(page);
      if (clicked) console.log(`  dismissed cookie banner via: ${clicked}`);
      await page.waitForTimeout(500);
      await scrollThrough(page);

      const foldPath = path.join(REF_DIR, `${pageName}-${vp.width}-fold.png`);
      const fullPath = path.join(REF_DIR, `${pageName}-${vp.width}-full.png`);
      try {
        await page.screenshot({ path: foldPath });
        console.log(`  saved ${path.basename(foldPath)}`);
      } catch (e) {
        console.warn(`  fold screenshot failed: ${e.message}`);
      }
      try {
        await page.screenshot({ path: fullPath, fullPage: true });
        console.log(`  saved ${path.basename(fullPath)}`);
      } catch (e) {
        console.warn(`  full screenshot failed: ${e.message}`);
      }

      // Crops
      if (pageName === 'home') {
        for (const key of HOME_CROPS) {
          const handle = await getHandle(page, FINDERS[key]);
          const cropPath = path.join(CROPS_DIR, `${key}-${vp.width}.png`);
          const ok = await safeCropScreenshot(handle, cropPath);
          console.log(`  crop ${key}: ${ok ? 'saved' : 'NOT FOUND'}`);
          if (handle) await handle.dispose();
        }
      }
      if (pageName === 'hotel') {
        const handle = await getHandle(page, FINDERS.galleryTitleArea);
        const cropPath = path.join(CROPS_DIR, `hotel-gallery-title-${vp.width}.png`);
        const ok = await safeCropScreenshot(handle, cropPath);
        console.log(`  crop hotel-gallery-title: ${ok ? 'saved' : 'NOT FOUND'}`);
        if (handle) await handle.dispose();
      }

      // Computed styles for every finder, on every page/width (null + note if absent).
      computed[pageName][vp.width] = {};
      for (const [key, finderFn] of Object.entries(FINDERS)) {
        const handle = await getHandle(page, finderFn);
        if (!handle) {
          computed[pageName][vp.width][key] = { found: false, note: 'element not found on this page/width' };
          continue;
        }
        const desc = await describeElement(page, handle);
        computed[pageName][vp.width][key] = { found: true, ...desc };
        await handle.dispose();
      }
      console.log(`  computed styles captured for ${Object.keys(FINDERS).length} elements`);

      await context.close();
    }
  }

  await browser.close();

  const outFile = path.join(REF_DIR, 'computed.json');
  await writeFile(outFile, JSON.stringify(computed, null, 2), 'utf8');
  console.log(`\nWritten ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
