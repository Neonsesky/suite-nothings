import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/fonts.css';
import '@/styles/tokens.css';
import '@/styles/global.css';
import { Shell } from '@/app/Shell';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { initStore } from '@/data/store';
import { installTestHooks, mirrorConnectionChanges, restoreConnection } from '@/data/connection';
import { registerServiceWorker } from '@/pwa/register';

// The saved Sheet link survives localStorage wipes via its IndexedDB mirror (w1-backend).
mirrorConnectionChanges();
installTestHooks();
void restoreConnection().finally(() => initStore());
// Hotels left `pending` (closed mid-run or added offline) get enriched once we're up and online.
// The enrichment module (AI/OSM/Wikidata providers) isn't needed for first paint, so it's a
// dynamic import kicked off once the main thread is idle, keeping its weight off the initial
// JS chunk (Lighthouse perf-1).
const startEnriching = () => void import('@/enrichment').then((m) => m.startEnrichmentQueue());
if (typeof requestIdleCallback === 'function') requestIdleCallback(startEnriching, { timeout: 2000 });
else setTimeout(startEnriching, 200);
void registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  </StrictMode>,
);
