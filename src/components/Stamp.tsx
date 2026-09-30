import type { ReactNode } from 'react';
import s from './Stamp.module.css';

export interface StampProps {
  /** Big line, e.g. "5". */
  title: ReactNode;
  /** Small line, e.g. "hotels". */
  caption?: ReactNode;
  icon?: ReactNode;
  tone?: 'honey' | 'ginger' | 'cream';
  /** Not yet earned: dashed and muted. */
  locked?: boolean;
  size?: number;
  className?: string;
  label?: string;
}

/** Ink-outlined round badge shell for milestone stamps and mood stamps. */
export function Stamp({ title, caption, icon, tone = 'honey', locked, size = 96, className, label }: StampProps) {
  return (
    <span
      className={[s.stamp, s[tone], locked ? s.locked : '', className ?? ''].join(' ')}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? (typeof title === 'string' ? `${title}${typeof caption === 'string' ? ` ${caption}` : ''}` : undefined)}
    >
      <span className={s.ring} aria-hidden="true" />
      {icon ? <span className={s.icon} aria-hidden="true">{icon}</span> : null}
      <span className={s.title} aria-hidden="true">{title}</span>
      {caption ? <span className={s.caption} aria-hidden="true">{caption}</span> : null}
    </span>
  );
}
