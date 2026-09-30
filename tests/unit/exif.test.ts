import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseExifDateString, readExif, suggestFromExif, type ExifInfo } from '@/lib/exif';
import { haversineKm } from '@/lib/geo';

const fixture = (name: string) => readFileSync(resolve(process.cwd(), 'tests/fixtures/images', name));
const blob = (name: string) => new Blob([fixture(name)], { type: 'image/jpeg' });

const JBR = { lat: 25.0785, lng: 55.1347 };

function info(date: string | null, time: string | null, gps?: { lat: number; lng: number }): ExifInfo {
  return {
    takenAt: date && time ? `${date}T${time}:00` : null,
    date,
    time,
    lat: gps?.lat ?? null,
    lng: gps?.lng ?? null,
    orientation: null,
  };
}

describe('parseExifDateString', () => {
  it('parses the EXIF colon format as wall time', () => {
    expect(parseExifDateString('2026:07:12 15:42:10')).toEqual({
      date: '2026-07-12',
      time: '15:42',
      takenAt: '2026-07-12T15:42:10',
    });
  });
  it('accepts dashes, a T separator, missing seconds and a trailing offset', () => {
    expect(parseExifDateString('2026-07-12T08:05')?.takenAt).toBe('2026-07-12T08:05:00');
    expect(parseExifDateString('2026:01:31 23:59:59+04:00')?.date).toBe('2026-01-31');
  });
  it('rejects blanks and impossible dates', () => {
    expect(parseExifDateString('0000:00:00 00:00:00')).toBeNull();
    expect(parseExifDateString('2026:02:30 10:00:00')).toBeNull();
    expect(parseExifDateString('2026:07:12 24:00:00')).toBeNull();
    expect(parseExifDateString('')).toBeNull();
    expect(parseExifDateString('not a date')).toBeNull();
  });
});

describe('readExif', () => {
  it('reads date, GPS and orientation from a real JPEG', async () => {
    const r = await readExif(blob('exif-64x48.jpg'));
    expect(r.takenAt).toBe('2026-07-12T15:42:10');
    expect(r.date).toBe('2026-07-12');
    expect(r.time).toBe('15:42');
    expect(r.orientation).toBe(1);
    expect(r.lat).toBeCloseTo(JBR.lat, 4);
    expect(r.lng).toBeCloseTo(JBR.lng, 4);
  });
  it('reads Orientation=6', async () => {
    const r = await readExif(blob('exif-rot6-40x80.jpg'));
    expect(r.orientation).toBe(6);
    expect(r.takenAt).toBe('2026-07-12T15:42:10');
  });
  it('returns all-null for a JPEG without EXIF', async () => {
    expect(await readExif(blob('no-exif-64x48.jpg'))).toEqual({
      takenAt: null, date: null, time: null, lat: null, lng: null, orientation: null,
    });
  });
  it('never throws on garbage', async () => {
    const r = await readExif(new Blob([new Uint8Array([1, 2, 3, 4])]));
    expect(r.takenAt).toBeNull();
    expect(r.lat).toBeNull();
  });
});

describe('suggestFromExif', () => {
  const marina = { lat: 25.08, lng: 55.14 };
  const palm = { lat: 25.1124, lng: 55.139 };

  it('returns null for no photos or photos with nothing useful', () => {
    expect(suggestFromExif([])).toBeNull();
    expect(suggestFromExif([info(null, null)])).toBeNull();
  });
  it('picks the most common date and its earliest time', () => {
    const s = suggestFromExif([
      info('2026-07-11', '09:00'),
      info('2026-07-12', '18:30'),
      info('2026-07-12', '14:05'),
      info('2026-07-12', null),
    ]);
    expect(s).toMatchObject({ date: '2026-07-12', time: '14:05', lat: null, lng: null, count: 3 });
  });
  it('breaks date ties towards the earliest', () => {
    const s = suggestFromExif([info('2026-07-14', '10:00'), info('2026-07-12', '11:00')]);
    expect(s?.date).toBe('2026-07-12');
    expect(s?.count).toBe(1);
  });
  it('averages GPS from photos on the chosen date only', () => {
    const s = suggestFromExif([
      info('2026-07-12', '10:00', JBR),
      info('2026-07-12', '11:00', marina),
      info('2026-07-01', '11:00', { lat: 48.85, lng: 2.35 }),
    ]);
    expect(s?.lat).toBeCloseTo((JBR.lat + marina.lat) / 2, 3);
    expect(s?.lng).toBeCloseTo((JBR.lng + marina.lng) / 2, 3);
  });
  it('falls back to any GPS when the chosen date has none', () => {
    const s = suggestFromExif([info('2026-07-12', '10:00'), info('2026-07-12', '11:00'), info(null, null, palm)]);
    expect(s?.date).toBe('2026-07-12');
    expect(haversineKm({ lat: s!.lat!, lng: s!.lng! }, palm)).toBeLessThan(0.01);
  });
  it('suggests GPS alone when no photo has a date', () => {
    expect(suggestFromExif([info(null, null, JBR), info(null, null, JBR)])).toMatchObject({ date: null, time: null, count: 2 });
  });
  it('returns null when it matches the current values', () => {
    const photos = [info('2026-07-12', '10:00', JBR)];
    expect(suggestFromExif(photos, { date: '2026-07-12', lat: 25.079, lng: 55.135 })).toBeNull();
    expect(suggestFromExif([info('2026-07-12', '10:00')], { date: '2026-07-12' })).toBeNull();
  });
  it('still suggests when the place is further than 0.3 km or the date differs', () => {
    const photos = [info('2026-07-12', '10:00', JBR)];
    expect(suggestFromExif(photos, { date: '2026-07-12', ...palm })).not.toBeNull();
    expect(suggestFromExif(photos, { date: '2026-07-13', ...JBR })?.date).toBe('2026-07-12');
    expect(suggestFromExif(photos, { date: '2026-07-12' })).not.toBeNull();
  });
});
