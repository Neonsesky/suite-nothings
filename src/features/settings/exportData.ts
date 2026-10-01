/** Export/import: JSON + CSV inside a zip, and parsing our own archives back into a Snapshot. */
import { APP_VERSION } from '@/config/env';
import { exportData as getSnapshot } from '@/data/store';
import type { Hotel, Letter, Photo, Snapshot, Visit, Wish } from '@/data/types';
import { today } from '@/lib/dates';
import { readZip, zipFiles } from './zip';

const HOTEL_FIELDS = [
  'hotel_id', 'name', 'brand', 'address', 'area', 'city', 'region', 'country', 'country_code',
  'lat', 'lng', 'source', 'osm_id', 'wikidata_id', 'website', 'phone', 'stars', 'price_level',
  'description', 'description_source', 'amenities_json', 'cover_photo_id', 'enrichment_status',
  'enriched_at', 'created_at', 'updated_at', 'deleted', 'image_url', 'image_credit', 'enriched_fields_json',
] as const satisfies readonly (keyof Hotel)[];

const VISIT_FIELDS = [
  'visit_id', 'hotel_id', 'date', 'check_in', 'check_out', 'nights', 'visit_type', 'booked_via',
  'note', 'favourite_moment', 'mood', 'rating_nirsh', 'rating_shady', 'picked_by', 'added_by',
  'photo_ids_json', 'created_at', 'updated_at', 'deleted',
] as const satisfies readonly (keyof Visit)[];

const PHOTO_FIELDS = [
  'photo_id', 'visit_id', 'thumb_file_id', 'full_file_id', 'width', 'height', 'taken_at',
  'caption', 'created_at', 'updated_at', 'deleted',
] as const satisfies readonly (keyof Photo)[];

const WISH_FIELDS = [
  'wish_id', 'name', 'lat', 'lng', 'city', 'country', 'note', 'added_by', 'priority',
  'fulfilled_visit_id', 'created_at', 'updated_at', 'deleted',
] as const satisfies readonly (keyof Wish)[];

const LETTER_FIELDS = [
  'letter_id', 'title', 'body_md', 'from', 'to', 'unlock_rule', 'written_at', 'read_at',
  'created_at', 'updated_at',
] as const satisfies readonly (keyof Letter)[];

const SETTINGS_FIELDS = ['home_base', 'map_lighting', 'units', 'updated_at'] as const;

/** RFC 4180 field escaping: quote when the field has a comma, quote or newline. */
function csvEscape(v: unknown): string {
  let s: string;
  if (v == null) s = '';
  else if (typeof v === 'object') s = JSON.stringify(v);
  else s = String(v);
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv<T extends object>(rows: readonly T[], fields: readonly string[]): string {
  const lines = [fields.join(',')];
  for (const row of rows) {
    const r = row as unknown as Record<string, unknown>;
    lines.push(fields.map((f) => csvEscape(r[f])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export interface ExportedFile {
  name: string;
  data: string;
}

/** Builds the files that go inside the export zip: the full JSON snapshot plus one CSV per table. */
export function buildExport(snap: Snapshot): ExportedFile[] {
  const wrapper = {
    app: 'suite-nothings' as const,
    version: APP_VERSION,
    exported_at: new Date().toISOString(),
    ...snap,
  };
  return [
    { name: 'suite-nothings.json', data: JSON.stringify(wrapper, null, 2) },
    { name: 'hotels.csv', data: toCsv(snap.hotels, HOTEL_FIELDS) },
    { name: 'visits.csv', data: toCsv(snap.visits, VISIT_FIELDS) },
    { name: 'photos.csv', data: toCsv(snap.photos, PHOTO_FIELDS) },
    { name: 'wishlist.csv', data: toCsv(snap.wishes, WISH_FIELDS) },
    { name: 'letters.csv', data: toCsv(snap.letters, LETTER_FIELDS) },
    { name: 'settings.csv', data: toCsv([snap.settings as Record<string, unknown>], SETTINGS_FIELDS) },
  ];
}

/** Builds and downloads `suite-nothings-YYYY-MM-DD.zip` for the current data. */
export function downloadExport(): void {
  const snap = getSnapshot();
  const files = buildExport(snap);
  const blob = zipFiles(files, new Date());
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `suite-nothings-${today()}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class ImportError extends Error {}

const FRIENDLY_IMPORT_ERROR = "That file isn't one of our exports. Look for suite-nothings-….zip or .json.";

function checkArray<T>(o: Record<string, unknown>, key: string, idField: string): T[] | undefined {
  const v = o[key];
  if (v == null) return undefined;
  if (!Array.isArray(v) || !v.every((r) => r != null && typeof r === 'object' && idField in (r as object))) {
    throw new ImportError(FRIENDLY_IMPORT_ERROR);
  }
  return v as T[];
}

function toSnapshot(obj: unknown): Partial<Snapshot> {
  if (!obj || typeof obj !== 'object') throw new ImportError(FRIENDLY_IMPORT_ERROR);
  const o = obj as Record<string, unknown>;
  const hotels = checkArray<Hotel>(o, 'hotels', 'hotel_id');
  const visits = checkArray<Visit>(o, 'visits', 'visit_id');
  const photos = checkArray<Photo>(o, 'photos', 'photo_id');
  const wishes = checkArray<Wish>(o, 'wishes', 'wish_id');
  const letters = checkArray<Letter>(o, 'letters', 'letter_id');
  const settings = o.settings && typeof o.settings === 'object' ? (o.settings as Partial<Snapshot['settings']>) : undefined;
  if (!hotels && !visits && !photos && !wishes && !letters && !settings) {
    throw new ImportError(FRIENDLY_IMPORT_ERROR);
  }
  const snap: Partial<Snapshot> = {};
  if (hotels) snap.hotels = hotels;
  if (visits) snap.visits = visits;
  if (photos) snap.photos = photos;
  if (wishes) snap.wishes = wishes;
  if (letters) snap.letters = letters;
  if (settings) snap.settings = settings;
  if (typeof o.serverTime === 'string') snap.serverTime = o.serverTime;
  return snap;
}

/** Parses one of our export files (.zip or a bare .json — wrapped or plain Snapshot) back into a Partial<Snapshot>. */
export async function parseImport(file: File): Promise<Partial<Snapshot>> {
  const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';
  try {
    if (isZip) {
      const buf = await file.arrayBuffer();
      const entries = readZip(buf);
      const entry = entries.find((e) => e.name === 'suite-nothings.json');
      if (!entry) throw new ImportError(FRIENDLY_IMPORT_ERROR);
      const text = new TextDecoder('utf-8').decode(entry.data);
      return toSnapshot(JSON.parse(text));
    }
    const text = await file.text();
    return toSnapshot(JSON.parse(text));
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError(FRIENDLY_IMPORT_ERROR);
  }
}
