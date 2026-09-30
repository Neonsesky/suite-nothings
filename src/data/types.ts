/**
 * Domain types. Field names are snake_case to mirror the Google Sheet columns (SPEC §5).
 * Dates are plain `YYYY-MM-DD` strings; times are `HH:mm`; timestamps are ISO-8601 strings.
 */
import type { PersonId } from '@/config/couple';

export type { PersonId };

export const VISIT_TYPES = ['Dayuse', 'Staycation', 'Overnight', 'Pool day', 'Spa', 'Brunch or dinner', 'Other'] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const BOOKED_VIA = ['Dayuse', 'Direct', 'Booking.com', 'Other'] as const;
export type BookedVia = (typeof BOOKED_VIA)[number];

/** Curated mood stamps (not free emoji). `label` is the display copy. */
export const MOODS = ['blissful', 'cosy', 'romantic', 'giddy', 'lazy', 'adventurous', 'fancy', 'sleepy'] as const;
export type Mood = (typeof MOODS)[number];
export const MOOD_LABELS: Record<Mood, string> = {
  blissful: 'Blissful',
  cosy: 'Cosy',
  romantic: 'Romantic',
  giddy: 'Giddy',
  lazy: 'Lazy day',
  adventurous: 'Adventurous',
  fancy: 'Fancy',
  sleepy: 'Sleepy',
};

export type EnrichmentStatus = 'none' | 'pending' | 'done' | 'failed' | 'skipped';
export type HotelSource = 'photon' | 'manual' | 'seed' | 'wishlist';
/** 1–4, rendered as ¤ … ¤¤¤¤ */
export type PriceLevel = 1 | 2 | 3 | 4;
/** Rating 1–5; null = not rated yet. */
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Hotel {
  hotel_id: string;
  name: string;
  brand: string | null;
  address: string | null;
  area: string | null; // district / neighbourhood, e.g. "Dubai Marina"
  city: string;
  region: string | null; // emirate / state
  country: string;
  country_code: string; // ISO-3166 alpha-2, upper case
  lat: number;
  lng: number;
  source: HotelSource;
  osm_id: string | null; // e.g. "W91402276" (type letter + id)
  wikidata_id: string | null;
  website: string | null;
  phone: string | null;
  stars: number | null; // 1–5
  price_level: PriceLevel | null;
  description: string | null;
  description_source: string | null; // e.g. "wikipedia", "osm", "ai", "us"
  amenities_json: string | null; // JSON string[]; parse with parseJsonArray()
  cover_photo_id: string | null;
  enrichment_status: EnrichmentStatus;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface Visit {
  visit_id: string;
  hotel_id: string;
  date: string; // YYYY-MM-DD (check-in day)
  check_in: string | null; // HH:mm
  check_out: string | null; // HH:mm
  nights: number; // 0 for day use
  visit_type: VisitType;
  booked_via: BookedVia | null;
  note: string | null;
  favourite_moment: string | null;
  mood: Mood | null;
  rating_nirsh: Rating | null;
  rating_shady: Rating | null;
  picked_by: PersonId | 'both' | null;
  added_by: PersonId | null;
  photo_ids_json: string | null; // JSON string[] of photo_id, in display order
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface Photo {
  photo_id: string;
  visit_id: string;
  thumb_file_id: string | null; // Drive file id (sheets) or local blob key
  full_file_id: string | null;
  width: number;
  height: number;
  taken_at: string | null;
  caption: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

/** Stored in the photoBlobs store keyed by `${photo_id}:${size}`. */
export interface PhotoBlob {
  key: string;
  photo_id: string;
  size: 'thumb' | 'full';
  blob: Blob;
  mime: string;
}

export interface Wish {
  wish_id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
  country: string | null;
  note: string | null;
  added_by: PersonId | null;
  priority: 1 | 2 | 3 | null;
  fulfilled_visit_id: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

/** `always` | `visits>=N` | `hotels>=N` | `first_abroad` | `date>=YYYY-MM-DD` */
export type UnlockRule = 'always' | 'first_abroad' | `visits>=${number}` | `hotels>=${number}` | `date>=${string}`;

export interface Letter {
  letter_id: string;
  title: string;
  body_md: string;
  from: PersonId;
  to: PersonId;
  unlock_rule: UnlockRule;
  written_at: string; // ISO or YYYY-MM-DD
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MapLighting = 'auto' | 'day' | 'golden' | 'night';
export type Units = 'km' | 'mi';

export interface HomeBase {
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  /** [west, south, east, north] */
  bbox?: [number, number, number, number];
}

/** Shared settings (synced to the Sheet's Settings tab). */
export interface SettingsMap {
  home_base: HomeBase;
  map_lighting: MapLighting;
  units: Units;
  updated_at: string;
}

/** Derived view: a visit joined with its hotel and photos. Never stored. */
export interface Stay {
  visit: Visit;
  hotel: Hotel;
  photos: Photo[];
  /** 1-based index of this visit among all visits to the same hotel, chronologically. */
  visitNumber: number;
  /** 1-based index among all non-deleted visits, chronologically. */
  stayNumber: number;
}

export interface Snapshot {
  hotels: Hotel[];
  visits: Visit[];
  photos: Photo[];
  wishes: Wish[];
  letters: Letter[];
  settings: Partial<SettingsMap>;
  /** Server clock at the time of the snapshot; pass back as `since` to changes(). */
  serverTime: string;
}

/** One write, queued locally then flushed through the active adapter (SPEC §6 POST actions). */
export type OutboxOp =
  | { op_id: string; action: 'upsertHotel'; payload: Hotel; created_at: string; attempts: number; last_error?: string }
  | { op_id: string; action: 'upsertVisit'; payload: Visit; created_at: string; attempts: number; last_error?: string }
  | { op_id: string; action: 'deleteVisit'; payload: { visit_id: string; updated_at: string; deleted: boolean }; created_at: string; attempts: number; last_error?: string }
  | { op_id: string; action: 'uploadPhoto'; payload: { photo: Photo; thumb_key: string | null; full_key: string | null }; created_at: string; attempts: number; last_error?: string }
  | { op_id: string; action: 'upsertWish'; payload: Wish; created_at: string; attempts: number; last_error?: string }
  | { op_id: string; action: 'markLetterRead'; payload: { letter_id: string; read_at: string }; created_at: string; attempts: number; last_error?: string }
  | { op_id: string; action: 'upsertLetter'; payload: Letter; created_at: string; attempts: number; last_error?: string }
  | { op_id: string; action: 'updateSettings'; payload: Partial<SettingsMap>; created_at: string; attempts: number; last_error?: string };

export type OutboxAction = OutboxOp['action'];
export type OutboxPayload<A extends OutboxAction> = Extract<OutboxOp, { action: A }>['payload'];

/** Saved in device storage. */
export interface ConnectionConfig {
  apiUrl: string; // https://script.google.com/macros/s/…/exec
  key: string; // shared passphrase
  connectedAt: string | null;
  lastSyncAt: string | null;
}

export type Namespace = 'demo' | 'live';
