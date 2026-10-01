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
import { startEnrichmentQueue } from '@/enrichment';

// The saved Sheet link survives localStorage wipes via its IndexedDB mirror (w1-backend).
mirrorConnectionChanges();
installTestHooks();
void restoreConnection().finally(() => initStore());
// Hotels left `pending` (closed mid-run or added offline) get enriched once we're up and online.
startEnrichmentQueue();
void registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  </StrictMode>,
);
