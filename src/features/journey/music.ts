/**
 * Optional soundtrack (SPEC §10): if the owner drops `journey.mp3` (or .m4a/.ogg) into
 * `/public/audio/`, it plays softly under the replay. We look for it with a HEAD request and
 * fail silently, so a missing file costs nothing. Mute is the shared `device.muted` flag.
 */
import { isMuted } from '@/lib/sound';

const CANDIDATES = ['journey.mp3', 'journey.m4a', 'journey.ogg'];
let found: Promise<string | null> | null = null;

function findTrack(): Promise<string | null> {
  if (found) return found;
  found = (async () => {
    if (typeof fetch === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return null;
    for (const name of CANDIDATES) {
      const url = `${import.meta.env.BASE_URL}audio/${name}`;
      try {
        const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        const type = res.headers.get('content-type') ?? '';
        // The SPA fallback answers 200 text/html for missing files; only real audio counts.
        if (res.ok && type.startsWith('audio/')) return url;
      } catch {
        // offline or blocked: no soundtrack
      }
    }
    return null;
  })();
  return found;
}

export class Soundtrack {
  private el: HTMLAudioElement | null = null;
  private wanted = false;

  async play(): Promise<void> {
    this.wanted = true;
    if (isMuted()) return;
    if (!this.el) {
      const url = await findTrack();
      if (!url || !this.wanted) return;
      this.el = new Audio(url);
      this.el.loop = true;
      this.el.volume = 0.35;
    }
    if (isMuted() || !this.wanted) return;
    await this.el.play().catch(() => undefined);
  }

  pause(): void {
    this.wanted = false;
    this.el?.pause();
  }

  /** Re-apply after the mute toggle changes. */
  sync(playing: boolean): void {
    if (playing && !isMuted()) void this.play();
    else this.el?.pause();
    if (!playing) this.wanted = false;
  }

  destroy(): void {
    this.pause();
    this.el = null;
  }
}
