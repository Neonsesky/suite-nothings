/** The key-tag mark plus wordmark, for headers, splash and About. Reuses KeyTagMark's geometry. */
import type { ReactElement } from 'react';
import { COUPLE } from '@/config/couple';
import { KeyTagMark, type KeyTagMarkProps } from './KeyTagMark';

export type AppLogoProps = {
  size?: number;
  variant?: 'full' | 'mark-only' | 'mono';
  title?: string;
  className?: string;
};

export function AppLogo({ size = 32, variant = 'full', title, className }: AppLogoProps): ReactElement {
  const markVariant: KeyTagMarkProps['variant'] = variant === 'mono' ? 'mono' : 'full';
  const mark = <KeyTagMark size={size} variant={markVariant} title={variant === 'mark-only' ? (title ?? COUPLE.appName) : undefined} />;

  if (variant === 'mark-only') return mark;

  return (
    <span
      className={className}
      role="img"
      aria-label={title ?? COUPLE.appName}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.28,
        color: variant === 'mono' ? 'currentColor' : 'var(--color-ink, #292935)',
      }}
    >
      {mark}
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'var(--font-display, Manrope, sans-serif)',
          fontWeight: 800,
          letterSpacing: '-0.01em',
          fontSize: size * 0.56,
          lineHeight: 1,
        }}
      >
        {COUPLE.appName}
      </span>
    </span>
  );
}

export default AppLogo;
