/**
 * Per-device enrichment toggles (Settings → Hotel info). Everything optional is off by default.
 * Stored in localStorage: the choice depends on the device (a desktop with Ollama, say).
 */
import { useSyncExternalStore } from 'react';

export type AIChoice = 'off' | 'apps-script' | 'ollama' | 'webllm';

export interface EnrichmentPrefs {
  ai: AIChoice;
  ollamaModel: string | null;
  places: boolean;
}

const KEY = 'sn:enrichment-prefs';
export const DEFAULT_PREFS: EnrichmentPrefs = { ai: 'off', ollamaModel: null, places: false };
const AI_CHOICES: AIChoice[] = ['off', 'apps-script', 'ollama', 'webllm'];

let cache: EnrichmentPrefs | null = null;
const listeners = new Set<() => void>();

export function getPrefs(): EnrichmentPrefs {
  if (cache) return cache;
  let parsed: Partial<EnrichmentPrefs> = {};
  try {
    parsed = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}') as Partial<EnrichmentPrefs>;
  } catch {
    parsed = {};
  }
  cache = {
    ai: AI_CHOICES.includes(parsed.ai as AIChoice) ? (parsed.ai as AIChoice) : 'off',
    ollamaModel: typeof parsed.ollamaModel === 'string' && parsed.ollamaModel ? parsed.ollamaModel : null,
    places: parsed.places === true,
  };
  return cache;
}

export function setPrefs(patch: Partial<EnrichmentPrefs>): EnrichmentPrefs {
  cache = { ...getPrefs(), ...patch };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Private mode: the choice lasts for this session only.
  }
  listeners.forEach((l) => l());
  return cache;
}

export function useEnrichmentPrefs(): EnrichmentPrefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getPrefs,
    () => DEFAULT_PREFS,
  );
}
