import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdapterError, type DataAdapter } from '@/data/adapters/types';
import { setDevice, resetDevice } from '@/data/device';
import {
  flush,
  onArrival,
  opEntity,
  POLL_INTERVAL_MS,
  pull,
  startSync,
  stopSync,
  syncNow,
  withOverlap,
  type RemoteChange,
  type SyncContext,
  type SyncState,
} from '@/data/sync';
import type { OutboxOp, Snapshot, Visit } from '@/data/types';

const EMPTY: Snapshot = { hotels: [], visits: [], photos: [], wishes: [], places: [], letters: [], settings: {}, serverTime: '2026-09-30T12:00:00.000Z' };

function visit(id: string, extra: Partial<Visit> = {}): Visit {
  return {
    visit_id: id, hotel_id: 'H1', date: '2026-06-19', check_in: null, check_out: null, nights: 0, visit_type: 'Dayuse', booked_via: null, note: null,
    favourite_moment: null, mood: null, rating_nirsh: null, rating_shady: null, picked_by: null, added_by: 'nirsh', photo_ids_json: null,
    created_at: '2026-09-30T00:00:00.000Z', updated_at: '2026-09-30T00:00:00.000Z', deleted: false, ...extra,
  };
}

const op = (id: string, v: Visit, created: string): OutboxOp => ({ op_id: id, action: 'upsertVisit', payload: v, created_at: created, attempts: 0 });

function harness(adapter: Partial<DataAdapter>, ops: OutboxOp[] = []) {
  const outbox = new Map(ops.map((o) => [o.op_id, o]));
  let since: string | null = null;
  const state: Partial<SyncState> = {};
  const applied: RemoteChange[] = [];
  const full: DataAdapter = {
    kind: 'sheets',
    ping: async () => ({ ok: true }),
    bootstrap: async () => EMPTY,
    changes: async () => EMPTY,
    apply: async () => ({ ok: true }),
    getPhoto: async () => new Blob(),
    geocode: async () => [],
    ...adapter,
  };
  const ctx: SyncContext = {
    adapter: full,
    listOutbox: async () => [...outbox.values()],
    removeOp: async (id) => void outbox.delete(id),
    updateOp: async (o) => void outbox.set(o.op_id, o),
    applyRemote: async (snap, source) => {
      const change: RemoteChange = { hotels: snap.hotels ?? [], visits: snap.visits ?? [], newVisits: snap.visits ?? [], photos: [], wishes: [], places: [], letters: [], settings: null, source };
      applied.push(change);
      return change;
    },
    getSince: async () => since,
    setSince: async (s) => void (since = s),
    setSyncState: (p) => Object.assign(state, p),
  };
  return { ctx, outbox, state, applied, getSince: () => since, setSince: (s: string) => (since = s) };
}

beforeEach(() => {
  resetDevice();
  setDevice('me', 'nirsh');
});
afterEach(() => {
  stopSync();
  vi.useRealTimers();
});

describe('helpers', () => {
  it('withOverlap subtracts the window', () => {
    expect(withOverlap('2026-09-30T12:02:00.000Z', 120_000)).toBe('2026-09-30T12:00:00.000Z');
    expect(withOverlap('garbage')).toBe('garbage');
  });
  it('opEntity groups visit upserts and deletes', () => {
    expect(opEntity(op('a', visit('V1'), ''))).toBe('visit:V1');
    expect(opEntity({ op_id: 'b', action: 'deleteVisit', payload: { visit_id: 'V1', deleted: true, updated_at: '' }, created_at: '', attempts: 0 })).toBe('visit:V1');
  });
});

describe('flush', () => {
  it('pushes oldest first and removes each op before merging its echo', async () => {
    const order: string[] = [];
    const h = harness({
      apply: async (o) => {
        order.push(o.op_id);
        return { ok: true, applied: { visits: [(o as Extract<OutboxOp, { action: 'upsertVisit' }>).payload] } };
      },
    }, [op('2', visit('V2'), '2026-09-30T00:00:02Z'), op('1', visit('V1'), '2026-09-30T00:00:01Z')]);
    startSync(h.ctx, { initialSync: false });
    await flush();
    expect(order).toEqual(['1', '2']);
    expect(h.outbox.size).toBe(0);
    expect(h.applied.map((c) => c.source)).toEqual(['echo', 'echo']);
  });

  it('a per-op server error blocks only that entity', async () => {
    const pushed: string[] = [];
    const h = harness({
      apply: async (o) => {
        if (o.op_id === 'a1') throw new AdapterError('server', 'bad row');
        pushed.push(o.op_id);
        return { ok: true };
      },
    }, [op('a1', visit('A'), '1'), op('a2', visit('A'), '2'), op('b1', visit('B'), '3')]);
    startSync(h.ctx, { initialSync: false });
    await flush();
    expect(pushed).toEqual(['b1']);
    expect([...h.outbox.keys()].sort()).toEqual(['a1', 'a2']);
    expect(h.outbox.get('a1')?.attempts).toBe(1);
    expect(h.state.error).toBe('server');
  });

  it('a transport error stops the pass and keeps everything', async () => {
    const h = harness({ apply: async () => { throw new AdapterError('network', 'offline'); } }, [op('1', visit('A'), '1'), op('2', visit('B'), '2')]);
    startSync(h.ctx, { initialSync: false });
    await flush();
    expect(h.outbox.size).toBe(2);
    expect(h.outbox.get('2')?.attempts).toBe(0);
  });

  it('a conflict drops the op (the server copy wins on the next pull)', async () => {
    const h = harness({ apply: async () => { throw new AdapterError('conflict'); } }, [op('1', visit('A'), '1')]);
    startSync(h.ctx, { initialSync: false });
    await flush();
    expect(h.outbox.size).toBe(0);
  });

  it('repeated not_apps_script flags the link as broken; a good sync clears it', async () => {
    let broken = true;
    const h = harness({
      changes: async () => { if (broken) throw new AdapterError('not_apps_script'); return EMPTY; },
      bootstrap: async () => { if (broken) throw new AdapterError('not_apps_script'); return EMPTY; },
    });
    startSync(h.ctx, { initialSync: false });
    await syncNow();
    expect(h.state.error).toBeNull();
    await syncNow();
    expect(h.state.error).toBe('unreachable');
    broken = false;
    await syncNow();
    expect(h.state.error).toBeNull();
    expect(h.state.lastSyncAt).toBeTruthy();
  });
});

describe('pull', () => {
  it('bootstraps first, then asks for changes with the overlap window, never moving the watermark back', async () => {
    const seen: string[] = [];
    let serverTime = '2026-09-30T12:00:00.000Z';
    const h = harness({
      bootstrap: async () => ({ ...EMPTY, serverTime }),
      changes: async (since) => {
        seen.push(since);
        return { ...EMPTY, serverTime };
      },
    });
    startSync(h.ctx, { initialSync: false });
    await pull();
    expect(h.getSince()).toBe('2026-09-30T12:00:00.000Z');
    serverTime = '2026-09-30T12:05:00.000Z';
    await pull();
    expect(seen[0]).toBe('2026-09-30T11:58:00.000Z');
    expect(h.getSince()).toBe('2026-09-30T12:05:00.000Z');
    serverTime = '2026-09-30T12:01:00.000Z';
    await pull();
    expect(h.getSince()).toBe('2026-09-30T12:05:00.000Z');
  });

  it('emits an arrival for stays the other person added, not for mine', async () => {
    const h = harness({ bootstrap: async () => ({ ...EMPTY, visits: [visit('MINE'), visit('HERS', { added_by: 'shady' })] }) });
    const got: string[] = [];
    const off = onArrival((a) => got.push(a.visitId));
    startSync(h.ctx, { initialSync: false });
    await pull();
    off();
    expect(got).toEqual(['HERS']);
  });
});

describe('polling', () => {
  it('polls every 20 s while visible and pauses while hidden', async () => {
    vi.useFakeTimers();
    let pulls = 0;
    const h = harness({ changes: async () => { pulls++; return EMPTY; } });
    h.setSince('2026-09-30T12:00:00.000Z');
    startSync(h.ctx, { initialSync: false });
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10);
    expect(pulls).toBe(1);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10);
    expect(pulls).toBe(2);
    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(pulls).toBe(2);
    vis.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(50);
    expect(pulls).toBe(3);
    vis.mockRestore();
  });

  it('pulls on focus', async () => {
    let pulls = 0;
    const h = harness({ changes: async () => { pulls++; return EMPTY; } });
    h.setSince('2026-09-30T12:00:00.000Z');
    startSync(h.ctx, { initialSync: false });
    window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(pulls).toBe(1));
  });
});
