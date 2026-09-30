/**
 * Imperative toast queue. Any module (including the sync engine) can call `toast.show(...)`.
 * `<ToastHost />` (mounted once in the shell) renders the queue.
 */
export type ToastTone = 'neutral' | 'success' | 'error' | 'love';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  /** Default 4000ms; 6000ms when there is an action. 0 = sticky until dismissed. */
  durationMs?: number;
  /** Same id replaces an existing toast instead of stacking. */
  id?: string;
}

export interface ToastItem extends Required<Pick<ToastOptions, 'message' | 'tone' | 'durationMs'>> {
  id: string;
  action?: ToastOptions['action'];
  createdAt: number;
}

type Listener = (items: readonly ToastItem[]) => void;
let items: ToastItem[] = [];
const listeners = new Set<Listener>();
let counter = 0;
const MAX_VISIBLE = 3;

function emit() {
  listeners.forEach((l) => l(items));
}

export const toast = {
  show(opts: ToastOptions): string {
    const id = opts.id ?? `t${++counter}`;
    const item: ToastItem = {
      id,
      message: opts.message,
      tone: opts.tone ?? 'neutral',
      action: opts.action,
      durationMs: opts.durationMs ?? (opts.action ? 6000 : 4000),
      createdAt: Date.now(),
    };
    items = [...items.filter((t) => t.id !== id), item].slice(-MAX_VISIBLE);
    emit();
    return id;
  },
  dismiss(id: string): void {
    const next = items.filter((t) => t.id !== id);
    if (next.length !== items.length) {
      items = next;
      emit();
    }
  },
  clear(): void {
    items = [];
    emit();
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    l(items);
    return () => listeners.delete(l);
  },
  getAll(): readonly ToastItem[] {
    return items;
  },
};
