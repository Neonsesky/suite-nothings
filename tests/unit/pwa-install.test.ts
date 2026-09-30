import { afterEach, describe, expect, it } from 'vitest';
import { closeIOSInstallSheet, detectIOS, detectIOSSafari, detectStandalone, openIOSInstallSheet, useIOSInstallSheetOpen } from '@/pwa/install';
import { renderHook, act } from '@testing-library/react';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0.0.0 Mobile/15E148 Safari/604.1';
const IPHONE_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/118.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36';
const IPAD_SAFARI =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('detectIOS', () => {
  it('is true for iPhone and iPad user agents', () => {
    expect(detectIOS(IPHONE_SAFARI)).toBe(true);
    expect(detectIOS(IPAD_SAFARI)).toBe(true);
  });
  it('is false for Android', () => {
    expect(detectIOS(ANDROID_CHROME)).toBe(false);
  });
});

describe('detectIOSSafari', () => {
  it('is true for real iOS Safari', () => {
    expect(detectIOSSafari(IPHONE_SAFARI)).toBe(true);
  });
  it('is false for Chrome or Firefox on iOS (WebKit, but no install affordance)', () => {
    expect(detectIOSSafari(IPHONE_CHROME)).toBe(false);
    expect(detectIOSSafari(IPHONE_FIREFOX)).toBe(false);
  });
  it('is false off iOS entirely', () => {
    expect(detectIOSSafari(ANDROID_CHROME)).toBe(false);
  });
});

describe('detectStandalone', () => {
  it('is false by default in the test DOM', () => {
    expect(detectStandalone()).toBe(false);
  });
});

describe('iOS install sheet store', () => {
  afterEach(() => {
    closeIOSInstallSheet();
  });

  it('starts closed, opens and closes, and notifies the hook', () => {
    const { result } = renderHook(() => useIOSInstallSheetOpen());
    expect(result.current).toBe(false);
    act(() => openIOSInstallSheet());
    expect(result.current).toBe(true);
    act(() => closeIOSInstallSheet());
    expect(result.current).toBe(false);
  });

  it('the sn:open-ios-install window event opens the sheet', () => {
    const { result } = renderHook(() => useIOSInstallSheetOpen());
    act(() => window.dispatchEvent(new Event('sn:open-ios-install')));
    expect(result.current).toBe(true);
  });

  it('opening twice is a no-op (no duplicate notifications needed)', () => {
    let calls = 0;
    const { result } = renderHook(() => {
      calls += 1;
      return useIOSInstallSheetOpen();
    });
    act(() => openIOSInstallSheet());
    const callsAfterFirstOpen = calls;
    act(() => openIOSInstallSheet());
    expect(result.current).toBe(true);
    expect(calls).toBe(callsAfterFirstOpen);
  });
});
