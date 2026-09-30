import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import s from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'celebrate';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon element. */
  icon?: ReactNode;
  /** Trailing icon element. */
  iconEnd?: ReactNode;
  block?: boolean;
  /** Shows a spinner-free busy state and disables the button. */
  busy?: boolean;
}

/** Buttons: primary (ink), secondary (outlined), ghost (text), celebrate (ginger, love moments only). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconEnd, block, busy, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[s.button, s[variant], s[size], block ? s.block : '', className ?? ''].join(' ')}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {icon ? <span className={s.icon}>{icon}</span> : null}
      {children != null ? <span className={s.label}>{children}</span> : null}
      {iconEnd ? <span className={s.icon}>{iconEnd}</span> : null}
    </button>
  );
});

/** Link styled as a button (for hash routes / external links). */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  block,
  className,
  children,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode; block?: boolean }) {
  return (
    <a className={[s.button, s[variant], s[size], block ? s.block : '', className ?? ''].join(' ')} {...rest}>
      {icon ? <span className={s.icon}>{icon}</span> : null}
      <span className={s.label}>{children}</span>
    </a>
  );
}
