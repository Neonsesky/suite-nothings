// Types for the Node Apps Script harness (tools/gas-harness/index.mjs).
import type { Context } from 'node:vm';

export type Cell = string | number | boolean | Date | null;

export interface ApiError { code: 'unauthorized' | 'bad_request' | 'not_found' | 'conflict' | 'server'; message: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ApiResponse<T = any> { ok: boolean; version?: string; data: T; error?: ApiError }

export interface SheetHelper {
  exists(): boolean;
  /** 2-D values of the used area (header first). */
  raw(): Cell[][];
  headers(): string[];
  /** Non-blank rows below the header as objects keyed by trimmed header. */
  rows(): Record<string, Cell>[];
  /** Replaces the whole grid (creates the tab if needed). */
  setRaw(values: Cell[][]): SheetHelper;
  /** 1-based sheet row of the row with this id (id column found by header), or null. */
  rowOf(id: string, idColumn?: string): number | null;
  cell(row: number, column: string): Cell;
  /** Sets a cell like a person typing, then fires onEdit(e). */
  editCell(row: number, column: string, value: Cell): void;
  validation(column: string): { list: string[] | null; allowInvalid: boolean; showDropdown: boolean } | null;
  numberFormat(column: string): string | null;
  frozenRows(): number;
  headerBold(): boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fake(): any;
}

export interface DriveFileRecord { id: string; name: string; mime: string; bytes: Buffer; parents: string[]; trashed: boolean }

export interface GasEnvOptions {
  appKey?: string;
  timeZone?: string;
  /** true: the script is bound to the Sheet (getActiveSpreadsheet + getUi work). */
  bound?: boolean;
  promptResponse?: { button?: 'OK' | 'CANCEL'; text?: string } | ((title: string, message: string) => { button?: 'OK' | 'CANCEL'; text?: string }) | null;
  now?: () => Date;
  extraSources?: Array<string | { name: string; source: string }>;
  codeSource?: string;
}

export interface GasEnv {
  context: Context;
  call: {
    get(params?: Record<string, string | number | undefined>): ApiResponse;
    /** body: an object (JSON-encoded) or a raw string (sent as is). */
    post(body: unknown, params?: Record<string, string>): ApiResponse;
  };
  /** Runs a top-level script function such as setup or selfTest. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run(name: string, ...args: unknown[]): any;
  ss: { id: string; fake: unknown; sheet(name: string): SheetHelper; sheetNames(): string[] };
  drive: {
    files: Map<string, DriveFileRecord>;
    folders: Map<string, { id: string; name: string; trashed: boolean }>;
    addFile(opts: { name: string; mime?: string; data?: string | Buffer; folderId?: string | null }): string;
  };
  props: Record<string, string>;
  logs: string[];
  prompts: Array<{ title: string; message: string; buttons: string }>;
  alerts: Array<{ title: string; message: string }>;
  lock: { acquisitions: number; held: boolean; failNext: boolean };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geocoder: { canned: Record<string, any[]>; queries: string[]; lastBounds: number[] | null; lastRegion: string | null };
}

export function createGasEnv(options?: GasEnvOptions): GasEnv;
export function formatDate(date: Date, timeZone: string, pattern: string): string;
