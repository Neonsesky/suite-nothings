/**
 * Sheets adapter (Apps Script ⇄ Google Sheet). Owned by w1-backend, who replaces this stub.
 * Until then every call rejects with a typed `not_configured` error.
 */
import type { ConnectionConfig } from '../types';
import { AdapterError, type DataAdapter } from './types';

export function createSheetsAdapter(_config: ConnectionConfig): DataAdapter {
  const fail = (): Promise<never> =>
    Promise.reject(new AdapterError('not_configured', 'The Sheets adapter is not available in this build'));
  return {
    kind: 'sheets',
    ping: fail,
    bootstrap: fail,
    changes: fail,
    apply: fail,
    getPhoto: fail,
    geocode: fail,
  };
}
