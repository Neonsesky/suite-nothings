/**
 * Service worker registration with the "fresh version is ready" prompt (SPEC §7.6).
 * Never reloads while a form is busy (lib/busy). Owned by w1-shell after merge.
 */
import { isBusy, onBusyChange } from '@/lib/busy';
import { toast } from '@/lib/toast';

/** At most one `registration.update()` check per hour, however it's triggered. */
const UPDATE_CHECK_THROTTLE_MS = 60 * 60 * 1000;

export async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  let registration: ServiceWorkerRegistration | undefined;
  let lastCheck = 0;
  const checkForUpdate = () => {
    if (!registration) return;
    const now = Date.now();
    if (now - lastCheck < UPDATE_CHECK_THROTTLE_MS) return;
    lastCheck = now;
    void registration.update();
  };
  const update = registerSW({
    onRegisteredSW(_swUrl, reg) {
      registration = reg;
    },
    onNeedRefresh() {
      const offer = () =>
        toast.show({
          id: 'sw-update',
          message: 'A fresh version is ready',
          durationMs: 0,
          action: {
            label: 'Refresh',
            onClick: () => {
              if (isBusy()) {
                toast.show({ message: "We'll refresh once you've saved" });
                const off = onBusyChange(() => {
                  if (!isBusy()) {
                    off();
                    void update(true);
                  }
                });
              } else void update(true);
            },
          },
        });
      if (isBusy()) {
        const off = onBusyChange(() => {
          if (!isBusy()) {
            off();
            offer();
          }
        });
      } else offer();
    },
  });

  // Check for a new SW on focus/visibility (throttled) and on an hourly timer while visible, so
  // a tab left open for days still offers the update prompt without polling constantly.
  window.addEventListener('focus', checkForUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') checkForUpdate();
  }, UPDATE_CHECK_THROTTLE_MS);
}
