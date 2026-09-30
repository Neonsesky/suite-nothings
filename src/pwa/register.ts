/**
 * Service worker registration with the "fresh version is ready" prompt (SPEC §7.6).
 * Never reloads while a form is busy (lib/busy). Owned by w1-shell after merge.
 */
import { isBusy, onBusyChange } from '@/lib/busy';
import { toast } from '@/lib/toast';

export async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  const update = registerSW({
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
}
