/* global document -- the render callback runs inside Chromium */
/**
 * Generates the tiny JPEG fixtures used by tests/unit/exif.test.ts and
 * tests/e2e/image-pipeline.spec.ts. Run: `node tests/fixtures/images/make-fixtures.mjs`.
 *
 * Chromium renders an asymmetric pattern (red top-left quadrant on blue) to a baseline JPEG;
 * a hand-built APP1 Exif segment (little-endian TIFF: IFD0 → Orientation + Exif/GPS pointers,
 * ExifIFD → DateTimeOriginal, GPS IFD → lat/lng as degree/minute/second rationals) is spliced
 * in right after SOI.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const OUT = fileURLToPath(new URL('.', import.meta.url));

export const TAKEN = '2026:07:12 15:42:10';
export const JBR = { lat: 25.0785, lng: 55.1347 };

const TYPE = { BYTE: 1, ASCII: 2, SHORT: 3, LONG: 4, RATIONAL: 5 };
const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 };

/** Degrees → three [numerator, denominator] rationals (d, m, s with 1/100 s precision). */
function dms(deg) {
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = Math.round(((a - d) * 60 - m) * 60 * 100);
  return [[d, 1], [m, 1], [s, 100]];
}

/**
 * Serialises one IFD at `offset` (relative to the TIFF header). Entries: [tag, type, values].
 * ASCII values are strings (NUL added), RATIONAL values are [num, den] pairs. Returns bytes.
 */
function ifd(entries, offset) {
  const sorted = [...entries].sort((a, b) => a[0] - b[0]);
  const headLen = 2 + sorted.length * 12 + 4;
  const head = Buffer.alloc(headLen);
  const extra = [];
  let extraOff = offset + headLen;
  head.writeUInt16LE(sorted.length, 0);
  sorted.forEach(([tag, type, values], i) => {
    let data;
    let count;
    if (type === TYPE.ASCII) {
      data = Buffer.from(`${values}\0`, 'latin1');
      count = data.length;
    } else if (type === TYPE.RATIONAL) {
      count = values.length;
      data = Buffer.alloc(count * 8);
      values.forEach(([n, dd], j) => {
        data.writeUInt32LE(n, j * 8);
        data.writeUInt32LE(dd, j * 8 + 4);
      });
    } else {
      count = values.length;
      data = Buffer.alloc(count * SIZE[type]);
      values.forEach((v, j) => {
        if (type === TYPE.BYTE) data.writeUInt8(v, j);
        else if (type === TYPE.SHORT) data.writeUInt16LE(v, j * 2);
        else data.writeUInt32LE(v, j * 4);
      });
    }
    const p = 2 + i * 12;
    head.writeUInt16LE(tag, p);
    head.writeUInt16LE(type, p + 2);
    head.writeUInt32LE(count, p + 4);
    if (data.length <= 4) {
      data.copy(head, p + 8);
    } else {
      head.writeUInt32LE(extraOff, p + 8);
      if (data.length % 2) data = Buffer.concat([data, Buffer.alloc(1)]);
      extra.push(data);
      extraOff += data.length;
    }
  });
  head.writeUInt32LE(0, headLen - 4); // no next IFD
  return Buffer.concat([head, ...extra]);
}

/** The IFD's byte length is independent of where it lives, so lay out in two passes. */
function tiff({ orientation, taken, gps }) {
  const header = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
  const exifEntries = [[0x9003, TYPE.ASCII, taken]];
  const gpsEntries = [
    [0x0000, TYPE.BYTE, [2, 2, 0, 0]],
    [0x0001, TYPE.ASCII, gps.lat >= 0 ? 'N' : 'S'],
    [0x0002, TYPE.RATIONAL, dms(gps.lat)],
    [0x0003, TYPE.ASCII, gps.lng >= 0 ? 'E' : 'W'],
    [0x0004, TYPE.RATIONAL, dms(gps.lng)],
  ];
  const ifd0Entries = (exifOff, gpsOff) => [
    [0x0112, TYPE.SHORT, [orientation]],
    [0x8769, TYPE.LONG, [exifOff]],
    [0x8825, TYPE.LONG, [gpsOff]],
  ];
  const ifd0Len = ifd(ifd0Entries(0, 0), 8).length;
  const exifOff = 8 + ifd0Len;
  const exifBytes = ifd(exifEntries, exifOff);
  const gpsOff = exifOff + exifBytes.length;
  const gpsBytes = ifd(gpsEntries, gpsOff);
  return Buffer.concat([header, ifd(ifd0Entries(exifOff, gpsOff), 8), exifBytes, gpsBytes]);
}

function app1(meta) {
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff(meta)]);
  const seg = Buffer.alloc(4);
  seg.writeUInt16BE(0xffe1, 0);
  seg.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([seg, body]);
}

function withExif(jpeg, meta) {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('not a JPEG');
  return Buffer.concat([jpeg.subarray(0, 2), app1(meta), jpeg.subarray(2)]);
}

const browser = await chromium.launch();
const page = await browser.newPage();

/** Red top-left quadrant, green top-right, blue bottom half: every rotation/flip is distinguishable. */
async function render(width, height) {
  const url = await page.evaluate(
    ([w, h]) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#0033cc';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#00aa33';
      g.fillRect(w / 2, 0, w / 2, h / 2);
      g.fillStyle = '#ee1111';
      g.fillRect(0, 0, w / 2, h / 2);
      return c.toDataURL('image/jpeg', 0.7);
    },
    [width, height],
  );
  return Buffer.from(url.split(',')[1], 'base64');
}

const files = {
  // 64×48 landscape, upright.
  'exif-64x48.jpg': withExif(await render(64, 48), { orientation: 1, taken: TAKEN, gps: JBR }),
  // Stored 80×40 with Orientation=6 (rotate 90° CW) → displays as 40×80 portrait.
  'exif-rot6-40x80.jpg': withExif(await render(80, 40), { orientation: 6, taken: TAKEN, gps: JBR }),
  // 64×48 with no metadata at all.
  'no-exif-64x48.jpg': await render(64, 48),
};

await browser.close();

for (const [name, bytes] of Object.entries(files)) {
  if (bytes.length > 10_000) throw new Error(`${name} is ${bytes.length} bytes`);
  writeFileSync(`${OUT}${name}`, bytes);
  console.log(`${name}: ${bytes.length} bytes`);
}
