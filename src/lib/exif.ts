/**
 * EXIF reading for photo imports. exifr is loaded lazily (its own chunk, never on the initial
 * bundle). Capture times are kept as the camera's local wall time — never shifted through a
 * local-time Date — because that is the time the stay actually happened.
 */
import { haversineKm } from '@/lib/geo';

export interface ExifInfo {
  /** Local wall time as shot, `YYYY-MM-DDTHH:mm:ss` (no timezone). */
  takenAt: string | null;
  /** `YYYY-MM-DD` */
  date: string | null;
  /** `HH:mm` */
  time: string | null;
  lat: number | null;
  lng: number | null;
  /** EXIF Orientation 1–8. */
  orientation: number | null;
}

export interface ExifSuggestion {
  date: string | null;
  time: string | null;
  lat: number | null;
  lng: number | null;
  /** Photos agreeing with the suggestion. */
  count: number;
}

const EMPTY: ExifInfo = { takenAt: null, date: null, time: null, lat: null, lng: null, orientation: null };

/** Suggestions closer than this to the current location count as "the same place". */
const SAME_PLACE_KM = 0.3;

const PICK = [
  'DateTimeOriginal',
  'CreateDate',
  'ModifyDate',
  'Orientation',
  'GPSLatitude',
  'GPSLatitudeRef',
  'GPSLongitude',
  'GPSLongitudeRef',
];

const EXIF_DATE_RE = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/;

const pad = (n: number) => String(n).padStart(2, '0');

/** `'2026:07:12 15:42:10'` → `{ date: '2026-07-12', time: '15:42', takenAt: '2026-07-12T15:42:10' }`. */
export function parseExifDateString(s: string): { date: string; time: string; takenAt: string } | null {
  const m = EXIF_DATE_RE.exec(s.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, se] = [+m[1], +m[2], +m[3], +m[4], +m[5], m[6] ? +m[6] : 0];
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > dim || h > 23 || mi > 59 || se > 59) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const time = `${m[4]}:${m[5]}`;
  return { date, time, takenAt: `${date}T${time}:${pad(se)}` };
}

/** Dates that were revived anyway are formatted with local getters (exifr builds them in local time). */
function dateFrom(v: unknown): ReturnType<typeof parseExifDateString> {
  if (typeof v === 'string') return parseExifDateString(v);
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return parseExifDateString(
      `${v.getFullYear()}:${pad(v.getMonth() + 1)}:${pad(v.getDate())} ${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`,
    );
  }
  return null;
}

/** `[deg, min, sec]` + ref, or an already-decimal number. */
function coord(v: unknown, ref: unknown, neg: string): number | null {
  let n: number | null = null;
  if (typeof v === 'number') n = v;
  else if (Array.isArray(v) && v.length >= 1 && v.every((x) => typeof x === 'number')) {
    n = v[0] + (v[1] ?? 0) / 60 + (v[2] ?? 0) / 3600;
  }
  if (n === null || !Number.isFinite(n)) return null;
  return typeof ref === 'string' && ref.trim().toUpperCase() === neg ? -Math.abs(n) : n;
}

function validGps(lat: number | null, lng: number | null): { lat: number; lng: number } | null {
  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6) return null; // 0,0 = "no fix"
  return { lat, lng };
}

/** Reads capture time, GPS and orientation. Never throws; all-null when there is nothing. */
export async function readExif(file: Blob): Promise<ExifInfo> {
  try {
    const mod = await import('exifr');
    const exifr = mod.default ?? mod;
    // exifr reads Blobs through FileReader; without it (Node) hand over the bytes.
    const input = typeof FileReader === 'function' ? file : new Uint8Array(await file.arrayBuffer());
    const raw = (await exifr.parse(input, {
      pick: PICK,
      reviveValues: false,
      translateValues: false,
      xmp: false,
      icc: false,
      iptc: false,
      jfif: false,
      ihdr: false,
    })) as Record<string, unknown> | undefined;
    if (!raw) return { ...EMPTY };

    const when = dateFrom(raw.DateTimeOriginal) ?? dateFrom(raw.CreateDate) ?? dateFrom(raw.ModifyDate);
    const gps =
      validGps(coord(raw.GPSLatitude, raw.GPSLatitudeRef, 'S'), coord(raw.GPSLongitude, raw.GPSLongitudeRef, 'W')) ??
      validGps(typeof raw.latitude === 'number' ? raw.latitude : null, typeof raw.longitude === 'number' ? raw.longitude : null);
    const o = raw.Orientation;
    return {
      takenAt: when?.takenAt ?? null,
      date: when?.date ?? null,
      time: when?.time ?? null,
      lat: gps?.lat ?? null,
      lng: gps?.lng ?? null,
      orientation: typeof o === 'number' && Number.isInteger(o) && o >= 1 && o <= 8 ? o : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

/** Mean of unit vectors, so points either side of the antimeridian average sensibly. */
function centroid(points: readonly { lat: number; lng: number }[]): { lat: number; lng: number } {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    const φ = (p.lat * Math.PI) / 180;
    const λ = (p.lng * Math.PI) / 180;
    x += Math.cos(φ) * Math.cos(λ);
    y += Math.cos(φ) * Math.sin(λ);
    z += Math.sin(φ);
  }
  const lng = (Math.atan2(y, x) * 180) / Math.PI;
  const lat = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
  return { lat, lng };
}

/**
 * Suggests a date/time/place from a batch of photos: the most common date (ties → earliest),
 * the earliest time on it, and the centroid of that date's GPS points (else of any GPS).
 * Null when there is nothing useful or it would not change `current`.
 */
export function suggestFromExif(
  infos: readonly ExifInfo[],
  current: { date?: string | null; lat?: number | null; lng?: number | null } = {},
): ExifSuggestion | null {
  const counts = new Map<string, number>();
  for (const i of infos) if (i.date) counts.set(i.date, (counts.get(i.date) ?? 0) + 1);
  let date: string | null = null;
  let best = 0;
  for (const [d, n] of counts) {
    if (n > best || (n === best && date !== null && d < date)) {
      date = d;
      best = n;
    }
  }

  const onDate = date ? infos.filter((i) => i.date === date) : [];
  const times = onDate.map((i) => i.time).filter((t): t is string => !!t).sort();
  const time = times[0] ?? null;

  const gpsOf = (list: readonly ExifInfo[]) =>
    list.flatMap((i) => (i.lat !== null && i.lng !== null ? [{ lat: i.lat, lng: i.lng }] : []));
  let points = gpsOf(onDate);
  if (points.length === 0) points = gpsOf(infos);
  const place = points.length ? centroid(points) : null;

  if (!date && !place) return null;

  const sameDate = date === null || date === (current.date ?? null);
  const cur = validGps(current.lat ?? null, current.lng ?? null);
  const samePlace = place === null || (cur !== null && haversineKm(place, cur) <= SAME_PLACE_KM);
  if (sameDate && samePlace) return null;

  return {
    date,
    time,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
    count: date ? best : points.length,
  };
}
