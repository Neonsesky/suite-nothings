import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { SPRING_UI, INSTANT, useReducedMotion } from '@/lib/motion';
import { toast, type ToastItem } from '@/lib/toast';
import { IconClose, IconUndo } from './icons';
import s from './Toast.module.css';

export { toast } from '@/lib/toast';

function ToastRow({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (item.durationMs === 0 || paused) return;
    const t = setTimeout(() => toast.dismiss(item.id), item.durationMs);
    return () => clearTimeout(t);
  }, [item.id, item.durationMs, paused]);
  return (
    <div
      className={[s.toast, s[item.tone]].join(' ')}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className={s.message}>{item.message}</span>
      {item.action ? (
        <button
          type="button"
          className={s.action}
          onClick={() => {
            item.action?.onClick();
            toast.dismiss(item.id);
          }}
        >
          {/^undo$/i.test(item.action.label) ? <IconUndo size={16} /> : null}
          {item.action.label}
        </button>
      ) : null}
      <button type="button" className={s.close} aria-label="Dismiss" onClick={() => toast.dismiss(item.id)}>
        <IconClose size={16} />
      </button>
    </div>
  );
}

/** Mount once (the shell does). Renders the imperative `toast` queue above the tab bar. */
export function ToastHost() {
  const [items, setItems] = useState<readonly ToastItem[]>(() => toast.getAll());
  const reduced = useReducedMotion();
  useEffect(() => toast.subscribe(setItems), []);
  return (
    <div className={s.host} role="status" aria-live="polite" aria-relevant="additions text">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout={!reduced}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={reduced ? INSTANT : SPRING_UI}
          >
            <ToastRow item={item} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
