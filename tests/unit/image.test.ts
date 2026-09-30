import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readExif } from '@/lib/exif';
import { FULL_PX, QUALITY, THUMB_PX, fitWithin, stripJpegMetadata } from '@/lib/image';

const fixture = (name: string) => new Uint8Array(readFileSync(resolve(process.cwd(), 'tests/fixtures/images', name)));
const hasExifSig = (u: Uint8Array) => Buffer.from(u).includes(Buffer.from('Exif\0\0', 'latin1'));

describe('fitWithin', () => {
  it('scales a landscape image by its width', () => {
    expect(fitWithin(4032, 3024, FULL_PX)).toEqual({ width: 1600, height: 1200 });
  });
  it('scales a portrait image by its height', () => {
    expect(fitWithin(3024, 4032, THUMB_PX)).toEqual({ width: 360, height: 480 });
  });
  it('scales a square image evenly', () => {
    expect(fitWithin(2000, 2000, FULL_PX)).toEqual({ width: 1600, height: 1600 });
  });
  it('never upscales', () => {
    expect(fitWithin(640, 480, FULL_PX)).toEqual({ width: 640, height: 480 });
    expect(fitWithin(1600, 900, FULL_PX)).toEqual({ width: 1600, height: 900 });
  });
  it('rounds to integers and never returns zero', () => {
    expect(fitWithin(3000, 2001, 1600)).toEqual({ width: 1600, height: 1067 });
    expect(fitWithin(10000, 3, 480)).toEqual({ width: 480, height: 1 });
    const r = fitWithin(1999, 1333, 1600);
    expect(Number.isInteger(r.width) && Number.isInteger(r.height)).toBe(true);
    expect(Math.max(r.width, r.height)).toBeLessThanOrEqual(1600);
  });
  it('exposes the pipeline constants', () => {
    expect([THUMB_PX, FULL_PX, QUALITY]).toEqual([480, 1600, 0.8]);
  });
});

describe('stripJpegMetadata', () => {
  it('removes the Exif APP1 segment and keeps the image data', async () => {
    const src = fixture('exif-rot6-40x80.jpg');
    expect(hasExifSig(src)).toBe(true);
    const out = stripJpegMetadata(src);
    expect(hasExifSig(out)).toBe(false);
    expect([out[0], out[1]]).toEqual([0xff, 0xd8]);
    expect([out[out.length - 2], out[out.length - 1]]).toEqual([0xff, 0xd9]);
    expect(Buffer.from(out).equals(Buffer.from(fixture('no-exif-64x48.jpg')))).toBe(false);
    const exif = await readExif(new Blob([out]));
    expect(exif).toEqual({ takenAt: null, date: null, time: null, lat: null, lng: null, orientation: null });
  });
  it('returns the same bytes when there is nothing to strip', () => {
    const src = fixture('no-exif-64x48.jpg');
    expect(stripJpegMetadata(src)).toBe(src);
  });
  it('leaves non-JPEG and truncated input untouched', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(stripJpegMetadata(png)).toBe(png);
    const cut = fixture('exif-64x48.jpg').subarray(0, 10);
    expect(stripJpegMetadata(cut)).toBe(cut);
  });
});
