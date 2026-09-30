/**
 * BottomSheet — draggable sheet with snap points (SPEC §14, §15).
 * - Tracks the finger 1:1 from the grab offset; rubber-bands past the top snap.
 * - On release, picks a snap (or closes) from the projected position + velocity, then springs
 *   there with SPRING_SHEET and the drag velocity handed off.
 * - Scrim, focus trap, Esc to close, 100dvh, safe-area insets, contained overscroll.
 * - At desktop widths (≥ 64rem) it renders as a centred modal (no drag).
 */
import { animate, motion, useMotionValue, useTransform, type AnimationPlaybackControls } from 'motion/react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { INSTANT, SPRING_SHEET, SPRING_UI, useReducedMotion } from '@/lib/motion';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { IconClose } from './icons';
import s from './BottomSheet.module.css';

export interface BottomSheetProps {
  open: boolean;
  /** Called when the user dismisses (scrim, Esc, drag down, close button). */
  onClose(): void;
  /** Accessible name; also the visible header unless `hideTitle`. */
  title: string;
  hideTitle?: boolean;
  /** Visible heights as fractions of the viewport, ascending, e.g. [0.5, 0.92]. Default [0.92]. */
  snapPoints?: number[];
  /** Index into snapPoints to open at. Default: the last (tallest). */
  initialSnap?: number;
  onSnapChange?(index: number): void;
  /** Sticky footer (primary action) inside the safe area. */
  footer?: ReactNode;
  /** Right side of the header (e.g. a step counter). */
  headerExtra?: ReactNode;
  /** Set false to block scrim/Esc/drag dismissal (e.g. unsaved form confirms first). */
  dismissible?: boolean;
  /** Desktop presentation. Default 'center'. */
  desktop?: 'center' | 'sheet';
  className?: string;
  children: ReactNode;
}

const RUBBER = 0.55;
function rubberband(overshoot: number, dimension: number): number {
  return (1 - 1 / ((overshoot * RUBBER) / dimension + 1)) * dimension;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Pure: choose a snap index or -1 (close) from the release position and velocity (px, px/s). */
export function pickSnap(y: number, velocity: number, snapYs: readonly number[], closedY: number): number {
  // snapYs are translateY offsets for each snap, descending (index 0 = lowest sheet = largest y).
  const projected = y + velocity * 0.18;
  const FLICK = 700;
  const current = snapYs.reduce((best, sy, i) => (Math.abs(sy - y) < Math.abs(snapYs[best] - y) ? i : best), 0);
  if (velocity > FLICK) return current === 0 || y > snapYs[0] ? -1 : Math.max(0, current - 1);
  if (velocity < -FLICK) return Math.min(snapYs.length - 1, y < snapYs[current] ? current + 1 : Math.max(current, nearestIdx(projected, snapYs)));
  const closeThreshold = snapYs[0] + (closedY - snapYs[0]) * 0.45;
  if (projected > closeThreshold) return -1;
  return nearestIdx(projected, snapYs);
}
function nearestIdx(y: number, snapYs: readonly number[]): number {
  return snapYs.reduce((best, sy, i) => (Math.abs(sy - y) < Math.abs(snapYs[best] - y) ? i : best), 0);
}

export function BottomSheet(props: BottomSheetProps) {
  const [mounted, setMounted] = useState(props.open);
  const [prevOpen, setPrevOpen] = useState(props.open);
  if (props.open !== prevOpen) {
    setPrevOpen(props.open);
    if (props.open) setMounted(true);
  }
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(<SheetInner {...props} onExited={() => setMounted(false)} />, document.body);
}

function SheetInner({
  open,
  onClose,
  title,
  hideTitle,
  snapPoints = [0.92],
  initialSnap,
  onSnapChange,
  footer,
  headerExtra,
  dismissible = true,
  desktop = 'center',
  className,
  children,
  onExited,
}: BottomSheetProps & { onExited(): void }) {
  const reduced = useReducedMotion();
  const isDesktop = useIsDesktop() && desktop === 'center';
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [vh, setVh] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight));
  const maxSnap = Math.max(...snapPoints);
  const sheetH = Math.round(vh * maxSnap);
  const snapYs = snapPoints.map((p) => Math.round(sheetH - vh * p)); // translateY per snap
  const closedY = sheetH + 24;
  const y = useMotionValue(closedY);
  const scrimOpacity = useTransform(y, [closedY, snapYs[0] ?? 0], [0, 1]);
  const snapRef = useRef(initialSnap ?? snapPoints.length - 1);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const closingByUser = useRef(false);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const springTo = useCallback(
    (target: number, velocity = 0, done?: () => void) => {
      anim.current?.stop();
      if (reduced) {
        y.set(target);
        done?.();
        return;
      }
      anim.current = animate(y, target, { ...SPRING_SHEET, velocity });
      if (done) void anim.current.finished.then(done);
    },
    [reduced, y],
  );

  // Open / close in response to the `open` prop.
  useLayoutEffect(() => {
    if (isDesktop) {
      if (!open) {
        const t = setTimeout(onExited, reduced ? 0 : 180);
        return () => clearTimeout(t);
      }
      return;
    }
    if (open) {
      springTo(snapYs[snapRef.current] ?? 0);
    } else if (closingByUser.current) {
      onExited();
    } else {
      springTo(closedY, 0, onExited);
    }
    // snapYs changes with vh; re-run only on open/viewport changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isDesktop, sheetH]);

  // Focus management, Esc, scroll lock.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel;
    first?.focus({ preventScroll: true });
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (items.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === firstEl || document.activeElement === panel)) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      html.style.overflow = prevOverflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, dismissible, onClose]);

  // ── drag ──
  const drag = useRef<{ id: number; startY: number; startSheetY: number; samples: { t: number; y: number }[]; active: boolean; fromContent: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (isDesktop || e.button !== 0) return;
    const target = e.target as HTMLElement;
    const fromContent = !!contentRef.current?.contains(target);
    if (fromContent && (contentRef.current!.scrollTop > 0 || target.closest('input,textarea,select,[data-no-drag]'))) return;
    anim.current?.stop();
    drag.current = { id: e.pointerId, startY: e.clientY, startSheetY: y.get(), samples: [{ t: e.timeStamp, y: e.clientY }], active: !fromContent, fromContent };
    if (!fromContent) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    if (!d.active) {
      // From scrollable content: only take over for a downward pull at scrollTop 0.
      if (Math.abs(dy) < 6) return;
      if (dy < 0 || contentRef.current!.scrollTop > 0) {
        drag.current = null;
        return;
      }
      d.active = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    const top = snapYs[snapYs.length - 1];
    let next = d.startSheetY + dy;
    if (next < top) next = top - rubberband(top - next, vh);
    y.set(next);
    d.samples.push({ t: e.timeStamp, y: e.clientY });
    if (d.samples.length > 6) d.samples.shift();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.active) return;
    const a = d.samples[0];
    const b = d.samples[d.samples.length - 1];
    const dt = Math.max(1, b.t - a.t);
    const velocity = ((b.y - a.y) / dt) * 1000;
    const idx = pickSnap(y.get(), velocity, snapYs, closedY);
    if (idx < 0 && dismissible) {
      closingByUser.current = true;
      springTo(closedY, velocity, () => onClose());
    } else {
      const i = idx < 0 ? 0 : idx;
      if (i !== snapRef.current) {
        snapRef.current = i;
        onSnapChange?.(i);
      }
      springTo(snapYs[i], velocity);
    }
  };

  const header = (
    <div className={s.header}>
      <h2 id={titleId} className={hideTitle ? 'sr-only' : s.title}>
        {title}
      </h2>
      {headerExtra}
      {dismissible ? (
        <button type="button" className={s.close} aria-label="Close" onClick={onClose} data-no-drag>
          <IconClose size={20} />
        </button>
      ) : null}
    </div>
  );

  if (isDesktop) {
    return (
      <div className={s.layer} data-sheet-state={open ? 'open' : 'closing'}>
        <motion.div
          className={s.scrim}
          initial={{ opacity: 0 }}
          animate={{ opacity: open ? 1 : 0 }}
          transition={reduced ? INSTANT : SPRING_UI}
          onClick={dismissible ? onClose : undefined}
          aria-hidden="true"
        />
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={[s.panel, s.modal, className ?? ''].join(' ')}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
          animate={open ? { opacity: 1, scale: 1, y: 0 } : reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
          transition={reduced ? INSTANT : SPRING_UI}
        >
          {header}
          <div ref={contentRef} className={s.content}>
            {children}
          </div>
          {footer ? <div className={s.footer}>{footer}</div> : null}
        </motion.div>
      </div>
    );
  }

  return (
    <div className={s.layer} data-sheet-state={open ? 'open' : 'closing'}>
      <motion.div className={s.scrim} style={{ opacity: scrimOpacity }} onClick={dismissible ? onClose : undefined} aria-hidden="true" />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[s.panel, s.sheet, className ?? ''].join(' ')}
        style={{ y, height: sheetH }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-testid="bottom-sheet"
      >
        <div className={s.grab} aria-hidden="true">
          <span className={s.handle} />
        </div>
        {header}
        <div ref={contentRef} className={s.content}>
          {children}
        </div>
        {footer ? <div className={s.footer}>{footer}</div> : null}
      </motion.div>
    </div>
  );
}
