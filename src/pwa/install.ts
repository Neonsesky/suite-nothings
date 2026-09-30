/**
 * Install prompt helper. Owned by w1-shell.
 *
 * - Android/desktop Chrome: the native `beforeinstallprompt` flow.
 * - iOS Safari: there's no native prompt, so `promptInstall()` opens our illustrated
 *   `IOSInstallSheet` (see IOSInstallSheet.tsx) and resolves once the person closes it (there's
 *   no way to know whether they actually completed "Add to Home Screen").
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

/** iOS *and* actually Safari (not Chrome/Firefox/Edge/etc. running on iOS, which all use WebKit
 * but can't add a home-screen icon the way Safari can). */
export function detectIOSSafari(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  if (!detectIOS(ua)) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|Mercury\//i.test(ua);
}

export function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// ── iOS install sheet store (module-level; read by IOSInstallSheet.tsx) ──
let sheetOpen = false;
const sheetListeners = new Set<() => void>();
function emitSheet() {
  sheetListeners.forEach((l) => l());
}

export function openIOSInstallSheet(): void {
  if (sheetOpen) return;
  sheetOpen = true;
  emitSheet();
}

export function closeIOSInstallSheet(): void {
  if (!sheetOpen) return;
  sheetOpen = false;
  emitSheet();
}

export function useIOSInstallSheetOpen(): boolean {
  const [open, setOpen] = useState(sheetOpen);
  useEffect(() => {
    const l = () => setOpen(sheetOpen);
    sheetListeners.add(l);
    return () => void sheetListeners.delete(l);
  }, []);
  return open;
}

/** Lets e2e (and, in principle, other features) trigger the sheet without a prop chain. */
const OPEN_EVENT = 'sn:open-ios-install';
if (typeof window !== 'undefined') {
  window.addEventListener(OPEN_EVENT, () => openIOSInstallSheet());
}

function waitForSheetClose(): Promise<'dismissed'> {
  return new Promise((resolve) => {
    const l = () => {
      if (!sheetOpen) {
        sheetListeners.delete(l);
        resolve('dismissed');
      }
    };
    sheetListeners.add(l);
  });
}

export function useInstallPrompt(): {
  canInstall: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'>;
} {
  const [hasDeferred, setHasDeferred] = useState(() => deferred != null);
  const [isStandalone] = useState(detectStandalone);
  const [isIOS] = useState(() => detectIOS());
  useEffect(() => {
    const l = () => setHasDeferred(deferred != null);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const canInstall = !isStandalone && (hasDeferred || isIOS);
  const promptInstall = useCallback(async () => {
    if (isStandalone) return 'unavailable' as const;
    if (isIOS) {
      openIOSInstallSheet();
      return waitForSheetClose();
    }
    if (!deferred) return 'unavailable' as const;
    const e = deferred;
    deferred = null;
    setHasDeferred(false);
    await e.prompt();
    return (await e.userChoice).outcome;
  }, [isIOS, isStandalone]);
  return { canInstall, isIOS, isStandalone, promptInstall };
}
