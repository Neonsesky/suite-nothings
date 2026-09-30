import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * Runs src/lib/image.ts in a real browser engine. The module is not reachable from the UI yet,
 * so it is imported straight from the Vite dev server (`npm run e2e:dev`); prod runs skip.
 */
test.skip(process.env.E2E_TARGET !== 'dev', 'imports /src modules from the Vite dev server');

const fixture = (name: string) => [...readFileSync(`tests/fixtures/images/${name}`)];

interface Result {
  fullType: string;
  thumbType: string;
  width: number;
  height: number;
  taken_at: string | null;
  full: { width: number; height: number; exifMarker: boolean; lat: number | null; lng: number | null };
  thumb: { width: number; height: number; exifMarker: boolean };
  /** RGB at the centres of the top-left and top-right quadrants of the full output. */
  topLeft: number[];
  topRight: number[];
}

/** Processes `bytes` (or a generated w×h JPEG when bytes is null) in the page. */
function run(page: import('@playwright/test').Page, bytes: number[] | null, gen?: { w: number; h: number }) {
  return page.evaluate(
    async ({ bytes, gen }): Promise<Result> => {
      const base = new URL('.', location.href);
      const image = await import(/* @vite-ignore */ new URL('src/lib/image.ts', base).href);
      const exif = await import(/* @vite-ignore */ new URL('src/lib/exif.ts', base).href);

      let input: Blob;
      if (bytes) {
        input = new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
      } else {
        const c = document.createElement('canvas');
        c.width = gen!.w;
        c.height = gen!.h;
        const g = c.getContext('2d')!;
        g.fillStyle = '#0033cc';
        g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#ee1111';
        g.fillRect(0, 0, c.width / 2, c.height / 2);
        input = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
      }

      const out = await image.photoProcessor(input);

      const hasExifMarker = async (b: Blob) => {
        const u = new Uint8Array(await b.arrayBuffer());
        const sig = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"
        for (let i = 0; i + sig.length <= u.length; i++) if (sig.every((v, j) => u[i + j] === v)) return true;
        return false;
      };
      const pixels = async (b: Blob) => {
        const bmp = await createImageBitmap(b);
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const g = c.getContext('2d')!;
        g.drawImage(bmp, 0, 0);
        const at = (x: number, y: number) => [...g.getImageData(Math.floor(x), Math.floor(y), 1, 1).data.slice(0, 3)];
        const res = { width: bmp.width, height: bmp.height, tl: at(bmp.width / 4, bmp.height / 4), tr: at((bmp.width * 3) / 4, bmp.height / 4) };
        bmp.close();
        return res;
      };

      const full = await pixels(out.full);
      const thumb = await pixels(out.thumb);
      const fullExif = await exif.readExif(out.full);
      return {
        fullType: out.full.type,
        thumbType: out.thumb.type,
        width: out.width,
        height: out.height,
        taken_at: out.taken_at,
        full: { width: full.width, height: full.height, exifMarker: await hasExifMarker(out.full), lat: fullExif.lat, lng: fullExif.lng },
        thumb: { width: thumb.width, height: thumb.height, exifMarker: await hasExifMarker(out.thumb) },
        topLeft: full.tl,
        topRight: full.tr,
      };
    },
    { bytes, gen },
  );
}

const isRed = ([r, g, b]: number[]) => r > 180 && g < 90 && b < 90;
const MIME = /^image\/(webp|jpeg)$/;

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  // First import of exifr on a cold Vite cache triggers a dep re-optimise + full reload, which
  // would kill in-flight Blobs; take that hit here, then start from a settled page.
  await page
    .evaluate(async () => {
      const m = await import(/* @vite-ignore */ new URL('src/lib/exif.ts', new URL('.', location.href)).href);
      await m.readExif(new Blob([new Uint8Array([0xff, 0xd8])]));
    })
    .catch(() => undefined);
  await page.goto('./');
});

test('downscales a large photo to ≤1600 full and ≤480 thumb', async ({ page }) => {
  const r = await run(page, null, { w: 3000, h: 2000 });
  expect(r.fullType).toMatch(MIME);
  expect(r.thumbType).toBe(r.fullType);
  expect({ w: r.width, h: r.height }).toEqual({ w: 1600, h: 1067 });
  expect({ w: r.full.width, h: r.full.height }).toEqual({ w: 1600, h: 1067 });
  expect(Math.max(r.thumb.width, r.thumb.height)).toBe(480);
  expect(r.taken_at).toBeNull();
  expect(isRed(r.topLeft)).toBe(true);
});

test('strips EXIF but keeps the capture time', async ({ page }) => {
  const r = await run(page, fixture('exif-64x48.jpg'));
  expect(r.taken_at).toBe('2026-07-12T15:42:10');
  expect(r.fullType).toMatch(MIME);
  expect({ w: r.width, h: r.height }).toEqual({ w: 64, h: 48 });
  expect(r.full.exifMarker).toBe(false);
  expect(r.thumb.exifMarker).toBe(false);
  expect(r.full.lat).toBeNull();
  expect(r.full.lng).toBeNull();
  expect(isRed(r.topLeft)).toBe(true);
  expect(isRed(r.topRight)).toBe(false);
});

test('applies EXIF Orientation=6 (stored landscape → portrait output)', async ({ page }) => {
  const r = await run(page, fixture('exif-rot6-40x80.jpg'));
  expect({ w: r.width, h: r.height }).toEqual({ w: 40, h: 80 });
  expect(r.full.height).toBeGreaterThan(r.full.width);
  expect(r.thumb.height).toBeGreaterThan(r.thumb.width);
  // Rotating 90° clockwise moves the stored red top-left quadrant to the top right.
  expect(isRed(r.topRight)).toBe(true);
  expect(isRed(r.topLeft)).toBe(false);
  expect(r.full.exifMarker).toBe(false);
});

test('handles a JPEG without EXIF', async ({ page }) => {
  const r = await run(page, fixture('no-exif-64x48.jpg'));
  expect(r.taken_at).toBeNull();
  expect({ w: r.width, h: r.height }).toEqual({ w: 64, h: 48 });
  expect(r.fullType).toMatch(MIME);
});
