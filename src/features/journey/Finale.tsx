/** Finale card (SPEC §10): stats roll in, then "To be continued…". Counting runs on refs, not state. */
import { useEffect, useRef, type ReactNode } from 'react';
import { formatKm } from '@/lib/geo';
import type { FinaleStats } from './data';
import s from './Journey.module.css';

const ROLL_MS = 1400;

function Stat({ value, label, format, delay, reduced }: { value: number; label: string; format(n: number): string; delay: number; reduced: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.textContent = format(value);
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / ROLL_MS));
      const eased = 1 - (1 - t) ** 3;
      el.textContent = format(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    el.textContent = format(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, format, delay, reduced]);
  return (
    <div className={s.stat} style={{ animationDelay: `${delay}ms` }}>
      <strong ref={ref} className={s.statValue}>
        {format(value)}
      </strong>
      <span className={s.statLabel}>{label}</span>
    </div>
  );
}

const plain = (n: number) => n.toLocaleString('en-GB');
const km = (n: number) => formatKm(n).replace(/ km$/, '');

export function Finale({ stats, reduced, actions }: { stats: FinaleStats; reduced: boolean; actions?: ReactNode }) {
  return (
    <section className={s.finale} aria-label="To be continued…" data-testid="journey-finale">
      <div className={s.stats} role="list">
        <div role="listitem">
          <Stat value={stats.hotels} label="Hotels" format={plain} delay={0} reduced={reduced} />
        </div>
        <div role="listitem">
          <Stat value={stats.cities} label="Cities" format={plain} delay={180} reduced={reduced} />
        </div>
        <div role="listitem">
          <Stat value={stats.countries} label="Countries" format={plain} delay={360} reduced={reduced} />
        </div>
        <div role="listitem">
          <Stat value={Math.round(stats.km)} label="Kilometres travelled" format={km} delay={540} reduced={reduced} />
        </div>
      </div>
      <p className={s.finaleTitle}>To be continued…</p>
      {actions ? <div className={s.finaleActions}>{actions}</div> : null}
    </section>
  );
}
