import { describe, expect, it } from 'vitest';
import { buildExport, ImportError, parseImport } from '@/features/settings/exportData';
import { crc32, readZip, zipFiles } from '@/features/settings/zip';
import type { Letter, Snapshot, Wish } from '@/data/types';
import { makeHotel, makeVisit } from './factories';

function makeWish(overrides: Partial<Wish> = {}): Wish {
  return {
    wish_id: 'WISH0001',
    name: 'A beach somewhere',
    lat: null,
    lng: null,
    city: null,
    country: null,
    note: null,
    added_by: 'nirsh',
    priority: 1,
    fulfilled_visit_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted: false,
    ...overrides,
  };
}

function makeLetter(overrides: Partial<Letter> = {}): Letter {
  return {
    letter_id: 'LETTER0001',
    title: 'A note',
    body_md: 'Hello',
    from: 'nirsh',
    to: 'shady',
    unlock_rule: 'always',
    written_at: '2026-01-01',
    read_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSnapshot(): Snapshot {
  const hotel = makeHotel({ name: 'Café, "Sur la Mer"\nSeaside' });
  const visit = makeVisit(hotel);
  return {
    hotels: [hotel],
    visits: [visit],
    photos: [],
    wishes: [makeWish()],
    letters: [makeLetter()],
    settings: {
      home_base: { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', lat: 25.2048, lng: 55.2708 },
      map_lighting: 'auto',
      units: 'km',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    serverTime: '2026-01-01T00:00:00.000Z',
  };
}

describe('crc32', () => {
  it('matches the standard CRC-32 check value for "123456789"', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('zipFiles / readZip', () => {
  it('round-trips plain ASCII content', async () => {
    const blob = zipFiles([{ name: 'a.txt', data: 'hello world' }]);
    const entries = readZip(await blob.arrayBuffer());
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('a.txt');
    expect(new TextDecoder().decode(entries[0].data)).toBe('hello world');
  });

  it('round-trips UTF-8 names and content', async () => {
    const blob = zipFiles([
      { name: 'café-☕.txt', data: 'naïve façade — 日本語 emoji 🎉' },
      { name: 'binary.bin', data: new Uint8Array([0, 1, 2, 255, 254]) },
    ]);
    const entries = readZip(await blob.arrayBuffer());
    expect(entries.map((e) => e.name)).toEqual(['café-☕.txt', 'binary.bin']);
    expect(new TextDecoder().decode(entries[0].data)).toBe('naïve façade — 日本語 emoji 🎉');
    expect([...entries[1].data]).toEqual([0, 1, 2, 255, 254]);
  });
});

describe('buildExport CSV escaping', () => {
  it('quotes fields with commas, quotes and newlines (RFC 4180)', () => {
    const snap = makeSnapshot();
    const files = buildExport(snap);
    const hotelsCsv = files.find((f) => f.name === 'hotels.csv')!.data;
    // The name `Café, "Sur la Mer"\nSeaside` must be wrapped in quotes with doubled internal quotes.
    expect(hotelsCsv).toContain('"Café, ""Sur la Mer""\nSeaside"');
    const lines = hotelsCsv.trim().split('\r\n');
    expect(lines[0]).toBe(
      'hotel_id,name,brand,address,area,city,region,country,country_code,lat,lng,source,osm_id,wikidata_id,website,phone,stars,price_level,description,description_source,amenities_json,cover_photo_id,enrichment_status,enriched_at,created_at,updated_at,deleted',
    );
  });
});

describe('buildExport -> parseImport round trip', () => {
  it('recovers the same snapshot from the zip', async () => {
    const snap = makeSnapshot();
    const files = buildExport(snap);
    const blob = zipFiles(files, new Date('2026-09-30T12:00:00Z'));
    const file = new File([blob], 'suite-nothings-2026-09-30.zip', { type: 'application/zip' });
    const parsed = await parseImport(file);
    expect(parsed.hotels).toEqual(snap.hotels);
    expect(parsed.visits).toEqual(snap.visits);
    expect(parsed.wishes).toEqual(snap.wishes);
    expect(parsed.letters).toEqual(snap.letters);
    expect(parsed.settings).toEqual(snap.settings);
  });

  it('also accepts a bare .json file (wrapped or plain Snapshot)', async () => {
    const snap = makeSnapshot();
    const plainJson = JSON.stringify(snap);
    const parsed = await parseImport(new File([plainJson], 'suite-nothings-2026-09-30.json', { type: 'application/json' }));
    expect(parsed.hotels).toEqual(snap.hotels);
    expect(parsed.visits).toEqual(snap.visits);
  });

  it('rejects a file that is not one of our exports with a friendly message', async () => {
    const bad = new File(['not json at all'], 'notes.txt', { type: 'text/plain' });
    await expect(parseImport(bad)).rejects.toBeInstanceOf(ImportError);
    await expect(parseImport(bad)).rejects.toMatchObject({
      message: "That file isn't one of our exports. Look for suite-nothings-….zip or .json.",
    });
  });

  it('rejects a zip with no suite-nothings.json inside', async () => {
    const blob = zipFiles([{ name: 'other.json', data: '{}' }]);
    const file = new File([blob], 'other.zip', { type: 'application/zip' });
    await expect(parseImport(file)).rejects.toBeInstanceOf(ImportError);
  });
});
