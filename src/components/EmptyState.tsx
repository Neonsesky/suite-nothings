import type { ReactNode } from 'react';
import s from './EmptyState.module.css';

export interface EmptyStateProps {
  title: string;
  body?: ReactNode;
  /** Illustration or icon above the title. */
  art?: ReactNode;
  /** Usually one <Button>. */
  action?: ReactNode;
  className?: string;
}

/** Designed empty state: art, title, one line, one action. */
export function EmptyState({ title, body, art, action, className }: EmptyStateProps) {
  return (
    <section className={[s.root, className ?? ''].join(' ')} aria-label={title}>
      {art ? <div className={s.art} aria-hidden="true">{art}</div> : null}
      <h2 className={s.title}>{title}</h2>
      {body ? <p className={s.body}>{body}</p> : null}
      {action ? <div className={s.action}>{action}</div> : null}
    </section>
  );
}
