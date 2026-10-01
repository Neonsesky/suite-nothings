/**
 * A tiny React root of its own for the share preview, so any screen (or plain code) can open it
 * without touching the Shell. Only one preview is open at a time; opening another settles the
 * previous one as 'cancelled'.
 */
import { createRoot, type Root } from 'react-dom/client';
import { SharePreview } from './SharePreview';
import type { ShareJob } from './index';
import type { ShareOutcome } from './types';

let root: Root | null = null;
let seq = 0;
let pending: ((o: ShareOutcome) => void) | null = null;

export function openSharePreview(job: ShareJob): Promise<ShareOutcome> {
  if (!root) {
    const el = document.createElement('div');
    el.id = 'sn-share-host';
    document.body.appendChild(el);
    root = createRoot(el);
  }
  pending?.('cancelled');
  return new Promise((resolve) => {
    const settle = (o: ShareOutcome) => {
      if (pending !== settle) return;
      pending = null;
      resolve(o);
    };
    pending = settle;
    root!.render(<SharePreview key={++seq} job={job} onDone={settle} />);
  });
}
