import s from './ClockLoader.module.css';

export interface ClockLoaderProps {
  size?: number;
  /** Accessible status text. */
  label?: string;
  className?: string;
}

/** Loader: a clock face with sweeping hands (time is the motif). */
export function ClockLoader({ size = 48, label = 'Loading', className }: ClockLoaderProps) {
  return (
    <span role="status" aria-live="polite" className={[s.root, className ?? ''].join(' ')}>
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={s.svg}>
        <circle cx="24" cy="24" r="21" className={s.face} />
        {[0, 90, 180, 270].map((a) => (
          <line key={a} x1="24" y1="6" x2="24" y2="9" className={s.tick} transform={`rotate(${a} 24 24)`} />
        ))}
        <line x1="24" y1="24" x2="24" y2="13" className={`${s.hand} ${s.hour}`} />
        <line x1="24" y1="24" x2="24" y2="8.5" className={`${s.hand} ${s.minute}`} />
        <circle cx="24" cy="24" r="2" className={s.pin} />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
