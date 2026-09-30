/**
 * Soft synthesized sound effects via Web Audio. No audio files. Mute is remembered per device
 * (`device.muted`). The AudioContext is created lazily on first play (after a user gesture).
 */
import { getDevice, setDevice } from '@/data/device';

export type SoundName = 'beep' | 'whoosh' | 'flap';

let ctx: AudioContext | null = null;
let lastFlap = 0;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

export function isMuted(): boolean {
  return getDevice('muted');
}
export function setMuted(muted: boolean): void {
  setDevice('muted', muted);
}

function beep(a: AudioContext, t: number) {
  // Key-card reader: two short sine chirps.
  [0, 0.09].forEach((offset, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.value = i === 0 ? 1320 : 1760;
    g.gain.setValueAtTime(0.0001, t + offset);
    g.gain.exponentialRampToValueAtTime(0.12, t + offset + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.08);
    o.connect(g).connect(a.destination);
    o.start(t + offset);
    o.stop(t + offset + 0.1);
  });
}

function noiseBuffer(a: AudioContext, seconds: number): AudioBuffer {
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * seconds), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function whoosh(a: AudioContext, t: number) {
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, 0.7);
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.8;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
  f.frequency.exponentialRampToValueAtTime(500, t + 0.65);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.68);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
  src.stop(t + 0.7);
}

function flap(a: AudioContext, t: number) {
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, 0.03);
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 1800;
  const g = a.createGain();
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

/** Play a sound unless muted. Flap clicks are rate-limited so a board of flaps stays soft. */
export function play(name: SoundName): void {
  if (isMuted()) return;
  if (name === 'flap') {
    const now = performance.now();
    if (now - lastFlap < 35) return;
    lastFlap = now;
  }
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.005;
  try {
    if (name === 'beep') beep(a, t);
    else if (name === 'whoosh') whoosh(a, t);
    else flap(a, t);
  } catch {
    // audio is decoration: never throw
  }
}
