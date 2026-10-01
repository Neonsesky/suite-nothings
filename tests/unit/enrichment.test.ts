import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAIDescriptionProvider, createEnricher, runProviders } from '@/enrichment';
import { appsScriptAI, buildPrompt, factsOf, parseAIResponse, type AIProvider } from '@/enrichment/ai';
import { handEdit, mergePatch } from '@/enrichment/merge';
import { createOsmProvider, mapOsmTags, overpassQuery } from '@/enrichment/osm';
import { createPlacesProvider, placesPriceLevel } from '@/enrichment/places';
import type { EnrichmentProvider, FetchLike } from '@/enrichment/types';
import { commonsPageFor, createWikidataProvider, entityFacts, nameSimilarity, type WikidataEntity } from '@/enrichment/wikidata';
import type { Hotel } from '@/data/types';
import { makeHotel } from './factories';

interface Recorded {
  url: string;
  status: number;
  body: unknown;
}
const fixture = (name: string): Recorded[] => JSON.parse(readFileSync(`tests/fixtures/enrichment/${name}.json`, 'utf8')) as Recorded[];

/** Replays recorded responses by URL; anything unrecorded is a test failure, never a live call. */
function replay(records: Recorded[]): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    const hit = records.find((r) => r.url === url);
    if (!hit) throw new Error(`Unrecorded request: ${url}`);
    return new Response(JSON.stringify(hit.body), { status: hit.status, headers: { 'content-type': 'application/json' } });
  }) as FetchLike & { calls: string[] };
  fn.calls = calls;
  return fn;
}

const bare = (o: Partial<Hotel>) =>
  makeHotel({ brand: null, address: null, website: null, phone: null, stars: null, price_level: null, description: null, description_source: null, amenities_json: null, wikidata_id: null, image_url: null, image_credit: null, enriched_fields_json: null, enrichment_status: 'pending', ...o });

const atlantis = () => bare({ hotel_id: 'atlantis-royal', name: 'Atlantis The Royal', lat: 25.137842, lng: 55.127337, osm_id: 'W1465036747' });
const signal = () => new AbortController().signal;

beforeEach(() => localStorage.clear());

describe('OSM tag mapping', () => {
  it('maps brand, stars, website, phone, wikidata, address, price and amenities', () => {
    expect(
      mapOsmTags({
        brand: 'Rixos',
        stars: '5',
        'contact:website': 'rixos.com/jbr',
        phone: '+971 4 520 0000;+971 4 520 0001',
        wikidata: 'Q123',
        'addr:housenumber': '12',
        'addr:street': 'Al Mamsha Street',
        'addr:city': 'Dubai',
        price_range: '$$$',
        swimming_pool: 'yes',
        internet_access: 'wlan',
        wheelchair: 'limited',
      }),
    ).toEqual({
      brand: 'Rixos',
      stars: 5,
      website: 'https://rixos.com/jbr',
      phone: '+971 4 520 0000',
      wikidata_id: 'Q123',
      address: '12 Al Mamsha Street, Dubai',
      price_level: 3,
      amenities_json: JSON.stringify(['Pool', 'Wi-Fi']),
    });
  });

  it('drops malformed values', () => {
    expect(mapOsmTags({ stars: '7', wikidata: 'nope', website: 'http://', 'addr:city': 'Dubai' })).toEqual({});
  });

  it('builds a single-element Overpass query and caches the answer', async () => {
    expect(overpassQuery('W91402276')).toBe('[out:json][timeout:10];way(91402276);out tags;');
    expect(overpassQuery('X1')).toBeNull();
    const fetch = replay(fixture('atlantis-royal'));
    const p = createOsmProvider({ fetch });
    expect(await p.enrich(atlantis(), signal())).toEqual({ website: 'https://www.atlantis.com/atlantis-the-royal' });
    await p.enrich(atlantis(), signal());
    expect(fetch.calls.filter((u) => u.includes('overpass'))).toHaveLength(1);
  });
});

describe('Wikidata entity → fields', () => {
  const entity: WikidataEntity = {
    id: 'Q677823',
    labels: { en: { value: 'Address Downtown' } },
    claims: {
      P856: [{ mainsnak: { datavalue: { value: 'http://www.theaddress.com/' } } }],
      P18: [{ mainsnak: { datavalue: { value: 'Tower.jpg' } } }],
      P625: [{ mainsnak: { datavalue: { value: { latitude: 25.1938, longitude: 55.2788 } } } }],
    },
    sitelinks: { enwiki: { title: 'Address Downtown' } },
  };

  it('reads website, image, coordinates and the English article', () => {
    expect(entityFacts(entity)).toEqual({
      id: 'Q677823',
      label: 'Address Downtown',
      website: 'http://www.theaddress.com/',
      phone: null,
      imageFile: 'Tower.jpg',
      enwikiTitle: 'Address Downtown',
      coords: { lat: 25.1938, lng: 55.2788 },
    });
  });

  it('only matches names that share the distinctive words', () => {
    expect(nameSimilarity('Atlantis The Royal', 'Atlantis The Royal, Dubai')).toBe(1);
    expect(nameSimilarity('Golden Tulip Al Barsha', 'Al Barsha')).toBeLessThan(0.6);
  });

  it('fills summary, source, site and a credited Commons image from the recording', async () => {
    const patch = await createWikidataProvider({ fetch: replay(fixture('atlantis-royal')) }).enrich(atlantis(), signal());
    expect(patch.wikidata_id).toBe('Q116730005');
    expect(patch.description_source).toBe('wikipedia');
    expect(patch.description).toMatch(/^Atlantis The Royal/);
    expect(patch.image_url).toMatch(/^https:\/\/.*wikimedia\.org\//);
    expect(patch.image_credit).toBe('EditQ · CC0 · Wikimedia Commons');
    expect(commonsPageFor(patch.image_url!)).toBe('https://commons.wikimedia.org/wiki/File:Atlantis_The_Royal%2C_Dubai_1.jpg');
  });

  it('finds nothing rather than guessing when no nearby candidate matches', async () => {
    const h = bare({ name: 'Golden Tulip Al Barsha', lat: 25.11276, lng: 55.190071, osm_id: 'W91402276' });
    expect(await createWikidataProvider({ fetch: replay(fixture('golden-tulip')) }).enrich(h, signal())).toEqual({});
  });
});

describe('merge only empty fields', () => {
  it('never overwrites a hand-filled field', () => {
    const h = bare({ website: 'https://ours.example', phone: null });
    const r = mergePatch(h, { website: 'https://theirs.example', phone: '+971 1' });
    expect(r.changes).toEqual({ phone: '+971 1' });
    expect(r.filled).toEqual(['phone']);
  });

  it('with force, refreshes only fields enrichment filled', () => {
    const h = bare({ website: 'https://old.example', phone: '+971 hand', enriched_fields_json: '["website"]' });
    const r = mergePatch(h, { website: 'https://new.example', phone: '+971 new' }, { force: true });
    expect(r.changes).toEqual({ website: 'https://new.example' });
  });

  it('keeps a description and its source together', () => {
    const r = mergePatch(bare({}), { description: 'A tall hotel.', description_source: 'wikipedia' });
    expect(r.changes).toEqual({ description: 'A tall hotel.', description_source: 'wikipedia' });
  });

  it('a hand edit takes the field back from enrichment', () => {
    const h = handEdit(bare({ price_level: 2, enriched_fields_json: '["price_level","website"]' }), { price_level: 3 });
    expect(h.enriched_fields_json).toBe('["website"]');
    expect(mergePatch(h, { price_level: 1 }, { force: true }).changes).toEqual({});
  });
});

describe('enrich once', () => {
  function setup(online = true) {
    const hotels = new Map<string, Hotel>([['h1', bare({ hotel_id: 'h1' })]]);
    const enrich = vi.fn<EnrichmentProvider['enrich']>(async () => ({ phone: '+971 4' }));
    const saveHotel = vi.fn(async (h: Hotel) => {
      hotels.set(h.hotel_id, h);
    });
    const state = { online };
    const e = createEnricher({
      getHotel: (id) => hotels.get(id),
      saveHotel,
      providers: () => [{ id: 'fake', canEnrich: () => true, enrich }],
      isOnline: () => state.online,
      now: () => '2026-10-01T10:00:00.000Z',
    });
    return { e, hotels, enrich, saveHotel, state };
  }

  it('fetches once, writes the result and a final status, and never fetches again without force', async () => {
    const { e, hotels, enrich } = setup();
    await e.request('h1');
    expect(hotels.get('h1')).toMatchObject({ phone: '+971 4', enrichment_status: 'done', enriched_at: '2026-10-01T10:00:00.000Z' });
    await e.request('h1');
    expect(enrich).toHaveBeenCalledTimes(1);
    await e.request('h1', { force: true });
    expect(enrich).toHaveBeenCalledTimes(2);
    expect(e.status('h1')).toBe('done');
  });

  it('queues while offline (status stays pending) and runs on drain', async () => {
    const { e, hotels, enrich, state } = setup(false);
    await e.request('h1');
    expect(enrich).not.toHaveBeenCalled();
    expect(hotels.get('h1')!.enrichment_status).toBe('pending');
    expect(e.status('h1')).toBe('skipped');
    state.online = true;
    await e.drain();
    expect(hotels.get('h1')!.enrichment_status).toBe('done');
  });
});

describe('provider fallback chain', () => {
  const ok = (id: string, patch: object): EnrichmentProvider => ({ id, canEnrich: () => true, enrich: async () => patch });
  const boom = (id: string): EnrichmentProvider => ({ id, canEnrich: () => true, enrich: () => Promise.reject(new Error(`${id} down`)) });

  it('carries on past a failing provider and ends done', async () => {
    const r = await runProviders(bare({}), [boom('osm'), ok('wikidata', { website: 'https://w.example' })], signal());
    expect(r.outcome).toBe('done');
    expect(r.changes.website).toBe('https://w.example');
    expect(r.errors).toEqual([{ provider: 'osm', message: 'osm down' }]);
  });

  it('ends failed when every provider fails, skipped when none applies', async () => {
    expect((await runProviders(bare({}), [boom('osm'), boom('wikidata')], signal())).outcome).toBe('failed');
    expect((await runProviders(bare({}), [{ id: 'x', canEnrich: () => false, enrich: async () => ({}) }], signal())).outcome).toBe('skipped');
  });

  it('later providers see earlier results, and the first filler wins', async () => {
    const seen: (string | null)[] = [];
    const second: EnrichmentProvider = { id: 'b', canEnrich: () => true, enrich: async (h) => (seen.push(h.wikidata_id), { wikidata_id: 'Q2', phone: '1' }) };
    const r = await runProviders(bare({}), [ok('a', { wikidata_id: 'Q1' }), second], signal(), { force: true });
    expect(seen).toEqual(['Q1']);
    expect(r.hotel.wikidata_id).toBe('Q1');
    expect(r.hotel.phone).toBe('1');
  });

  it('runs the recorded Overpass 504 then Wikidata for Address Downtown', async () => {
    const h = bare({ hotel_id: 'address-downtown', name: 'Address Downtown', lat: 25.19404, lng: 55.278912, osm_id: 'W532836513' });
    const fetch = replay(fixture('address-downtown'));
    const r = await runProviders(h, [createOsmProvider({ fetch }), createWikidataProvider({ fetch })], signal());
    expect(r.outcome).toBe('done');
    expect(r.errors.map((x) => x.provider)).toEqual(['osm']);
    expect(r.hotel).toMatchObject({ wikidata_id: 'Q677823', website: 'http://www.theaddress.com/', description_source: 'wikipedia' });
  });

  it('Places not configured is a quiet no-op', async () => {
    const p = createPlacesProvider(async () => ({ ok: false, code: 'not_configured' }));
    expect(await p.enrich(bare({}), signal())).toEqual({});
    expect(placesPriceLevel('PRICE_LEVEL_EXPENSIVE')).toBe(3);
    expect(placesPriceLevel('PRICE_LEVEL_FREE')).toBeNull();
  });
});

describe('AI prompt and provider', () => {
  it('passes only fetched facts — no contact details, no previous AI text', () => {
    const h = bare({ name: 'Atlantis The Royal', city: 'Dubai', country: 'United Arab Emirates', area: 'Palm Jumeirah', stars: 5, website: 'https://secret.example', phone: '+971 999', description: 'An old AI line.', description_source: 'ai', amenities_json: '["Pool"]' });
    const facts = factsOf(h);
    expect(facts).toEqual({ name: 'Atlantis The Royal', city: 'Dubai', country: 'United Arab Emirates', area: 'Palm Jumeirah', stars: 5, amenities: ['Pool'] });
    const prompt = buildPrompt(facts);
    expect(prompt).toContain('ONLY the facts below');
    expect(prompt).toContain('2–3 sentence');
    expect(prompt).not.toContain('secret.example');
    expect(prompt).not.toContain('+971 999');
    expect(prompt).not.toContain('An old AI line.');
  });

  it('parses fenced JSON and rejects junk', () => {
    expect(parseAIResponse('```json\n{"description":"A calm palm-side hotel with a big pool.","tags":["Pool","beach"]}\n```')).toEqual({ description: 'A calm palm-side hotel with a big pool.', tags: ['pool', 'beach'] });
    expect(parseAIResponse('sorry')).toBeNull();
  });

  it('labels the description as AI and leaves sourced descriptions alone', async () => {
    const ai: AIProvider = { id: 'ollama', available: async () => true, describe: async () => ({ description: 'A calm palm-side hotel with a big pool.', tags: [] }) };
    const p = createAIDescriptionProvider(ai);
    expect(await p.enrich(bare({}), signal())).toEqual({ description: 'A calm palm-side hotel with a big pool.', description_source: 'ai' });
    expect(p.canEnrich(bare({ description: 'From Wikipedia.', description_source: 'wikipedia' }))).toBe(false);
  });

  it('Apps Script AI surfaces not_configured as a failure of that provider only', async () => {
    const ai = appsScriptAI(async () => ({ ok: false, code: 'not_configured' }));
    await expect(ai.describe('x', signal())).rejects.toThrow('not_configured');
    const r = await runProviders(bare({}), [{ id: 'osm', canEnrich: () => true, enrich: async () => ({ phone: '1' }) }, createAIDescriptionProvider(ai)], signal());
    expect(r.outcome).toBe('done');
  });
});
