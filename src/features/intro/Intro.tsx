/**
 * The intro (SPEC §8.1, §14). First launch: the 619 key tag swings in on its ring, a key card
 * taps the lock, the light turns green and the door opens into the app (at most 2.5 s, tap or
 * any key skips). Later launches get a 400 ms version. Three.js loads lazily and is skipped on
 * reduced motion and low-end devices, which get the 2D drawing of the same beats.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getDevice, setDevice } from '@/data/device';
import { useReducedMotion } from '@/lib/motion';
import { play } from '@/lib/sound';
import { Door2D, type Door2DVariant } from './Door2D';
import { canRun3D, probeFrameTime } from './capability';
import { setIntroActive } from './state';
import s from './Intro.module.css';

/** How long we wait for the 3D chunk before drawing the 2D version instead. */
const LOAD_BUDGET_MS = 600;
/** However the device behaves, the intro must be fully gone within this long of first paint
 * (SPEC §14). This is the backstop — the budgets above should make it moot in practice. */
const HARD_CEILING_MS = 2500;
const DURATION = { full: 2000, short: 400, still: 700 } as const;
const LEAVE_MS = { full: 260, short: 120 } as const;

type Kind = 'wait' | '3d' | Door2DVariant;

function initialMode(): 'full' | 'short' | null {
  if (typeof window === 'undefined' || /^#\/gallery/.test(location.hash)) return null;
  return getDevice('introSeen') ? 'short' : 'full';
}

export function Intro() {
  const [mode] = useState(initialMode);
  if (!mode) return null;
  return <IntroPlayer mode={mode} />;
}

function IntroPlayer({ mode }: { mode: 'full' | 'short' }) {
  const reduced = useReducedMotion();
  const [kind, setKind] = useState<Kind>(() => (mode === 'short' ? (reduced ? 'still' : 'short') : reduced ? 'still' : 'wait'));
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Real elapsed time from first paint (approx: constructor time of this component), so every
  // budget below is measured against the clock, not against whenever some earlier stage happened
  // to finish — a main thread busy parsing the 3D chunk, or a slow network, delays stages, and
  // every delay has to come out of what's left, not add on top.
  const [mountedAt] = useState(() => performance.now());

  // Mark the intro active for its lifetime (the pillow note waits for it).
  useEffect(() => {
    setIntroActive(true);
    return () => setIntroActive(false);
  }, []);

  const finish = useRef(() => {});
  useLayoutEffect(() => {
    finish.current = () => {
    if (leaving) return;
    setLeaving(true);
    setDevice('introSeen', true);
    setTimeout(() => {
      setGone(true);
      setIntroActive(false);
      }, mode === 'short' ? LEAVE_MS.short : LEAVE_MS.full);
    };
  });

  // Hard ceiling: no matter what the stages above are doing, force the intro closed in time to
  // be fully gone (opacity-0 + unmounted) by HARD_CEILING_MS after first paint.
  useEffect(() => {
    if (mode !== 'full') return; // the short replay is already well under budget
    const remaining = Math.max(0, HARD_CEILING_MS - LEAVE_MS.full - (performance.now() - mountedAt));
    const t = setTimeout(() => finish.current(), remaining);
    return () => clearTimeout(t);
  }, [mode, mountedAt]);

  // Full intro: race the 3D chunk against the load budget and a frame-time probe. The fallback
  // timer is scheduled for what's *left* of the budget (not a fresh LOAD_BUDGET_MS), so a slow
  // render of an earlier stage can't push this one out past the real deadline. The import itself
  // is kicked off from an idle callback rather than synchronously on mount: starting a ~150KB
  // chunk fetch in the same tick as first paint competes with the critical render path for
  // bandwidth and CPU (this cost Lighthouse's throttled mobile run ~30+ performance points).
  // Deferring by one idle tick (budget-aware; still falls back cleanly if it eats into
  // LOAD_BUDGET_MS) lets the above-the-fold paint finish first.
  useEffect(() => {
    if (kind !== 'wait') return;
    let cancelled = false;
    const fallback = setTimeout(() => !cancelled && setKind('full'), Math.max(0, LOAD_BUDGET_MS - (performance.now() - mountedAt)));
    if (!canRun3D()) {
      clearTimeout(fallback);
      queueMicrotask(() => !cancelled && setKind('full'));
      return;
    }
    const start = () => {
      if (cancelled) return;
      Promise.all([import('./scene3d'), probeFrameTime()])
        .then(([, frame]) => {
          if (cancelled) return;
          clearTimeout(fallback);
          // The chunk and probe may have taken a while (slow network, busy main thread); if the
          // budget is already blown by the time they resolve, don't bother starting 3D at all.
          const overBudget = (performance.now() - mountedAt) > LOAD_BUDGET_MS;
          setKind((k) => (k === 'wait' ? (overBudget || frame > 30 ? 'full' : '3d') : k));
        })
        .catch(() => !cancelled && setKind('full'));
    };
    const ric = typeof requestIdleCallback === 'function' ? requestIdleCallback : (fn: () => void, _opts?: { timeout?: number }) => setTimeout(fn, 0);
    const cic = typeof cancelIdleCallback === 'function' ? cancelIdleCallback : clearTimeout;
    const handle = ric(start, { timeout: 150 });
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      cic(handle as never);
    };
  }, [kind, mountedAt]);

  // Play the chosen version.
  useEffect(() => {
    if (kind === 'wait') return;
    if (kind !== '3d') {
      const total = DURATION[kind];
      const beep = kind === 'full' ? setTimeout(() => play('beep'), 860) : undefined;
      const t = setTimeout(() => finish.current(), total - (kind === 'short' ? 120 : 250));
      return () => {
        clearTimeout(t);
        clearTimeout(beep);
      };
    }
    let raf = 0;
    let disposed = false;
    let handle: import('./scene3d').IntroHandle | null = null;
    let beeped = false;
    void import('./scene3d').then(({ createIntroScene, INTRO_3D_MS }) => {
      if (disposed || !canvasRef.current) return;
      const buildStart = performance.now();
      try {
        handle = createIntroScene(canvasRef.current);
      } catch {
        setKind('full');
        return;
      }
      // Building the scene (shader compiles etc.) is synchronous and can itself be the slow
      // part under software GL. If it took too long, or the budget is already gone, don't
      // start a fresh 2 s animation on top of that — fall back to the 2D version instead.
      const buildMs = performance.now() - buildStart;
      if (buildMs > LOAD_BUDGET_MS / 2 || (performance.now() - mountedAt) > LOAD_BUDGET_MS) {
        handle.dispose();
        handle = null;
        setKind('full');
        return;
      }
      const start = performance.now();
      const onResize = () => handle?.resize();
      window.addEventListener('resize', onResize);
      const loop = (now: number) => {
        const ms = now - start;
        handle?.render(Math.min(ms, INTRO_3D_MS));
        if (!beeped && ms > 860) {
          beeped = true;
          play('beep');
        }
        if (ms >= INTRO_3D_MS - 250) finish.current();
        if (ms < INTRO_3D_MS + 300) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      const prev = handle.dispose;
      handle.dispose = () => {
        window.removeEventListener('resize', onResize);
        prev();
      };
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      handle?.dispose();
    };
  }, [kind, mountedAt]);

  // Tap or any key skips.
  useEffect(() => {
    if (mode === 'short') return;
    const skip = () => finish.current();
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [mode]);

  if (gone) return null;
  return (
    <div
      className={s.intro}
      data-kind={kind}
      data-leaving={leaving || undefined}
      data-mode={mode}
      data-testid="intro"
      onPointerDown={mode === 'full' ? () => finish.current() : undefined}
    >
      {kind === '3d' ? <canvas ref={canvasRef} className={s.canvas} aria-hidden="true" /> : kind === 'wait' ? null : <Door2D variant={kind} />}
      {mode === 'full' ? (
        <button type="button" className={s.skip} onClick={() => finish.current()}>
          Skip
        </button>
      ) : null}
    </div>
  );
}
