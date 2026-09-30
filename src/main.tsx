import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/fonts.css';
import '@/styles/tokens.css';
import '@/styles/global.css';
import { Shell } from '@/app/Shell';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { initStore } from '@/data/store';
import { mirrorConnectionChanges, restoreConnection } from '@/data/connection';
import { registerServiceWorker } from '@/pwa/register';

// The saved Sheet link survives localStorage wipes via its IndexedDB mirror (w1-backend).
mirrorConnectionChanges();
void restoreConnection().finally(() => initStore());
void registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  </StrictMode>,
);
