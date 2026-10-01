/**
 * Optional AI description (SPEC §11.4), off by default. The model only rewrites facts we already
 * fetched; it never browses. The UI labels the result "Written by AI from public info".
 */
import type { Hotel } from '@/data/types';
import { parseJsonArray } from '@/data/stays';
import type { FetchLike } from './types';

export interface AIFacts {
  name: string;
  city: string;
  country: string;
  area?: string;
  brand?: string;
  stars?: number;
  amenities?: string[];
  summary?: string;
}

export interface AIDescription {
  description: string;
  tags: string[];
}

export interface AIProvider {
  id: 'apps-script' | 'ollama' | 'webllm';
  /** Cheap check that this provider can answer right now (key set, server reachable, GPU…). */
  available(signal: AbortSignal): Promise<boolean>;
  describe(prompt: string, signal: AbortSignal): Promise<AIDescription>;
}

/** Only the facts we have; never the website, phone or anything the model could "look up". */
export function factsOf(hotel: Hotel): AIFacts {
  const f: AIFacts = { name: hotel.name, city: hotel.city, country: hotel.country };
  if (hotel.area) f.area = hotel.area;
  if (hotel.brand) f.brand = hotel.brand;
  if (hotel.stars) f.stars = hotel.stars;
  const amenities = parseJsonArray(hotel.amenities_json);
  if (amenities.length) f.amenities = amenities;
  if (hotel.description && hotel.description_source !== 'ai') f.summary = hotel.description.slice(0, 1200);
  return f;
}

export function buildPrompt(facts: AIFacts): string {
  return [
    'You write short entries for a couple\'s private hotel diary.',
    'Using ONLY the facts below, write a warm 2–3 sentence description of the hotel, in British English, sentence case, no superlatives you cannot back with the facts.',
    'Do not invent amenities, prices, history or ratings. If the facts are thin, keep it short and simple.',
    'Also give up to 4 short lowercase tags taken from the facts (for example "pool", "beachfront").',
    'Reply with JSON only: {"description": string, "tags": string[]}.',
    '',
    'Facts:',
    JSON.stringify(facts, null, 2),
  ].join('\n');
}

/** Accepts plain JSON or JSON wrapped in prose / code fences. Anything else is null. */
export function parseAIResponse(text: string): AIDescription | null {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try {
    const raw = JSON.parse(m[0]) as { description?: unknown; tags?: unknown };
    const description = typeof raw.description === 'string' ? raw.description.trim() : '';
    if (description.length < 20) return null;
    const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim().toLowerCase()).slice(0, 4) : [];
    return { description: description.slice(0, 600), tags };
  } catch {
    return null;
  }
}

const withTimeout = (signal: AbortSignal, ms: number): AbortSignal => AbortSignal.any([signal, AbortSignal.timeout(ms)]);

// ---- Apps Script (hosted model; the key lives in Script Properties) ---------------------------

export type Invoke = (action: string, payload: unknown) => Promise<unknown>;

export function appsScriptAI(invoke: Invoke | null): AIProvider {
  return {
    id: 'apps-script',
    available: async () => invoke !== null,
    async describe(prompt) {
      if (!invoke) throw new Error('not_configured');
      const res = (await invoke('aiDescribe', { prompt })) as { text?: unknown; ok?: boolean; code?: string } | null;
      if (res && res.ok === false) throw new Error(res.code ?? 'ai_failed');
      const parsed = typeof res?.text === 'string' ? parseAIResponse(res.text) : null;
      if (!parsed) throw new Error('ai_unreadable');
      return parsed;
    },
  };
}

// ---- Ollama on this desktop --------------------------------------------------------------------

export const OLLAMA_URL = 'http://localhost:11434';

/** Quick probe: the installed models, or null when Ollama isn't there (1.5 s timeout). */
export async function detectOllama(fetchFn: FetchLike = (i, n) => globalThis.fetch(i, n), signal: AbortSignal = new AbortController().signal): Promise<string[] | null> {
  try {
    const res = await fetchFn(`${OLLAMA_URL}/api/tags`, { signal: withTimeout(signal, 1500) });
    if (!res.ok) return null;
    const body = (await res.json()) as { models?: { name?: string }[] };
    return (body.models ?? []).map((m) => m.name).filter((n): n is string => Boolean(n));
  } catch {
    return null;
  }
}

export function ollamaAI(model: string | null, fetchFn: FetchLike = (i, n) => globalThis.fetch(i, n)): AIProvider {
  return {
    id: 'ollama',
    available: async (signal) => Boolean(model) && (await detectOllama(fetchFn, signal))?.includes(model!) === true,
    async describe(prompt, signal) {
      const res = await fetchFn(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        body: JSON.stringify({ model, prompt, stream: false, format: 'json' }),
        signal: withTimeout(signal, 60_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseAIResponse(((await res.json()) as { response?: string }).response ?? '');
      if (!parsed) throw new Error('ai_unreadable');
      return parsed;
    },
  };
}

// ---- WebLLM (in-browser) -----------------------------------------------------------------------

/** Detection only: a WebLLM runtime is a multi-MB download, so the option stays hidden for now. */
export function supportsWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export const WEBLLM_ENABLED = false;

export function webllmAI(): AIProvider {
  return {
    id: 'webllm',
    available: async () => WEBLLM_ENABLED && supportsWebGPU(),
    describe: () => Promise.reject(new Error('not_configured')),
  };
}
