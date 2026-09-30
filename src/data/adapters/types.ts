import type { PlaceResult } from '@/lib/geocode';
import type { OutboxOp, Snapshot } from '../types';

export type AdapterKind = 'demo' | 'sheets';

/** Typed adapter error codes. UI maps these to copy (see `adapterErrorMessage`). */
export type AdapterErrorCode = 'unauthorized' | 'not_apps_script' | 'network' | 'server' | 'conflict' | 'not_configured';

export class AdapterError extends Error {
  readonly code: AdapterErrorCode;
  /** Whether retrying later might succeed (network/server yes; unauthorized no). */
  readonly retryable: boolean;
  constructor(code: AdapterErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AdapterError';
    this.code = code;
    this.retryable = code === 'network' || code === 'server';
  }
}

export function isAdapterError(e: unknown): e is AdapterError {
  return e instanceof AdapterError;
}

/** Plain-language copy for each error code (SPEC §6 Test connection wording). */
export function adapterErrorMessage(code: AdapterErrorCode): string {
  switch (code) {
    case 'unauthorized':
      return 'Wrong passphrase';
    case 'not_apps_script':
      return "This isn't an Apps Script web app link";
    case 'network':
      return "Can't reach Google right now";
    case 'server':
      return 'Our Sheet hiccupped. We’ll try again shortly';
    case 'conflict':
      return 'A newer version was already saved, so we kept that one';
    case 'not_configured':
      return 'Not connected to our Sheet yet';
  }
}

export interface ApplyResult {
  ok: true;
  /** Rows the server now holds after the write (may be newer than ours on conflict). */
  applied?: Partial<Snapshot>;
  /** For uploadPhoto: the server file ids. */
  fileIds?: { thumb_file_id: string | null; full_file_id: string | null };
  serverTime?: string;
}

/** The only thing the UI/store knows about a backend. */
export interface DataAdapter {
  readonly kind: AdapterKind;
  ping(): Promise<{ ok: boolean; version?: string }>;
  /** Full snapshot of every tab. */
  bootstrap(): Promise<Snapshot>;
  /** Only rows with updated_at > sinceIso. */
  changes(sinceIso: string): Promise<Snapshot>;
  /** Apply one outbox op. Must be idempotent (upsert by id, last-write-wins on updated_at). */
  apply(op: OutboxOp): Promise<ApplyResult>;
  getPhoto(id: string): Promise<Blob>;
  /** Server-side geocode fallback. Demo returns []. */
  geocode(query: string, near?: { lat: number; lng: number }): Promise<PlaceResult[]>;
}
