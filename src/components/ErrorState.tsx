import type { ReactNode } from 'react';
import { Button } from './Button';
import { IconSync } from './icons';
import s from './EmptyState.module.css';

export interface ErrorStateProps {
  /** What happened, in our voice. */
  title: string;
  /** What to do about it. */
  body?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/** Error state: says what happened and what to do. Never "Something went wrong" alone. */
export function ErrorState({ title, body, onRetry, retryLabel = 'Try again', className }: ErrorStateProps) {
  return (
    <section className={[s.root, className ?? ''].join(' ')} role="alert">
      <h2 className={s.title}>{title}</h2>
      {body ? <p className={s.body}>{body}</p> : null}
      {onRetry ? (
        <div className={s.action}>
          <Button variant="secondary" icon={<IconSync size={18} />} onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
