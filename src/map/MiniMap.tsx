/**
 * MiniMap: a small, lazy 3D map tile with a pin (stay detail, save celebration) or, with
 * `interactive` + `onMove`, a pin picker whose centre crosshair stays put while the map pans.
 * Shows a StayArt tile while MapLibre loads, before it scrolls into view, or without WebGL.
 */
import { useEffect, useRef, useState } from 'react';
import { pinDataUrl, stayPin } from '@/components/brand/pins';
import { StayArt } from '@/components/StayArt';
import { useSettings } from '@/data/store';
import { useReducedMotion } from '@/lib/motion';
import type { SuiteMap } from './engine';
import s from './MiniMap.module.css';

export interface MiniMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  pitch?: number;
  /** Animate a pin drop on mount (save celebration). */
  dropPin?: boolean;
  /** Pin / accessible label, e.g. the hotel name. */
  label?: string;
  className?: string;
  /** With `onMove`: a pin picker with a centre crosshair; the map pans under it. */
  interactive?: boolean;
  onMove?(center: { lat: number; lng: number }): void;
}

const PIN = pinDataUrl(stayPin({ selected: true }));

export function MiniMap({ lat, lng, zoom = 15, pitch = 50, dropPin, label, className, interactive, onMove }: MiniMapProps) {
  const home = useSettings().home_base;
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SuiteMap | null>(null);
  const onMoveRef = useRef(onMove);
  const lastEmitted = useRef<{ lat: number; lng: number } | null>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  const [state, setState] = useState<'idle' | 'ready' | 'failed'>('idle');
  const [moving, setMoving] = useState(false);
  const picker = Boolean(interactive && onMove);

  useEffect(() => {
    onMoveRef.current = onMove;
  });

  // Only spin up WebGL once the tile is (nearly) on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = mapRef.current;
    if (!visible || !el) return;
    let cancelled = false;
    let engine: SuiteMap | null = null;
    void (async () => {
      const mod = await import('./engine');
      if (cancelled) return;
      if (!mod.supportsWebGL()) return setState('failed');
      try {
        engine = await mod.createSuiteMap(el, {
          home,
          interactive: Boolean(interactive),
          overlays: false,
          settle: false,
          reducedMotion: reduced,
          camera: { center: [lng, lat], zoom, pitch, bearing: -14 },
        });
      } catch {
        if (!cancelled) setState('failed');
        return;
      }
      if (cancelled) return engine.destroy();
      engineRef.current = engine;
      const m = engine.map;
      m.once('load', () => !cancelled && setState('ready'));
      if (interactive) {
        m.on('movestart', () => setMoving(true));
        m.on('moveend', () => {
          setMoving(false);
          const c = m.getCenter();
          const next = { lat: Math.round(c.lat * 1e6) / 1e6, lng: Math.round(c.lng * 1e6) / 1e6 };
          lastEmitted.current = next;
          onMoveRef.current?.(next);
        });
      }
    })();
    return () => {
      cancelled = true;
      engine?.destroy();
      engineRef.current = null;
    };
    // Created once per visibility; camera props are applied below without a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, interactive]);

  // Follow prop changes (but not the echo of our own onMove).
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const last = lastEmitted.current;
    if (last && Math.abs(last.lat - lat) < 1e-6 && Math.abs(last.lng - lng) < 1e-6) return;
    const camera = { center: [lng, lat] as [number, number], zoom, pitch };
    if (reduced) e.map.jumpTo(camera);
    else e.map.easeTo({ ...camera, duration: 800 });
  }, [lat, lng, zoom, pitch, reduced, state]);

  const name = label ? `Map showing ${label}` : `Map at ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  return (
    <div
      ref={rootRef}
      className={[s.root, className ?? ''].join(' ')}
      role={picker ? 'group' : 'img'}
      aria-label={picker ? `${name}. Drag the map to move the pin.` : name}
      data-interactive={interactive || undefined}
      data-state={state}
    >
      {state !== 'ready' ? <StayArt seed={`${lat.toFixed(2)},${lng.toFixed(2)}`} motif="skyline" className={s.art} /> : null}
      <div ref={mapRef} className={s.map} aria-hidden={!picker} />
      <span className={[s.pin, dropPin && !reduced ? s.drop : '', moving ? s.lift : ''].join(' ')} aria-hidden="true">
        <img src={PIN} alt="" width={44} height={58} draggable={false} />
      </span>
      {picker ? <span className={s.crosshair} aria-hidden="true" /> : null}
      {state === 'ready' ? <span className={s.credit}>© OpenStreetMap · OpenFreeMap</span> : null}
    </div>
  );
}

export default MiniMap;
