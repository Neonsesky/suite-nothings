/**
 * Device-level preferences (never synced, survive demo/live namespace switches).
 * Backed by localStorage under `sn:device:<key>`, with an in-memory fallback when storage is
 * unavailable (private mode). Subscribe with `onDeviceChange` or read via store hooks.
 */
import type { PersonId } from '@/config/couple';
import type { ConnectionConfig } from './types';

export interface DevicePrefs {
  me: PersonId | null;
  connection: ConnectionConfig | null;
  /** Explicit demo/live choice. null = not chosen yet (use IS_DEMO_DEFAULT). */
  mode: 'demo' | 'live' | null;
  muted: boolean;
  /** null = follow the OS setting. */
  reducedMotion: boolean | null;
  introSeen: boolean;
  /** Letter ids whose pillow reveal was shown on this device. */
  pillowShown: string[];
  /** Letter ids whose "… read your note" receipt was already shown to the author here. */
  readReceiptsSeen: string[];
  /** "Add to home screen" banner dismissed on this device (declined, or already installed). */
  installDismissed: boolean;
}

export const DEVICE_DEFAULTS: DevicePrefs = {
  me: null,
  connection: null,
  mode: null,
  muted: false,
  reducedMotion: null,
  introSeen: false,
  pillowShown: [],
  readReceiptsSeen: [],
  installDismissed: false,
};

const PREFIX = 'sn:device:';
const memory = new Map<string, string>();
const listeners = new Set<(key: keyof DevicePrefs) => void>();

function storage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = PREFIX + '__probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function getDevice<K extends keyof DevicePrefs>(key: K): DevicePrefs[K] {
  const raw = storage()?.getItem(PREFIX + key) ?? memory.get(key) ?? null;
  if (raw == null) return DEVICE_DEFAULTS[key];
  try {
    return JSON.parse(raw) as DevicePrefs[K];
  } catch {
    return DEVICE_DEFAULTS[key];
  }
}

export function setDevice<K extends keyof DevicePrefs>(key: K, value: DevicePrefs[K]): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    storage()?.setItem(PREFIX + key, raw);
  } catch {
    // quota or private mode: memory copy still serves this session
  }
  listeners.forEach((l) => l(key));
}

export function onDeviceChange(cb: (key: keyof DevicePrefs) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Test helper: wipe every device pref. */
export function resetDevice(): void {
  memory.clear();
  const s = storage();
  if (s) {
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) s.removeItem(k);
    }
  }
  (Object.keys(DEVICE_DEFAULTS) as (keyof DevicePrefs)[]).forEach((k) => listeners.forEach((l) => l(k)));
}
