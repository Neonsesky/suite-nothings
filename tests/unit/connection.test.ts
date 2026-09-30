import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inviteLink, parseJoinParams, restoreConnection, saveConnection, shortenUrl, testConnection, validateApiUrl } from '@/data/connection';
import { getDevice, resetDevice } from '@/data/device';

const GOOD = 'https://script.google.com/macros/s/AKfycbx1234567890abcdef/exec';

describe('validateApiUrl', () => {
  it('accepts a trimmed /exec link and drops query/hash', () => {
    expect(validateApiUrl(`  ${GOOD}?foo=1#x `, { allowLocal: false })).toEqual({ ok: true, url: GOOD });
    expect(validateApiUrl('https://script.google.com/a/macros/example.com/s/AKfycbx1234567890abcdef/exec', { allowLocal: false }).ok).toBe(true);
  });
  it('warns on /dev', () => {
    expect(validateApiUrl(GOOD.replace('/exec', '/dev'), { allowLocal: false })).toMatchObject({ ok: false, reason: 'dev_url' });
  });
  it('rejects anything else', () => {
    for (const bad of ['', 'hello', 'http://script.google.com/macros/s/AKfycbx1234567890abcdef/exec', 'https://docs.google.com/spreadsheets/d/abc/edit', 'https://script.google.com/home/projects/abc/edit', 'https://evil.com/macros/s/AKfycbx1234567890abcdef/exec']) {
      expect(validateApiUrl(bad, { allowLocal: false }).ok).toBe(false);
    }
  });
  it('accepts a localhost mock only when the test flag allows it', () => {
    const local = 'http://localhost:8787/macros/s/MOCK/exec';
    expect(validateApiUrl(local, { allowLocal: false }).ok).toBe(false);
    expect(validateApiUrl(local, { allowLocal: true })).toEqual({ ok: true, url: local });
    expect(validateApiUrl('http://127.0.0.1:9/macros/s/MOCK/exec', { allowLocal: true }).ok).toBe(true);
  });
  it('shortens for display', () => {
    expect(shortenUrl(GOOD)).toBe('script.google.com/…/AKfy…cdef/exec');
  });
});

describe('invite links', () => {
  it('round-trips through parseJoinParams', () => {
    const link = inviteLink({ apiUrl: GOOD, key: 'our secret & more' }, 'shady', 'https://x.github.io/suite/');
    expect(link.startsWith('https://x.github.io/suite/#/join?')).toBe(true);
    const q = new URLSearchParams(link.split('#/join?')[1]);
    expect(parseJoinParams(q)).toEqual({ ok: true, params: { api: GOOD, key: 'our secret & more', as: 'shady' } });
  });
  it('reports what is missing, keeping what it could read', () => {
    const r = parseJoinParams(new URLSearchParams({ api: GOOD, as: 'Shady' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.partial).toMatchObject({ api: GOOD, as: 'shady' });
    expect(parseJoinParams(new URLSearchParams({ api: 'nope', key: 'k' })).ok).toBe(false);
  });
});

describe('testConnection', () => {
  const env = (handler: (action: string, key: string | null) => unknown) =>
    (async (input: RequestInfo | URL) => {
      const u = new URL(String(input));
      const out = handler(u.searchParams.get('action') ?? '', u.searchParams.get('key'));
      if (out instanceof Error) throw out;
      return new Response(typeof out === 'string' ? out : JSON.stringify(out));
    }) as typeof fetch;

  it('connected: counts non-deleted stays', async () => {
    const fetch = env((action) =>
      action === 'ping'
        ? { ok: true, data: { version: '1.0.0' } }
        : { ok: true, data: { visits: [1, 2, 3].map((i) => ({ visit_id: `V${i}`, hotel_id: 'H', date: '2026-06-19', deleted: i === 3 })), serverTime: '2026-09-30T00:00:00Z' } },
    );
    expect(await testConnection(GOOD, 'k', { fetch, allowLocal: false })).toMatchObject({ ok: true, outcome: 'connected', message: 'Connected: 2 stays synced', stays: 2 });
  });
  it('wrong passphrase', async () => {
    const fetch = env((action) => (action === 'ping' ? { ok: true, data: {} } : { ok: false, error: { code: 'unauthorized', message: 'no' } }));
    expect(await testConnection(GOOD, 'bad', { fetch })).toMatchObject({ outcome: 'wrong_passphrase', message: 'Wrong passphrase' });
  });
  it('not an Apps Script link', async () => {
    const fetch = env(() => '<html><title>Sign in</title></html>');
    expect(await testConnection(GOOD, 'k', { fetch })).toMatchObject({ outcome: 'not_apps_script', message: "This isn't an Apps Script web app link" });
    expect(await testConnection('https://example.com', 'k')).toMatchObject({ outcome: 'bad_url' });
  });
  it('unreachable', async () => {
    const fetch = env(() => new TypeError('Failed to fetch'));
    expect(await testConnection(GOOD, 'k', { fetch })).toMatchObject({ outcome: 'unreachable', message: "Can't reach Google right now" });
  });
});

describe('connection persistence', () => {
  beforeEach(() => resetDevice());
  it('restores from the IndexedDB mirror when localStorage lost it', async () => {
    const config = { apiUrl: GOOD, key: 'k', connectedAt: '2026-09-30T00:00:00.000Z', lastSyncAt: null };
    await saveConnection(config);
    localStorage.clear();
    resetDevice();
    expect(getDevice('connection')).toBeNull();
    vi.resetModules();
    const fresh = await import('@/data/connection');
    const dev = await import('@/data/device');
    expect(await fresh.restoreConnection()).toBe(true);
    expect(dev.getDevice('connection')).toEqual(config);
    expect(dev.getDevice('mode')).toBe('live');
  });
  it('fast path when localStorage still has it', async () => {
    await saveConnection({ apiUrl: GOOD, key: 'k', connectedAt: null, lastSyncAt: null });
    expect(await restoreConnection()).toBe(false);
  });
});
