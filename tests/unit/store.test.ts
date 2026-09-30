import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoAdapter, resetDemoServer } from '@/data/adapters/demo';
import { closeDb, openDb } from '@/data/db';
import { resetDevice, setDevice } from '@/data/device';
import { buildStays, filterStays } from '@/data/stays';
import * as store from '@/data/store';
import * as sync from '@/data/sync';
import type { Visit } from '@/data/types';

let online = true;
Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });

async function fresh() {
  sync.stopSync();
  await closeDb('demo');
  await closeDb('live');
  await resetDemoServer();
  globalThis.indexedDB = new IDBFactory();
  resetDevice();
  online = true;
}

const demo = () => createDemoAdapter({ latencyMs: 0 });
const liveStays = () => {
  const s = store.getState();
  return filterStays(buildStays(s.visits.values(), s.hotels, s.photos.values()), {});
};
const until = async (cond: () => boolean | Promise<boolean>, ms = 2000) => {
  const start = Date.now();
  while (!(await cond())) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
};

beforeEach(fresh);
afterEach(() => sync.stopSync());

describe('store', () => {
  it('bootstraps the demo seed into IndexedDB', async () => {
    await store.initStore({ ns: 'demo', adapter: demo(), startSync: false });
    const s = store.getState();
    expect(s.ready).toBe(true);
    expect(s.visits.size).toBe(12);
    expect(s.hotels.size).toBe(11);
    const db = await openDb('demo');
    expect(await db.count('visits')).toBe(12);
  });

  it('writes go to IndexedDB and the outbox, and survive a reload', async () => {
    await store.initStore({ ns: 'demo', adapter: demo(), startSync: false });
    const hotel = [...store.getState().hotels.values()][0];
    const v = await store.upsertVisit({ hotel_id: hotel.hotel_id, date: '2026-09-30', visit_type: 'Spa' });
    const db = await openDb('demo');
    expect(await db.get('visits', v.visit_id)).toMatchObject({ visit_type: 'Spa' });
    const ops = await db.getAll('outbox');
    expect(ops.map((o) => o.action)).toEqual(['upsertVisit']);
    expect(store.getState().sync.pending).toBe(1);
    await store.initStore({ ns: 'demo', adapter: demo(), startSync: false });
    expect(store.getState().visits.get(v.visit_id)?.date).toBe('2026-09-30');
  });

  it('upserts are idempotent by id and keep created_at', async () => {
    await store.initStore({ ns: 'demo', adapter: demo(), startSync: false });
    const hotel = [...store.getState().hotels.values()][0];
    const a = await store.upsertVisit({ hotel_id: hotel.hotel_id, date: '2026-09-30', visit_type: 'Spa' });
    const b = await store.upsertVisit({ ...a, note: 'Second pass' });
    expect(b.visit_id).toBe(a.visit_id);
    expect(b.created_at).toBe(a.created_at);
    expect(store.getState().visits.size).toBe(13);
    expect(store.getState().visits.get(a.visit_id)?.note).toBe('Second pass');
  });

  it('soft delete hides a stay and undo brings it back', async () => {
    await store.initStore({ ns: 'demo', adapter: demo(), startSync: false });
    const first = liveStays()[0];
    await store.softDeleteVisit(first.visit.visit_id);
    expect(liveStays().find((s) => s.visit.visit_id === first.visit.visit_id)).toBeUndefined();
    expect(store.getState().visits.get(first.visit.visit_id)?.deleted).toBe(true);
    await store.undoDeleteVisit(first.visit.visit_id);
    expect(liveStays().find((s) => s.visit.visit_id === first.visit.visit_id)).toBeDefined();
    const ops = await (await openDb('demo')).getAll('outbox');
    expect(ops.filter((o) => o.action === 'deleteVisit')).toHaveLength(2);
  });

  it('remote rows merge last-write-wins and never clobber pending local edits', async () => {
    await store.initStore({ ns: 'demo', adapter: demo(), startSync: false });
    const [a, b] = [...store.getState().visits.values()];
    const older: Visit = { ...a, note: 'older', updated_at: '2000-01-01T00:00:00.000Z' };
    const newer: Visit = { ...a, note: 'newer', updated_at: '2099-01-01T00:00:00.000Z' };
    let change = await store.applyRemote({ visits: [older] });
    expect(change.visits).toHaveLength(0);
    change = await store.applyRemote({ visits: [newer] });
    expect(change.visits).toHaveLength(1);
    expect(store.getState().visits.get(a.visit_id)?.note).toBe('newer');
    // Local pending edit on b wins over any remote copy until it is flushed.
    await store.upsertVisit({ ...b, note: 'mine' });
    await store.applyRemote({ visits: [{ ...b, note: 'theirs', updated_at: '2099-01-01T00:00:00.000Z' }] });
    expect(store.getState().visits.get(b.visit_id)?.note).toBe('mine');
  });

  it('reports new visits from a pull', async () => {
    await store.initStore({ ns: 'demo', adapter: demo(), startSync: false });
    const v = [...store.getState().visits.values()][0];
    const change = await store.applyRemote({ visits: [{ ...v, visit_id: '01KZZZZZZZZZZZZZZZZZZZZZZZ', updated_at: '2099-01-01T00:00:00.000Z' }] });
    expect(change.newVisits).toHaveLength(1);
  });

  it('the sync engine drains the outbox into the demo server', async () => {
    await store.initStore({ ns: 'demo', adapter: demo() });
    await until(() => !store.getState().sync.syncing);
    const hotel = [...store.getState().hotels.values()][0];
    const v = await store.upsertVisit({ hotel_id: hotel.hotel_id, date: '2026-09-30', visit_type: 'Pool day' });
    await until(() => store.getState().sync.pending === 0);
    const server = await demo().bootstrap();
    expect(server.visits.find((x) => x.visit_id === v.visit_id)?.visit_type).toBe('Pool day');
  });

  it('keeps writes queued while offline and flushes when back online', async () => {
    await store.initStore({ ns: 'demo', adapter: demo() });
    await until(() => !store.getState().sync.syncing);
    online = false;
    window.dispatchEvent(new Event('offline'));
    const hotel = [...store.getState().hotels.values()][0];
    for (let i = 0; i < 3; i++) await store.upsertVisit({ hotel_id: hotel.hotel_id, date: `2026-09-2${i}`, visit_type: 'Dayuse' });
    await new Promise((r) => setTimeout(r, 80));
    expect(await (await openDb('demo')).count('outbox')).toBe(3);
    expect(store.getState().sync.online).toBe(false);
    online = true;
    window.dispatchEvent(new Event('online'));
    await until(async () => (await (await openDb('demo')).count('outbox')) === 0);
    expect((await demo().bootstrap()).visits).toHaveLength(15);
  });

  it('demo and live namespaces never share rows', async () => {
    await store.initStore({ ns: 'demo', adapter: demo(), startSync: false });
    expect(store.getState().visits.size).toBe(12);
    setDevice('connection', { apiUrl: 'https://script.google.com/macros/s/x/exec', key: 'k', connectedAt: null, lastSyncAt: null });
    // No real network in unit tests: the Sheet is unreachable.
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    await store.initStore({ ns: 'live', startSync: false });
    vi.unstubAllGlobals();
    const s = store.getState();
    expect(s.ns).toBe('live');
    expect(s.visits.size).toBe(0);
    // The Sheet can't be reached; the cache still renders.
    expect(s.ready).toBe(true);
    expect(s.sync.error).toBe('unreachable');
  });

  it('clearDemo empties the demo diary and resetDemo re-seeds it', async () => {
    await store.initStore({ ns: 'demo', startSync: false });
    await store.clearDemo();
    expect(store.getState().visits.size).toBe(0);
    await store.resetDemo();
    expect(store.getState().visits.size).toBe(12);
  });

  it('markLetterRead sets read_at once', async () => {
    await store.initStore({ ns: 'demo', adapter: demo(), startSync: false });
    const letter = [...store.getState().letters.values()][0];
    expect(letter.read_at).toBeNull();
    await store.markLetterRead(letter.letter_id);
    const read = store.getState().letters.get(letter.letter_id)!.read_at;
    expect(read).toBeTruthy();
    await store.markLetterRead(letter.letter_id);
    expect(store.getState().letters.get(letter.letter_id)!.read_at).toBe(read);
  });

  it('drafts round-trip', async () => {
    await store.initStore({ ns: 'demo', adapter: demo(), startSync: false });
    await store.saveDraft('add-stay', { step: 2 });
    expect((await store.loadDraft<{ step: number }>('add-stay'))?.data.step).toBe(2);
    await store.deleteDraft('add-stay');
    expect(await store.loadDraft('add-stay')).toBeNull();
  });
});
