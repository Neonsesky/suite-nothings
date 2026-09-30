import type { HTMLAttributes, ReactNode } from 'react';
import s from './Badge.module.css';

export type BadgeTone = 'honey' | 'ginger' | 'ink' | 'cream' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: ReactNode;
}

/** Small pill badge (sits where Dayuse puts the discount badge). */
export function Badge({ tone = 'honey', icon, className, children, ...rest }: BadgeProps) {
  return (
    <span className={[s.badge, s[tone], className ?? ''].join(' ')} {...rest}>
      {icon ? <span className={s.icon} aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}
