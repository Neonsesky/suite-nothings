/**
 * IndexedDB schema (via idb). One database per namespace so demo rows never leak into live:
 * `suite-nothings-demo` and `suite-nothings-live`. Device prefs live in ./device.ts instead.
 *
 * Migrations: bump DB_VERSION and append a step to MIGRATIONS; each step runs once, in order.
 */
import { deleteDB, openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type { Hotel, Letter, Namespace, OutboxOp, Photo, PhotoBlob, SettingsMap, Visit, Wish } from './types';

export interface DraftRecord {
  id: string; // e.g. "add-stay"
  data: unknown;
  updated_at: string;
}

export interface MetaRecord {
  key: string; // e.g. "lastSyncAt", "since", "seeded"
  value: unknown;
}

export interface SnDB extends DBSchema {
  hotels: { key: string; value: Hotel };
  visits: { key: string; value: Visit; indexes: { by_hotel: string; by_date: string } };
  photos: { key: string; value: Photo; indexes: { by_visit: string } };
  photoBlobs: { key: string; value: PhotoBlob; indexes: { by_photo: string } };
  wishes: { key: string; value: Wish };
  letters: { key: string; value: Letter };
  /** Single row keyed "settings". */
  settings: { key: string; value: SettingsMap & { key: 'settings' } };
  outbox: { key: string; value: OutboxOp; indexes: { by_created: string } };
  drafts: { key: string; value: DraftRecord };
  meta: { key: string; value: MetaRecord };
}

export type SnStore = StoreNames<SnDB>;
export type SnDatabase = IDBPDatabase<SnDB>;

export const DB_VERSION = 1;
export const DATA_STORES = ['hotels', 'visits', 'photos', 'photoBlobs', 'wishes', 'letters', 'settings', 'outbox', 'drafts', 'meta'] as const satisfies readonly SnStore[];

type Migration = (db: SnDatabase, tx: IDBPTransaction<SnDB, SnStore[], 'versionchange'>) => void;

const MIGRATIONS: Migration[] = [
  // v1: initial schema
  (db) => {
    db.createObjectStore('hotels', { keyPath: 'hotel_id' });
    const visits = db.createObjectStore('visits', { keyPath: 'visit_id' });
    visits.createIndex('by_hotel', 'hotel_id');
    visits.createIndex('by_date', 'date');
    const photos = db.createObjectStore('photos', { keyPath: 'photo_id' });
    photos.createIndex('by_visit', 'visit_id');
    const blobs = db.createObjectStore('photoBlobs', { keyPath: 'key' });
    blobs.createIndex('by_photo', 'photo_id');
    db.createObjectStore('wishes', { keyPath: 'wish_id' });
    db.createObjectStore('letters', { keyPath: 'letter_id' });
    db.createObjectStore('settings', { keyPath: 'key' });
    const outbox = db.createObjectStore('outbox', { keyPath: 'op_id' });
    outbox.createIndex('by_created', 'created_at');
    db.createObjectStore('drafts', { keyPath: 'id' });
    db.createObjectStore('meta', { keyPath: 'key' });
  },
];

export function dbName(ns: Namespace): string {
  return `suite-nothings-${ns}`;
}

const open = new Map<Namespace, Promise<SnDatabase>>();

/** Open (and migrate) the namespace's database. Cached per namespace. */
export function openDb(ns: Namespace): Promise<SnDatabase> {
  let p = open.get(ns);
  if (!p) {
    p = openDB<SnDB>(dbName(ns), DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        for (let v = oldVersion; v < DB_VERSION; v++) MIGRATIONS[v](db, tx);
      },
      blocking() {
        // Another tab wants to upgrade: close so it can proceed.
        void p?.then((db) => db.close());
        open.delete(ns);
      },
    });
    open.set(ns, p);
    p.catch(() => open.delete(ns));
  }
  return p;
}

export async function closeDb(ns: Namespace): Promise<void> {
  const p = open.get(ns);
  open.delete(ns);
  if (p) (await p.catch(() => null))?.close();
}

/** Delete a namespace's database entirely (used by clearDemo/resetDemo). */
export async function deleteDb(ns: Namespace): Promise<void> {
  await closeDb(ns);
  await deleteDB(dbName(ns));
}

export async function getMeta<T>(db: SnDatabase, key: string): Promise<T | undefined> {
  return (await db.get('meta', key))?.value as T | undefined;
}

export async function setMeta(db: SnDatabase, key: string, value: unknown): Promise<void> {
  await db.put('meta', { key, value });
}
