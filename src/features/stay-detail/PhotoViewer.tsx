/**
 * Full-screen photo viewer for the Stay detail screen (SPEC §14).
 * - Swipe left/right between photos (1:1 drag, spring back or snap on distance/velocity).
 * - Pinch-zoom (1x–4x) with clamped pan; double-tap/double-click toggles 1x↔2.5x.
 * - Esc closes, ArrowLeft/Right navigate, focus is trapped and restored on close.
 */
import { animate, motion, useMotionValue } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StayArt } from '@/components/StayArt';
import { IconChevron, IconClose } from '@/components/icons';
import { usePhotoUrl } from '@/data/store';
import { INSTANT, SPRING_THROW, SPRING_UI, useReducedMotion } from '@/lib/motion';
import s from './PhotoViewer.module.css';

export interface ViewerItem {
  photoId: string | null;
  /** Hotel/stay seed for the StayArt fallback when there's no photo. */
  artSeed: string;
  caption?: string | null;
}

export interface PhotoViewerProps {
  items: ViewerItem[];
  /** null = closed. */
  index: number | null;
  onIndexChange(i: number): void;
  onClose(): void;
  /** Hotel name, used for the dialog's accessible label. */
  title: string;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_DISTANCE_RATIO = 0.25;
const SWIPE_VELOCITY = 500; // px/s
const TAP_SLOP = 10; // px
const RUBBER = 0.55;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
function rubberband(overshoot: number, dimension: number): number {
  return (1 - 1 / ((overshoot * RUBBER) / dimension + 1)) * dimension;
}
function maxPan(scale: number, dimension: number): number {
  return Math.max(0, (dimension * (scale - 1)) / 2);
}

export function PhotoViewer(props: PhotoViewerProps) {
  if (props.index == null || typeof document === 'undefined') return null;
  return createPortal(<ViewerDialog {...props} index={props.index} />, document.body);
}

/** Loads the full photo (falling back to the thumb, then StayArt). Own component so hooks are per-item. */
function ViewerImage({ item }: { item: ViewerItem }) {
  const full = usePhotoUrl(item.photoId, 'full');
  const thumb = usePhotoUrl(item.photoId, 'thumb');
  const src = full ?? thumb;
  if (item.photoId && src) return <img src={src} alt={item.caption ?? ''} className={s.img} draggable={false} />;
  return <StayArt seed={item.artSeed} className={s.art} />;
}

type Gesture =
  | { mode: 'idle' }
  | { mode: 'swipe'; pointerId: number; startX: number; startTrackX: number; samples: { t: number; x: number }[] }
  | { mode: 'pan'; pointerId: number; startX: number; startY: number; startPanX: number; startPanY: number }
  | { mode: 'pinch'; startDist: number; startScale: number; startPanX: number; startPanY: number; startMidX: number; startMidY: number };

function ViewerDialog({ items, index, onIndexChange, onClose, title }: PhotoViewerProps & { index: number }) {
  const reduced = useReducedMotion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [stageWidth, setStageWidth] = useState(0);

  const trackX = useMotionValue(0);
  const scale = useMotionValue(1);
  const panX = useMotionValue(0);
  const panY = useMotionValue(0);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>({ mode: 'idle' });
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    setStageWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setStageWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the track aligned to `index` while idle (a live swipe drives it itself).
  useEffect(() => {
    if (gesture.current.mode === 'swipe') return;
    void animate(trackX, -index * stageWidth, reduced ? INSTANT : SPRING_THROW);
  }, [index, stageWidth, reduced, trackX]);

  // Reset zoom whenever the photo changes.
  useEffect(() => {
    scale.set(1);
    panX.set(0);
    panY.set(0);
  }, [index, scale, panX, panY]);

  // Initial focus, body scroll lock, restore focus on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevOverflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  // Esc / arrow keys / focus trap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        if (index > 0) onIndexChange(index - 1);
      } else if (e.key === 'ArrowRight') {
        if (index < items.length - 1) onIndexChange(index + 1);
      } else if (e.key === 'Tab') {
        const panel = overlayRef.current;
        if (!panel) return;
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;
        e.preventDefault();
        const i = focusables.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (i <= 0 ? focusables.length - 1 : i - 1) : i < 0 || i === focusables.length - 1 ? 0 : i + 1;
        focusables[next].focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [index, items.length, onClose, onIndexChange]);

  function setClampedPan(x: number, y: number, atScale: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 0;
    const h = rect?.height ?? 0;
    panX.set(clamp(x, -maxPan(atScale, w), maxPan(atScale, w)));
    panY.set(clamp(y, -maxPan(atScale, h), maxPan(atScale, h)));
  }

  function computeZoomPan(clientX: number, clientY: number, target: number) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || target <= 1) return { x: 0, y: 0 };
    const relX = clientX - (rect.left + rect.width / 2);
    const relY = clientY - (rect.top + rect.height / 2);
    return {
      x: clamp(-relX * (target - 1), -maxPan(target, rect.width), maxPan(target, rect.width)),
      y: clamp(-relY * (target - 1), -maxPan(target, rect.height), maxPan(target, rect.height)),
    };
  }

  function applyZoomAnimated(clientX: number, clientY: number, target: number) {
    const { x, y } = computeZoomPan(clientX, clientY, target);
    const t = reduced ? INSTANT : SPRING_UI;
    void animate(scale, target, t);
    void animate(panX, x, t);
    void animate(panY, y, t);
  }

  function applyZoomInstant(clientX: number, clientY: number, target: number) {
    const { x, y } = computeZoomPan(clientX, clientY, target);
    scale.set(target);
    panX.set(x);
    panY.set(y);
  }

  function springTrackTo(i: number) {
    void animate(trackX, -i * stageWidth, reduced ? INSTANT : SPRING_THROW);
  }

  function maybeDoubleTap(clientX: number, clientY: number, t: number) {
    const last = lastTap.current;
    lastTap.current = { t, x: clientX, y: clientY };
    if (last && t - last.t < 300 && dist(last, { x: clientX, y: clientY }) < 24) {
      lastTap.current = null;
      applyZoomAnimated(clientX, clientY, scale.get() > 1 ? 1 : DOUBLE_TAP_SCALE);
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { mode: 'pinch', startDist: dist(a, b), startScale: scale.get(), startPanX: panX.get(), startPanY: panY.get(), startMidX: (a.x + b.x) / 2, startMidY: (a.y + b.y) / 2 };
    } else if (pointers.current.size === 1) {
      gesture.current =
        scale.get() > 1
          ? { mode: 'pan', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startPanX: panX.get(), startPanY: panY.get() }
          : { mode: 'swipe', pointerId: e.pointerId, startX: e.clientX, startTrackX: trackX.get(), samples: [{ t: e.timeStamp, x: e.clientX }] };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g.mode === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      const nextScale = clamp(g.startScale * (dist(a, b) / g.startDist), ZOOM_MIN, ZOOM_MAX);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      setClampedPan(g.startPanX + (midX - g.startMidX), g.startPanY + (midY - g.startMidY), nextScale);
      scale.set(nextScale);
    } else if (g.mode === 'pan' && g.pointerId === e.pointerId) {
      setClampedPan(g.startPanX + (e.clientX - g.startX), g.startPanY + (e.clientY - g.startY), scale.get());
    } else if (g.mode === 'swipe' && g.pointerId === e.pointerId) {
      const dx = e.clientX - g.startX;
      let next = g.startTrackX + dx;
      const minX = -(items.length - 1) * stageWidth;
      if (next > 0) next = rubberband(next, stageWidth || 1);
      else if (next < minX) next = minX - rubberband(minX - next, stageWidth || 1);
      trackX.set(next);
      g.samples.push({ t: e.timeStamp, x: e.clientX });
      if (g.samples.length > 6) g.samples.shift();
    }
  };

  const endGesture = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.mode === 'swipe' && g.pointerId === e.pointerId) {
      gesture.current = { mode: 'idle' };
      const a = g.samples[0];
      const b = g.samples[g.samples.length - 1];
      const velocity = ((b.x - a.x) / Math.max(1, b.t - a.t)) * 1000;
      const dx = trackX.get() - g.startTrackX;
      let target = index;
      if (dx < -stageWidth * SWIPE_DISTANCE_RATIO || velocity < -SWIPE_VELOCITY) target = Math.min(items.length - 1, index + 1);
      else if (dx > stageWidth * SWIPE_DISTANCE_RATIO || velocity > SWIPE_VELOCITY) target = Math.max(0, index - 1);
      if (target !== index) onIndexChange(target);
      else springTrackTo(index);
      if (Math.abs(dx) < TAP_SLOP) maybeDoubleTap(e.clientX, e.clientY, e.timeStamp);
    } else if (g.mode === 'pan' && g.pointerId === e.pointerId) {
      gesture.current = { mode: 'idle' };
      if (dist({ x: g.startX, y: g.startY }, { x: e.clientX, y: e.clientY }) < TAP_SLOP) maybeDoubleTap(e.clientX, e.clientY, e.timeStamp);
    } else if (g.mode === 'pinch' && pointers.current.size < 2) {
      gesture.current = { mode: 'idle' };
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!stageRef.current) return;
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.02 : 0.01));
    applyZoomInstant(e.clientX, e.clientY, clamp(scale.get() * factor, ZOOM_MIN, ZOOM_MAX));
  };

  const caption = items[index]?.caption;

  return (
    <div ref={overlayRef} className={s.overlay} role="dialog" aria-modal="true" aria-label={`${title} photos`}>
      <button ref={closeRef} type="button" className={s.close} aria-label="Close photos" onClick={onClose}>
        <IconClose size={22} />
      </button>
      <button type="button" className={`${s.nav} ${s.prev}`} aria-label="Previous photo" disabled={index === 0} onClick={() => onIndexChange(index - 1)}>
        <IconChevron size={26} className={s.flip} />
      </button>
      <button type="button" className={`${s.nav} ${s.next}`} aria-label="Next photo" disabled={index === items.length - 1} onClick={() => onIndexChange(index + 1)}>
        <IconChevron size={26} />
      </button>
      <div ref={stageRef} className={s.stage} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endGesture} onPointerCancel={endGesture} onWheel={onWheel}>
        <motion.div className={s.track} style={{ x: trackX }}>
          {items.map((item, i) => (
            <div className={s.slide} key={item.photoId ?? `${item.artSeed}-${i}`}>
              {Math.abs(i - index) <= 1 ? (
                i === index ? (
                  <motion.div className={s.zoomLayer} style={{ x: panX, y: panY, scale }}>
                    <ViewerImage item={item} />
                  </motion.div>
                ) : (
                  <ViewerImage item={item} />
                )
              ) : null}
            </div>
          ))}
        </motion.div>
      </div>
      <div className={s.footer}>
        <p className={s.counter}>
          {index + 1} / {items.length}
        </p>
        {caption ? <p className={s.caption}>{caption}</p> : null}
      </div>
    </div>
  );
}
