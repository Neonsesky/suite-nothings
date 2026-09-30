/**
 * Install prompt helper (minimal working version). Owned by w1-shell, who completes it
 * (iOS illustrated sheet, dismissal memory, analytics-free heuristics).
 */
import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function detectIOS(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
}

export function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function useInstallPrompt(): {
  canInstall: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'>;
} {
  const [canInstall, setCanInstall] = useState(() => deferred != null);
  const [isStandalone] = useState(detectStandalone);
  const [isIOS] = useState(() => detectIOS());
  useEffect(() => {
    const l = () => setCanInstall(deferred != null);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const promptInstall = useCallback(async () => {
    if (!deferred) return 'unavailable' as const;
    const e = deferred;
    deferred = null;
    setCanInstall(false);
    await e.prompt();
    return (await e.userChoice).outcome;
  }, []);
  return { canInstall, isIOS, isStandalone, promptInstall };
}
