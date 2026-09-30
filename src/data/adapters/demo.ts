/**
 * Demo adapter: a pretend server that lives in its own IndexedDB (`suite-nothings-demo-server`),
 * seeded from ../seed.ts, with a small simulated network delay. Honours `navigator.onLine`
 * (throws `network` while offline) so offline/outbox flows can be exercised without Google.
 */
import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { buildSeed } from '../seed';
import type { Hotel, Letter, OutboxOp, Photo, SettingsMap, Snapshot, Visit, Wish } from '../types';
import { AdapterError, type ApplyResult, type DataAdapter } from './types';

type Table = 'hotels' | 'visits' | 'photos' | 'wishes' | 'letters';
interface Row {
  key: string; // `${table}:${id}`
  table: Table;
  updated_at: string;
  row: Hotel | Visit | Photo | Wish | Letter;
}
interface ServerDB extends DBSchema {
  rows: { key: string; value: Row; indexes: { by_table: Table } };
  kv: { key: string; value: { key: string; value: unknown } };
}

export const DEMO_SERVER_DB = 'suite-nothings-demo-server';
export const DEMO_VERSION = 'demo-1';

let dbp: Promise<IDBPDatabase<ServerDB>> | null = null;
function db() {
  dbp ??= openDB<ServerDB>(DEMO_SERVER_DB, 1, {
    upgrade(d) {
      d.createObjectStore('rows', { keyPath: 'key' }).createIndex('by_table', 'table');
      d.createObjectStore('kv', { keyPath: 'key' });
    },
    blocking() {
      void dbp?.then((d) => d.close());
      dbp = null;
    },
  });
  return dbp;
}

const idOf = (table: Table, row: Row['row']): string => {
  switch (table) {
    case 'hotels':
      return (row as Hotel).hotel_id;
    case 'visits':
      return (row as Visit).visit_id;
    case 'photos':
      return (row as Photo).photo_id;
    case 'wishes':
      return (row as Wish).wish_id;
    case 'letters':
      return (row as Letter).letter_id;
  }
};

async function writeSnapshot(snap: Snapshot) {
  const d = await db();
  const tx = d.transaction(['rows', 'kv'], 'readwrite');
  const tables: [Table, Row['row'][]][] = [
    ['hotels', snap.hotels],
    ['visits', snap.visits],
    ['photos', snap.photos],
    ['wishes', snap.wishes],
    ['letters', snap.letters],
  ];
  for (const [table, rows] of tables) {
    for (const row of rows) void tx.objectStore('rows').put({ key: `${table}:${idOf(table, row)}`, table, updated_at: row.updated_at, row });
  }
  void tx.objectStore('kv').put({ key: 'settings', value: snap.settings });
  void tx.objectStore('kv').put({ key: 'seeded', value: true });
  await tx.done;
}

async function ensureSeeded(seed: () => Snapshot) {
  const d = await db();
  if ((await d.get('kv', 'seeded'))?.value) return;
  await writeSnapshot(seed());
}

async function readAll(since?: string): Promise<Snapshot> {
  const d = await db();
  const rows = await d.getAll('rows');
  const pick = <T,>(t: Table) => rows.filter((r) => r.table === t && (!since || r.updated_at > since)).map((r) => r.row as T);
  const settings = ((await d.get('kv', 'settings'))?.value ?? {}) as Partial<SettingsMap>;
  const includeSettings = !since || (settings.updated_at ?? '') > since;
  return {
    hotels: pick<Hotel>('hotels'),
    visits: pick<Visit>('visits'),
    photos: pick<Photo>('photos'),
    wishes: pick<Wish>('wishes'),
    letters: pick<Letter>('letters'),
    settings: includeSettings ? settings : {},
    serverTime: new Date().toISOString(),
  };
}

/** Last-write-wins upsert. Returns the row the server holds afterwards. */
async function upsert<T extends Row['row']>(table: Table, row: T): Promise<T> {
  const d = await db();
  const key = `${table}:${idOf(table, row)}`;
  const tx = d.transaction('rows', 'readwrite');
  const existing = await tx.store.get(key);
  if (existing && existing.updated_at > row.updated_at) {
    await tx.done;
    return existing.row as T;
  }
  await tx.store.put({ key, table, updated_at: row.updated_at, row });
  await tx.done;
  return row;
}

export interface DemoAdapterOptions {
  /** Simulated round-trip in ms (default 220). */
  latencyMs?: number;
  seed?: () => Snapshot;
}

/** Wipe the demo server and re-seed on next bootstrap. */
export async function resetDemoServer(): Promise<void> {
  const d = await dbp?.catch(() => null);
  d?.close();
  dbp = null;
  await deleteDB(DEMO_SERVER_DB);
}

/** Wipe the demo server and mark it seeded-but-empty (Settings → Clear demo data). */
export async function clearDemoServer(): Promise<void> {
  await resetDemoServer();
  const d = await db();
  await d.put('kv', { key: 'seeded', value: true });
}

export function createDemoAdapter(opts: DemoAdapterOptions = {}): DataAdapter {
  const latency = opts.latencyMs ?? 220;
  const seed = opts.seed ?? (() => buildSeed());
  const net = async () => {
    if (latency > 0) await new Promise((r) => setTimeout(r, latency * (0.6 + Math.random() * 0.8)));
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AdapterError('network', 'Offline');
  };

  return {
    kind: 'demo',
    async ping() {
      await net();
      return { ok: true, version: DEMO_VERSION };
    },
    async bootstrap() {
      await net();
      await ensureSeeded(seed);
      return readAll();
    },
    async changes(sinceIso) {
      await net();
      await ensureSeeded(seed);
      return readAll(sinceIso);
    },
    async apply(op: OutboxOp): Promise<ApplyResult> {
      await net();
      await ensureSeeded(seed);
      const serverTime = new Date().toISOString();
      switch (op.action) {
        case 'upsertHotel':
          return { ok: true, applied: { hotels: [await upsert('hotels', op.payload)] }, serverTime };
        case 'upsertVisit':
          return { ok: true, applied: { visits: [await upsert('visits', op.payload)] }, serverTime };
        case 'deleteVisit': {
          const d = await db();
          const cur = (await d.get('rows', `visits:${op.payload.visit_id}`))?.row as Visit | undefined;
          if (!cur) return { ok: true, serverTime };
          const next = await upsert('visits', { ...cur, deleted: op.payload.deleted, updated_at: op.payload.updated_at });
          return { ok: true, applied: { visits: [next] }, serverTime };
        }
        case 'uploadPhoto': {
          const photo: Photo = {
            ...op.payload.photo,
            thumb_file_id: op.payload.thumb_key,
            full_file_id: op.payload.full_key,
          };
          const saved = await upsert('photos', photo);
          return { ok: true, applied: { photos: [saved] }, fileIds: { thumb_file_id: saved.thumb_file_id, full_file_id: saved.full_file_id }, serverTime };
        }
        case 'upsertWish':
          return { ok: true, applied: { wishes: [await upsert('wishes', op.payload)] }, serverTime };
        case 'upsertLetter':
          return { ok: true, applied: { letters: [await upsert('letters', op.payload)] }, serverTime };
        case 'markLetterRead': {
          const d = await db();
          const cur = (await d.get('rows', `letters:${op.payload.letter_id}`))?.row as Letter | undefined;
          if (!cur) return { ok: true, serverTime };
          const next = await upsert('letters', { ...cur, read_at: op.payload.read_at, updated_at: op.payload.read_at });
          return { ok: true, applied: { letters: [next] }, serverTime };
        }
        case 'updateSettings': {
          const d = await db();
          const cur = ((await d.get('kv', 'settings'))?.value ?? {}) as Partial<SettingsMap>;
          const incoming = op.payload.updated_at ?? serverTime;
          const next = (cur.updated_at ?? '') > incoming ? cur : { ...cur, ...op.payload, updated_at: incoming };
          await d.put('kv', { key: 'settings', value: next });
          return { ok: true, applied: { settings: next }, serverTime };
        }
      }
    },
    async getPhoto() {
      await net();
      // Demo photos only ever live on this device (photoBlobs store).
      throw new AdapterError('server', 'Demo photos stay on this device');
    },
    async geocode() {
      return [];
    },
  };
}
