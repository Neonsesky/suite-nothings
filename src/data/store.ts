/**
 * Reactive store over IndexedDB (useSyncExternalStore). IndexedDB is the UI's source of truth.
 *
 * Every write: IndexedDB (row + outbox op, one transaction) → in-memory state → sync.kick().
 * Writes are idempotent upserts by id with last-write-wins on `updated_at`; deletes are soft.
 * Remote rows merge with LWW and never overwrite a row that still has a pending local op.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { PersonId } from '@/config/couple';
import { ulid } from '@/lib/ulid';
import { toast } from '@/lib/toast';
import { clearDemoServer, createDemoAdapter, resetDemoServer } from './adapters/demo';
import { createSheetsAdapter } from './adapters/sheets';
import type { AdapterKind, ApplyResult, DataAdapter } from './adapters/types';
import { deleteDb, getMeta, openDb, setMeta, type DraftRecord, type SnDatabase } from './db';
import { getDevice, onDeviceChange, setDevice } from './device';
import { defaultSettings } from './seed';
import { buildStays, filterStays, parseJsonArray, type StayFilter } from './stays';
import * as sync from './sync';
import type { RemoteChange, SyncState } from './sync';
import type { ConnectionConfig, Hotel, Letter, Namespace, OutboxOp, OutboxAction, OutboxPayload, Photo, PhotoBlob, Place, SettingsMap, Snapshot, Stay, Visit, Wish } from './types';

export type { StayFilter } from './stays';
export type { SyncState } from './sync';

// ───────────────────────────── state ─────────────────────────────

export interface StoreState {
  /** False until the first render-able data is in memory. */
  ready: boolean;
  ns: Namespace;
  adapterKind: AdapterKind;
  hotels: ReadonlyMap<string, Hotel>;
  visits: ReadonlyMap<string, Visit>;
  photos: ReadonlyMap<string, Photo>;
  wishes: ReadonlyMap<string, Wish>;
  places: ReadonlyMap<string, Place>;
  letters: ReadonlyMap<string, Letter>;
  settings: SettingsMap;
  sync: SyncState;
  /** Fatal boot error copy (IndexedDB unavailable etc.). */
  bootError: string | null;
}

const EMPTY_SYNC: SyncState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  pending: 0,
  syncing: false,
  lastSyncAt: null,
  error: null,
  errorMessage: null,
};

function emptyState(ns: Namespace): StoreState {
  return {
    ready: false,
    ns,
    adapterKind: ns === 'demo' ? 'demo' : 'sheets',
    hotels: new Map(),
    visits: new Map(),
    photos: new Map(),
    wishes: new Map(),
    places: new Map(),
    letters: new Map(),
    settings: defaultSettings(),
    sync: EMPTY_SYNC,
    bootError: null,
  };
}

let state: StoreState = emptyState('demo');
const listeners = new Set<() => void>();
let db: SnDatabase | null = null;
let adapter: DataAdapter | null = null;
let booting: Promise<void> | null = null;
let generation = 0;

function setState(patch: Partial<StoreState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getState(): StoreState {
  return state;
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The adapter currently in use (demo or sheets). */
export function getAdapter(): DataAdapter {
  if (!adapter) throw new Error('Store not initialised: call initStore() first');
  return adapter;
}

// ───────────────────────────── boot ─────────────────────────────

/** Which namespace this device should use: explicit choice, else live when connected, else demo. */
export function resolveNamespace(): Namespace {
  const mode = getDevice('mode');
  if (mode) return mode === 'live' && !getDevice('connection') ? 'demo' : mode;
  return getDevice('connection') ? 'live' : 'demo';
}

/** Factory for the Sheets adapter; w1-backend may call this at startup to inject theirs. */
let sheetsFactory: (config: ConnectionConfig) => DataAdapter = createSheetsAdapter;
export function setSheetsAdapterFactory(factory: (config: ConnectionConfig) => DataAdapter): void {
  sheetsFactory = factory;
}

function makeAdapter(ns: Namespace): DataAdapter {
  if (ns === 'demo') return createDemoAdapter();
  const config = getDevice('connection');
  if (!config) return createDemoAdapter();
  return sheetsFactory(config);
}

export interface InitOptions {
  ns?: Namespace;
  /** Inject an adapter (tests). */
  adapter?: DataAdapter;
  /** Start the sync engine (default true). */
  startSync?: boolean;
}

/**
 * Open the namespace DB, load everything into memory, bootstrap from the adapter when the DB has
 * never been filled, and start sync. Safe to call again: re-initialises for the current namespace.
 */
export function initStore(opts: InitOptions = {}): Promise<void> {
  const gen = ++generation;
  const ns = opts.ns ?? resolveNamespace();
  booting = (async () => {
    sync.stopSync();
    const prevSync = state.sync;
    state = { ...emptyState(ns), sync: { ...EMPTY_SYNC, online: prevSync.online } };
    listeners.forEach((l) => l());
    try {
      db = await openDb(ns);
    } catch (e) {
      setState({ ready: true, bootError: "We couldn't open this phone's storage. Private browsing can block it; try a normal tab." });
      console.error(e);
      return;
    }
    if (gen !== generation) return;
    adapter = opts.adapter ?? makeAdapter(ns);
    await loadFromDb(db);
    if (gen !== generation) return;
    const bootstrapped = await getMeta<boolean>(db, 'bootstrapped');
    if (!bootstrapped) {
      try {
        const snap = await adapter.bootstrap();
        if (gen !== generation) return;
        await applyRemote(snap, 'pull');
        await setMeta(db, 'since', snap.serverTime);
        await setMeta(db, 'bootstrapped', true);
      } catch (e) {
        // Live mode with no connection yet: render the (empty) cache; sync retries.
        setState({ sync: { ...state.sync, error: 'unreachable', errorMessage: e instanceof Error ? e.message : String(e) } });
      }
    }
    setState({ ready: true, adapterKind: adapter.kind });
    if (opts.startSync ?? true) sync.startSync(syncContext(), { initialSync: bootstrapped === true });
    else setState({ sync: { ...state.sync, pending: (await db.count('outbox')) } });
  })();
  return booting;
}

/** Resolves once the current init has finished. */
export function whenReady(): Promise<void> {
  return booting ?? initStore();
}

async function loadFromDb(d: SnDatabase) {
  const [hotels, visits, photos, wishes, places, letters, settingsRow, pending] = await Promise.all([
    d.getAll('hotels'),
    d.getAll('visits'),
    d.getAll('photos'),
    d.getAll('wishes'),
    d.getAll('places'),
    d.getAll('letters'),
    d.get('settings', 'settings'),
    d.count('outbox'),
  ]);
  let settings = defaultSettings();
  if (settingsRow) {
    const { key: _k, ...rest } = settingsRow;
    settings = { ...settings, ...rest };
  }
  setState({
    hotels: new Map(hotels.map((h) => [h.hotel_id, h])),
    visits: new Map(visits.map((v) => [v.visit_id, v])),
    photos: new Map(photos.map((p) => [p.photo_id, p])),
    wishes: new Map(wishes.map((w) => [w.wish_id, w])),
    places: new Map(places.map((p) => [p.place_id, p])),
    letters: new Map(letters.map((l) => [l.letter_id, l])),
    settings,
    sync: { ...state.sync, pending },
    ready: hotels.length > 0 || visits.length > 0 || state.ready,
  });
}

function requireDb(): SnDatabase {
  if (!db) throw new Error('Store not initialised: call initStore() first');
  return db;
}

// ───────────────────────────── sync plumbing ─────────────────────────────

/** Ids of entities with a pending local op, so remote rows don't clobber unsent edits. */
async function pendingIds(): Promise<Set<string>> {
  const ops = await requireDb().getAll('outbox');
  const ids = new Set<string>();
  for (const op of ops) {
    switch (op.action) {
      case 'upsertHotel':
        ids.add(op.payload.hotel_id);
        break;
      case 'upsertVisit':
        ids.add(op.payload.visit_id);
        break;
      case 'deleteVisit':
        ids.add(op.payload.visit_id);
        break;
      case 'uploadPhoto':
        ids.add(op.payload.photo.photo_id);
        break;
      case 'upsertWish':
        ids.add(op.payload.wish_id);
        break;
      case 'upsertPlace':
        ids.add(op.payload.place_id);
        break;
      case 'markLetterRead':
        ids.add(op.payload.letter_id);
        break;
      case 'updateSettings':
        ids.add('settings');
        break;
    }
  }
  return ids;
}

const newer = (incoming: { updated_at: string }, current?: { updated_at: string }) =>
  !current || incoming.updated_at > current.updated_at;

/** Merge a (partial) snapshot with LWW; persists and updates memory; returns what changed. */
export async function applyRemote(snap: Partial<Snapshot>, source: RemoteChange['source'] = 'pull'): Promise<RemoteChange> {
  const d = requireDb();
  const skip = await pendingIds();
  const change: RemoteChange = { hotels: [], visits: [], newVisits: [], photos: [], wishes: [], places: [], letters: [], settings: null, source };
  const hotels = new Map(state.hotels);
  const visits = new Map(state.visits);
  const photos = new Map(state.photos);
  const wishes = new Map(state.wishes);
  const places = new Map(state.places);
  const letters = new Map(state.letters);
  let settings = state.settings;

  const tx = d.transaction(['hotels', 'visits', 'photos', 'wishes', 'places', 'letters', 'settings'], 'readwrite');
  for (const h of snap.hotels ?? []) {
    if (skip.has(h.hotel_id) || !newer(h, hotels.get(h.hotel_id))) continue;
    hotels.set(h.hotel_id, h);
    change.hotels.push(h);
    void tx.objectStore('hotels').put(h);
  }
  for (const v of snap.visits ?? []) {
    if (skip.has(v.visit_id)) continue;
    const cur = visits.get(v.visit_id);
    if (!newer(v, cur)) continue;
    if (!cur && !v.deleted) change.newVisits.push(v);
    visits.set(v.visit_id, v);
    change.visits.push(v);
    void tx.objectStore('visits').put(v);
  }
  for (const p of snap.photos ?? []) {
    if (skip.has(p.photo_id) || !newer(p, photos.get(p.photo_id))) continue;
    photos.set(p.photo_id, p);
    change.photos.push(p);
    void tx.objectStore('photos').put(p);
  }
  for (const w of snap.wishes ?? []) {
    if (skip.has(w.wish_id) || !newer(w, wishes.get(w.wish_id))) continue;
    wishes.set(w.wish_id, w);
    change.wishes.push(w);
    void tx.objectStore('wishes').put(w);
  }
  for (const p of snap.places ?? []) {
    if (skip.has(p.place_id) || !newer(p, places.get(p.place_id))) continue;
    places.set(p.place_id, p);
    change.places.push(p);
    void tx.objectStore('places').put(p);
  }
  for (const l of snap.letters ?? []) {
    const cur = letters.get(l.letter_id);
    if (skip.has(l.letter_id) || !newer(l, cur)) continue;
    letters.set(l.letter_id, l);
    change.letters.push(l);
    void tx.objectStore('letters').put(l);
  }
  const s = snap.settings;
  if (s && Object.keys(s).length && !skip.has('settings') && (s.updated_at ?? '') > settings.updated_at) {
    settings = { ...settings, ...s } as SettingsMap;
    change.settings = s;
    void tx.objectStore('settings').put({ ...settings, key: 'settings' });
  }
  await tx.done;
  if (change.hotels.length || change.visits.length || change.photos.length || change.wishes.length || change.places.length || change.letters.length || change.settings) {
    setState({ hotels, visits, photos, wishes, places, letters, settings });
  }
  return change;
}

function syncContext(): sync.SyncContext {
  const d = requireDb();
  const a = getAdapter();
  return {
    adapter: a,
    listOutbox: () => d.getAll('outbox'),
    removeOp: (id) => d.delete('outbox', id),
    updateOp: async (op) => {
      await d.put('outbox', op);
    },
    applyRemote: (snap, source) => applyRemote(snap, source),
    onApplied: (op, result) => onApplied(op, result),
    getSince: async () => (await getMeta<string>(d, 'since')) ?? null,
    setSince: (iso) => setMeta(d, 'since', iso),
    setSyncState: (patch) => setState({ sync: { ...state.sync, ...patch } }),
  };
}

async function onApplied(op: OutboxOp, result: ApplyResult) {
  if (op.action !== 'uploadPhoto' || !result.fileIds) return;
  const cur = state.photos.get(op.payload.photo.photo_id);
  if (!cur) return;
  const next = { ...cur, ...result.fileIds };
  await requireDb().put('photos', next);
  setState({ photos: new Map(state.photos).set(next.photo_id, next) });
}

// ───────────────────────────── writes ─────────────────────────────

const nowIso = () => new Date().toISOString();

type RowStore = 'hotels' | 'visits' | 'photos' | 'wishes' | 'places' | 'letters';

/** Persist a row and its outbox op atomically, update memory, and nudge the sync engine. */
async function write<A extends OutboxAction>(storeName: RowStore | null, row: unknown, action: A, payload: OutboxPayload<A>): Promise<void> {
  const d = requireDb();
  const op = { op_id: ulid(), action, payload, created_at: nowIso(), attempts: 0 } as OutboxOp;
  const stores = storeName ? ([storeName, 'outbox'] as const) : (['settings', 'outbox'] as const);
  const tx = d.transaction(stores as unknown as ('outbox' | RowStore | 'settings')[], 'readwrite');
  if (storeName) void tx.objectStore(storeName).put(row as never);
  else void tx.objectStore('settings').put(row as never);
  void tx.objectStore('outbox').put(op);
  await tx.done;
  setState({ sync: { ...state.sync, pending: state.sync.pending + 1 } });
  sync.kick();
}

export type HotelInput = Partial<Hotel> & Pick<Hotel, 'name' | 'lat' | 'lng' | 'city' | 'country' | 'country_code'>;

/** Create or update a hotel. Missing fields keep their current values (or defaults). */
export async function upsertHotel(input: HotelInput): Promise<Hotel> {
  const now = nowIso();
  const cur = input.hotel_id ? state.hotels.get(input.hotel_id) : undefined;
  const hotel: Hotel = {
    brand: null,
    address: null,
    area: null,
    region: null,
    source: 'manual',
    osm_id: null,
    wikidata_id: null,
    website: null,
    phone: null,
    stars: null,
    price_level: null,
    description: null,
    description_source: null,
    amenities_json: null,
    cover_photo_id: null,
    enrichment_status: 'none',
    enriched_at: null,
    deleted: false,
    ...cur,
    ...input,
    country_code: input.country_code.toUpperCase(),
    hotel_id: input.hotel_id ?? ulid(),
    created_at: cur?.created_at ?? input.created_at ?? now,
    updated_at: now,
  };
  setState({ hotels: new Map(state.hotels).set(hotel.hotel_id, hotel) });
  await write('hotels', hotel, 'upsertHotel', hotel);
  return hotel;
}

export type VisitInput = Partial<Visit> & Pick<Visit, 'hotel_id' | 'date' | 'visit_type'>;

/** Create or update a visit. `added_by` defaults to the current person. */
export async function upsertVisit(input: VisitInput): Promise<Visit> {
  const now = nowIso();
  const cur = input.visit_id ? state.visits.get(input.visit_id) : undefined;
  const visit: Visit = {
    check_in: null,
    check_out: null,
    nights: 0,
    booked_via: null,
    note: null,
    favourite_moment: null,
    mood: null,
    rating_nirsh: null,
    rating_shady: null,
    picked_by: null,
    added_by: getDevice('me'),
    photo_ids_json: '[]',
    deleted: false,
    ...cur,
    ...input,
    visit_id: input.visit_id ?? ulid(),
    created_at: cur?.created_at ?? input.created_at ?? now,
    updated_at: now,
  };
  setState({ visits: new Map(state.visits).set(visit.visit_id, visit) });
  await write('visits', visit, 'upsertVisit', visit);
  return visit;
}

async function setVisitDeleted(visitId: string, deleted: boolean): Promise<void> {
  const cur = state.visits.get(visitId);
  if (!cur || cur.deleted === deleted) return;
  const visit = { ...cur, deleted, updated_at: nowIso() };
  setState({ visits: new Map(state.visits).set(visitId, visit) });
  await write('visits', visit, 'deleteVisit', { visit_id: visitId, deleted, updated_at: visit.updated_at });
}

/** Soft delete (sets `deleted: true`). Pair with undoDeleteVisit. */
export function softDeleteVisit(visitId: string): Promise<void> {
  return setVisitDeleted(visitId, true);
}

export function undoDeleteVisit(visitId: string): Promise<void> {
  return setVisitDeleted(visitId, false);
}

/** Soft delete + "Stay deleted" toast with Undo. */
export async function deleteVisitWithUndo(visitId: string): Promise<void> {
  await softDeleteVisit(visitId);
  toast.show({ id: `undo-${visitId}`, message: 'Stay deleted', action: { label: 'Undo', onClick: () => void undoDeleteVisit(visitId) } });
}

export type WishInput = Partial<Wish> & Pick<Wish, 'name'>;

export async function upsertWish(input: WishInput): Promise<Wish> {
  const now = nowIso();
  const cur = input.wish_id ? state.wishes.get(input.wish_id) : undefined;
  const wish: Wish = {
    lat: null,
    lng: null,
    city: null,
    country: null,
    note: null,
    added_by: getDevice('me'),
    priority: null,
    fulfilled_visit_id: null,
    deleted: false,
    ...cur,
    ...input,
    wish_id: input.wish_id ?? ulid(),
    created_at: cur?.created_at ?? now,
    updated_at: now,
  };
  setState({ wishes: new Map(state.wishes).set(wish.wish_id, wish) });
  await write('wishes', wish, 'upsertWish', wish);
  return wish;
}

export type PlaceInput = Partial<Place> & Pick<Place, 'title' | 'icon' | 'lat' | 'lng'>;

/** Create or update a custom place (a house, a restaurant, any point of interest we drop). */
export async function upsertPlace(input: PlaceInput): Promise<Place> {
  const now = nowIso();
  const cur = input.place_id ? state.places.get(input.place_id) : undefined;
  const place: Place = {
    note: null,
    tint: null,
    added_by: getDevice('me'),
    deleted: false,
    ...cur,
    ...input,
    place_id: input.place_id ?? ulid(),
    created_at: cur?.created_at ?? now,
    updated_at: now,
  };
  setState({ places: new Map(state.places).set(place.place_id, place) });
  await write('places', place, 'upsertPlace', place);
  return place;
}

/** Soft delete + "Place removed" toast with Undo. */
export async function deletePlaceWithUndo(placeId: string): Promise<void> {
  const cur = state.places.get(placeId);
  if (!cur) return;
  await upsertPlace({ ...cur, deleted: true });
  toast.show({
    id: `undo-place-${placeId}`,
    message: 'Place removed',
    action: { label: 'Undo', onClick: () => void upsertPlace({ ...cur, deleted: false }) },
  });
}

/** Sets `read_at` once (no-op if already read). */
export async function markLetterRead(letterId: string): Promise<void> {
  const cur = state.letters.get(letterId);
  if (!cur || cur.read_at) return;
  const read_at = nowIso();
  const letter = { ...cur, read_at, updated_at: read_at };
  setState({ letters: new Map(state.letters).set(letterId, letter) });
  await write('letters', letter, 'markLetterRead', { letter_id: letterId, read_at });
}

export type LetterInput = Partial<Letter> & Pick<Letter, 'title' | 'body_md' | 'to' | 'unlock_rule'>;

/** Create or update a letter (w1-shell: "Write a future note"). `from` defaults to me. */
export async function upsertLetter(input: LetterInput): Promise<Letter> {
  const now = nowIso();
  const cur = input.letter_id ? state.letters.get(input.letter_id) : undefined;
  const letter: Letter = {
    from: getDevice('me') ?? 'nirsh',
    written_at: now,
    read_at: null,
    ...cur,
    ...input,
    letter_id: input.letter_id ?? ulid(),
    created_at: cur?.created_at ?? now,
    updated_at: now,
  };
  setState({ letters: new Map(state.letters).set(letter.letter_id, letter) });
  await write('letters', letter, 'upsertLetter', letter);
  return letter;
}

export async function updateSettings(patch: Partial<Omit<SettingsMap, 'updated_at'>>): Promise<SettingsMap> {
  const settings: SettingsMap = { ...state.settings, ...patch, updated_at: nowIso() };
  setState({ settings });
  await write(null, { ...settings, key: 'settings' }, 'updateSettings', { ...patch, updated_at: settings.updated_at });
  return settings;
}

// ───────────────────────────── photos ─────────────────────────────

export interface ProcessedPhoto {
  thumb: Blob; // ~480px
  full: Blob; // ~1600px, EXIF stripped
  width: number;
  height: number;
  taken_at: string | null;
}

/** Image pipeline. w1-add-stay installs the real one (resize, EXIF) with setPhotoProcessor(). */
export type PhotoProcessor = (file: Blob) => Promise<ProcessedPhoto>;

const passthroughProcessor: PhotoProcessor = async (file) => {
  let width = 0;
  let height = 0;
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      width = bmp.width;
      height = bmp.height;
      bmp.close();
    } catch {
      // unreadable image: keep 0×0
    }
  }
  return { thumb: file, full: file, width, height, taken_at: null };
};

let photoProcessor: PhotoProcessor = passthroughProcessor;
export function setPhotoProcessor(p: PhotoProcessor): void {
  photoProcessor = p;
}

/** Process, store blobs locally, attach to the visit, and queue the upload. */
export async function addPhoto(visitId: string, file: Blob, opts: { caption?: string; processed?: ProcessedPhoto } = {}): Promise<Photo> {
  const d = requireDb();
  // `processed` skips the pipeline when the caller already resized the image (add-stay drafts).
  const processed = opts.processed ?? (await photoProcessor(file));
  const now = nowIso();
  const photo_id = ulid();
  const thumbKey = `${photo_id}:thumb`;
  const fullKey = `${photo_id}:full`;
  const photo: Photo = {
    photo_id,
    visit_id: visitId,
    thumb_file_id: null,
    full_file_id: null,
    width: processed.width,
    height: processed.height,
    taken_at: processed.taken_at,
    caption: opts.caption ?? null,
    created_at: now,
    updated_at: now,
    deleted: false,
  };
  const blobs: PhotoBlob[] = [
    { key: thumbKey, photo_id, size: 'thumb', blob: processed.thumb, mime: processed.thumb.type || 'image/jpeg' },
    { key: fullKey, photo_id, size: 'full', blob: processed.full, mime: processed.full.type || 'image/jpeg' },
  ];
  await putPhotoBlobs(d, blobs);
  setState({ photos: new Map(state.photos).set(photo_id, photo) });
  await write('photos', photo, 'uploadPhoto', { photo, thumb_key: thumbKey, full_key: fullKey });
  const visit = state.visits.get(visitId);
  if (visit) {
    const ids = parseJsonArray(visit.photo_ids_json);
    await upsertVisit({ ...visit, photo_ids_json: JSON.stringify([...ids, photo_id]) });
  }
  return photo;
}

/**
 * Edit the caption on a photo that was already saved (e.g. revisiting it in `?edit=` mode).
 * Queues the same idempotent `uploadPhoto` upsert `addPhoto` uses: the server replaces only the
 * row's fields and never re-uploads bytes once `thumb_file_id`/`full_file_id` are already set.
 */
export async function updatePhotoCaption(photoId: string, caption: string): Promise<Photo | undefined> {
  const photo = state.photos.get(photoId);
  if (!photo) return undefined;
  const next: Photo = { ...photo, caption: caption.trim() || null, updated_at: nowIso() };
  setState({ photos: new Map(state.photos).set(photoId, next) });
  await write('photos', next, 'uploadPhoto', { photo: next, thumb_key: `${photoId}:thumb`, full_key: `${photoId}:full` });
  return next;
}

/**
 * Some WebKit builds (private tabs, test runners) refuse Blobs in IndexedDB; store the bytes then.
 */
async function putPhotoBlobs(d: ReturnType<typeof requireDb>, blobs: PhotoBlob[]): Promise<void> {
  try {
    const tx = d.transaction('photoBlobs', 'readwrite');
    await Promise.all([...blobs.map((b) => tx.store.put(b)), tx.done]);
  } catch {
    const rows = await Promise.all(blobs.map(async (b) => ({ ...b, blob: undefined as unknown as Blob, bytes: await b.blob.arrayBuffer() })));
    const tx = d.transaction('photoBlobs', 'readwrite');
    rows.forEach((r) => void tx.store.put(r));
    await tx.done;
  }
}

/** The Blob of a stored photoBlobs row, whichever way it was stored. */
export function blobOf(row: PhotoBlob): Blob {
  return row.blob instanceof Blob ? row.blob : new Blob([row.bytes ?? new ArrayBuffer(0)], { type: row.mime });
}

/** Local blob for a photo, fetching (and caching) from the adapter when missing. */
export async function getPhotoBlob(photoId: string, size: 'thumb' | 'full' = 'thumb'): Promise<Blob | null> {
  const d = requireDb();
  const local = (await d.get('photoBlobs', `${photoId}:${size}`)) ?? (await d.get('photoBlobs', `${photoId}:${size === 'thumb' ? 'full' : 'thumb'}`));
  if (local) return blobOf(local);
  const photo = state.photos.get(photoId);
  const fileId = size === 'thumb' ? photo?.thumb_file_id ?? photo?.full_file_id : photo?.full_file_id ?? photo?.thumb_file_id;
  if (!fileId || !adapter) return null;
  try {
    const blob = await adapter.getPhoto(fileId);
    await putPhotoBlobs(d, [{ key: `${photoId}:${size}`, photo_id: photoId, size, blob, mime: blob.type || 'image/jpeg' }]);
    return blob;
  } catch {
    return null;
  }
}

/** Object URL for a photo (revoked on unmount). null while loading or when unavailable. */
export function usePhotoUrl(photoId: string | null | undefined, size: 'thumb' | 'full' = 'thumb'): string | null {
  const [url, setUrl] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!photoId) return;
    let alive = true;
    let objectUrl: string | null = null;
    void getPhotoBlob(photoId, size).then((blob) => {
      if (!alive || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl({ id: photoId, url: objectUrl });
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId, size]);
  return url && url.id === photoId ? url.url : null;
}

// ───────────────────────────── drafts ─────────────────────────────

export async function saveDraft(id: string, data: unknown): Promise<void> {
  await requireDb().put('drafts', { id, data, updated_at: nowIso() });
}
export async function loadDraft<T = unknown>(id: string): Promise<(Omit<DraftRecord, 'data'> & { data: T }) | null> {
  return ((await requireDb().get('drafts', id)) as (Omit<DraftRecord, 'data'> & { data: T }) | undefined) ?? null;
}
export async function deleteDraft(id: string): Promise<void> {
  await requireDb().delete('drafts', id);
}

/** Per-namespace local key/value (e.g. awarded milestones). Returns undefined before boot. */
export async function readMeta<T>(key: string): Promise<T | undefined> {
  return db ? getMeta<T>(db, key) : undefined;
}
export async function writeMeta(key: string, value: unknown): Promise<void> {
  if (db) await setMeta(db, key, value);
}

// ───────────────────────────── modes & device ─────────────────────────────

export function setMe(me: PersonId | null): void {
  setDevice('me', me);
}

/** Switch to demo data (separate DB; live data untouched). */
export async function activateDemo(): Promise<void> {
  setDevice('mode', 'demo');
  await initStore({ ns: 'demo' });
}

/** Save the connection and switch to the live namespace. The outbox there syncs once reachable. */
export async function activateLive(config: ConnectionConfig): Promise<void> {
  setDevice('connection', config);
  setDevice('mode', 'live');
  await initStore({ ns: 'live' });
}

/** Wipe demo data and re-seed it. */
export async function resetDemo(): Promise<void> {
  const wasDemo = state.ns === 'demo';
  sync.stopSync();
  await deleteDb('demo');
  await resetDemoServer();
  if (wasDemo) await initStore({ ns: 'demo' });
}

/** Remove all demo stays (leaves an empty demo diary). */
export async function clearDemo(): Promise<void> {
  const wasDemo = state.ns === 'demo';
  sync.stopSync();
  await deleteDb('demo');
  await clearDemoServer();
  if (wasDemo) await initStore({ ns: 'demo' });
}

// ───────────────────────────── export / import ─────────────────────────────

/** Everything in the current namespace (Settings → Download our data). */
export function exportData(): Snapshot {
  return {
    hotels: [...state.hotels.values()],
    visits: [...state.visits.values()],
    photos: [...state.photos.values()],
    wishes: [...state.wishes.values()],
    places: [...state.places.values()],
    letters: [...state.letters.values()],
    settings: state.settings,
    serverTime: nowIso(),
  };
}

/** Merge an export back in (LWW) and queue every newer row for sync. Returns rows imported. */
export async function importData(snap: Partial<Snapshot>): Promise<number> {
  let n = 0;
  for (const h of snap.hotels ?? []) {
    if (!newer(h, state.hotels.get(h.hotel_id))) continue;
    await upsertHotel({ ...h });
    n++;
  }
  for (const v of snap.visits ?? []) {
    if (!newer(v, state.visits.get(v.visit_id))) continue;
    await upsertVisit({ ...v });
    n++;
  }
  for (const w of snap.wishes ?? []) {
    if (!newer(w, state.wishes.get(w.wish_id))) continue;
    await upsertWish({ ...w });
    n++;
  }
  for (const p of snap.places ?? []) {
    if (!newer(p, state.places.get(p.place_id))) continue;
    await upsertPlace({ ...p });
    n++;
  }
  for (const l of snap.letters ?? []) {
    if (!newer(l, state.letters.get(l.letter_id))) continue;
    await upsertLetter({ ...l });
    n++;
  }
  if (snap.settings && newer({ updated_at: snap.settings.updated_at ?? '' }, state.settings)) {
    const { updated_at: _ignored, ...patch } = snap.settings;
    void _ignored;
    await updateSettings(patch);
    n++;
  }
  return n;
}

// ───────────────────────────── hooks ─────────────────────────────

/** Subscribe to any slice. The selector must return a stable reference for unchanged data. */
export function useStore<T>(selector: (s: StoreState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

export function useStoreReady(): boolean {
  return useStore((s) => s.ready);
}

export function useBootError(): string | null {
  return useStore((s) => s.bootError);
}

/** Every stay (including deleted), oldest first, with visit/stay numbers. Memoised. */
export function useAllStays(): Stay[] {
  const visits = useStore((s) => s.visits);
  const hotels = useStore((s) => s.hotels);
  const photos = useStore((s) => s.photos);
  return useMemo(() => buildStays(visits.values(), hotels, photos.values()), [visits, hotels, photos]);
}

/** Filtered stays, newest first by default. Excludes deleted unless `includeDeleted`. */
export function useStays(filter: StayFilter = {}): Stay[] {
  const all = useAllStays();
  const home = useStore((s) => s.settings.home_base);
  const key = JSON.stringify(filter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => filterStays(all, filter, home), [all, home, key]);
}

/** One stay by visit id (null if missing). Deleted stays are returned so undo screens can show them. */
export function useStay(visitId: string | null | undefined): Stay | null {
  const all = useAllStays();
  return useMemo(() => all.find((s) => s.visit.visit_id === visitId) ?? null, [all, visitId]);
}

/** Non-deleted hotels, most recently visited first. */
export function useHotels(): Hotel[] {
  const hotels = useStore((s) => s.hotels);
  const visits = useStore((s) => s.visits);
  return useMemo(() => {
    const last = new Map<string, string>();
    for (const v of visits.values()) if (!v.deleted && (last.get(v.hotel_id) ?? '') < v.date) last.set(v.hotel_id, v.date);
    return [...hotels.values()]
      .filter((h) => !h.deleted)
      .sort((a, b) => (last.get(b.hotel_id) ?? '').localeCompare(last.get(a.hotel_id) ?? '') || a.name.localeCompare(b.name));
  }, [hotels, visits]);
}

export function useHotel(hotelId: string | null | undefined): Hotel | null {
  return useStore((s) => (hotelId ? s.hotels.get(hotelId) ?? null : null));
}

/** Our visits to one hotel, oldest first (non-deleted). */
export function useVisitsForHotel(hotelId: string | null | undefined): Stay[] {
  const all = useAllStays();
  return useMemo(() => all.filter((s) => s.visit.hotel_id === hotelId && !s.visit.deleted), [all, hotelId]);
}

export function useWishes(): Wish[] {
  const wishes = useStore((s) => s.wishes);
  return useMemo(
    () => [...wishes.values()].filter((w) => !w.deleted).sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9) || a.created_at.localeCompare(b.created_at)),
    [wishes],
  );
}

/** Non-deleted custom places, newest first. */
export function usePlaces(): Place[] {
  const places = useStore((s) => s.places);
  return useMemo(() => [...places.values()].filter((p) => !p.deleted).sort((a, b) => b.created_at.localeCompare(a.created_at)), [places]);
}

/** One place by id (deleted included, so undo screens can show it). */
export function usePlace(placeId: string | null | undefined): Place | null {
  const places = useStore((s) => s.places);
  return useMemo(() => (placeId ? places.get(placeId) ?? null : null), [places, placeId]);
}

/** All letters, oldest first. Unlock checks live in features/letters/unlock.ts. */
export function useLetters(): Letter[] {
  const letters = useStore((s) => s.letters);
  return useMemo(() => [...letters.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)), [letters]);
}

export function useSettings(): SettingsMap {
  return useStore((s) => s.settings);
}

export function useSyncState(): SyncState {
  return useStore((s) => s.sync);
}

export function useDemoMode(): boolean {
  return useStore((s) => s.ns === 'demo');
}

function useDevice<K extends 'me' | 'muted' | 'connection' | 'introSeen' | 'reducedMotion' | 'pillowShown' | 'mode' | 'readReceiptsSeen' | 'installDismissed'>(key: K) {
  return useSyncExternalStore(
    (cb) => onDeviceChange((k) => k === key && cb()),
    () => deviceSnapshot(key),
    () => deviceSnapshot(key),
  );
}
const deviceCache = new Map<string, { raw: string; value: unknown }>();
function deviceSnapshot<K extends Parameters<typeof getDevice>[0]>(key: K): ReturnType<typeof getDevice<K>> {
  const value = getDevice(key);
  const raw = JSON.stringify(value);
  const cached = deviceCache.get(key);
  if (cached && cached.raw === raw) return cached.value as ReturnType<typeof getDevice<K>>;
  deviceCache.set(key, { raw, value });
  return value;
}

/** Who is using this device ('nirsh' | 'shady' | null). */
export function useMe(): PersonId | null {
  return useDevice('me');
}

/** Any device pref, reactive. */
export function useDevicePref<K extends 'me' | 'muted' | 'connection' | 'introSeen' | 'reducedMotion' | 'pillowShown' | 'mode' | 'readReceiptsSeen' | 'installDismissed'>(key: K) {
  return useDevice(key);
}

export { syncNow, onRemoteChange } from './sync';
