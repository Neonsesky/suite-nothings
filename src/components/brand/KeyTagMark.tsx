/*
 * The Suite Nothings mark: an oval hotel key fob on a split ring, embossed 619 (for 19 June).
 * Geometry mirrors design/tools/mark.mjs, which renders the favicon and PWA icons.
 *
 * Variants
 *  - full:    honey fob, ink outline (default; for light surfaces)
 *  - mono:    solid currentColor silhouette with the number knocked out
 *  - outline: currentColor strokes only, no fill
 */
import { useId, type ReactElement } from 'react';

export type KeyTagMarkProps = {
  size?: number;
  title?: string;
  variant?: 'full' | 'mono' | 'outline';
  className?: string;
};

const FOB =
  'M-24.5 0C-24.5-4.6-19.8-8.2-12.5-10.4C-7.4-11.9-2.2-12.6 3-12.6C16.2-12.6 25.5-7.4 25.5 0C25.5 7.4 16.2 12.6 3 12.6C-2.2 12.6-7.4 11.9-12.5 10.4C-19.8 8.2-24.5 4.6-24.5 0Z';
const FOB_INNER =
  'M-10.5-6.9C-6.3-8.1-2 -8.7 2.6-8.7C13.2-8.7 20.6-5.2 20.6 0C20.6 5.2 13.2 8.7 2.6 8.7C-2 8.7-6.3 8.1-10.5 6.9C-13.2 6.1-14.6 3.4-14.6 0C-14.6-3.4-13.2-6.1-10.5-6.9Z';
const DIGITS =
  'M-3.1-5.2C-6.4-4.6-8.9-1.9-8.9 1.6M-5.9 5.5A3 3 0 1 0-5.9-0.5A3 3 0 1 0-5.9 5.5ZM0.7-3.6L3.4-5.5V5.5M11.9-5.5A3 3 0 1 0 11.9 0.5A3 3 0 1 0 11.9-5.5ZM14.9-2.5C14.9 1.4 12.8 4.4 9.2 5.4';
const HOLE = { cx: -17.4, cy: 0, r: 2.9 };
const RING = { cx: -26.2, cy: 2.2, r: 9 };

const INK = 'var(--color-ink, #1A1A1A)';
const HONEY = 'var(--color-honey, #FFC83D)';
const PAPER = 'var(--color-paper, #FFFFFF)';

export function KeyTagMark({
  size = 32,
  title,
  variant = 'full',
  className,
}: KeyTagMarkProps): ReactElement {
  const clipId = `kt-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const mono = variant === 'mono';
  const ink = variant === 'full' ? INK : 'currentColor';
  const holeFill = variant === 'outline' ? 'none' : PAPER;
  const fobFill = variant === 'full' ? HONEY : 'none';
  const ring = (
    <circle cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" style={{ stroke: ink }} strokeWidth={2.6} />
  );

  const digits = (stroke: string) => (
    <path
      d={DIGITS}
      fill="none"
      style={{ stroke }}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        {mono ? (
          /* mono knocks the hole and the number out of the silhouette, so it works on any surface */
          <mask id={clipId} maskUnits="userSpaceOnUse" x="-40" y="-20" width="80" height="40">
            <rect x="-40" y="-20" width="80" height="40" fill="#fff" />
            <circle cx={HOLE.cx} cy={HOLE.cy} r={HOLE.r} fill="#000" />
            {digits('#000')}
          </mask>
        ) : (
          <clipPath id={clipId}>
            <circle cx={HOLE.cx} cy={HOLE.cy} r={HOLE.r - 0.9} />
          </clipPath>
        )}
      </defs>
      <g transform="translate(36.6 33.4) scale(0.9) rotate(-33)">
        {mono ? (
          <g mask={`url(#${clipId})`}>
            {ring}
            <path d={FOB} fill="currentColor" stroke="currentColor" strokeWidth={2.6} strokeLinejoin="round" />
          </g>
        ) : (
          <>
            {ring}
            <path
              d={FOB}
              style={{ fill: fobFill, stroke: ink }}
              strokeWidth={2.6}
              strokeLinejoin="round"
            />
            <path d={FOB_INNER} fill="none" style={{ stroke: ink }} strokeWidth={1.3} opacity={0.5} />
            <circle
              cx={HOLE.cx}
              cy={HOLE.cy}
              r={HOLE.r}
              style={{ fill: holeFill, stroke: ink }}
              strokeWidth={1.8}
            />
            <g clipPath={`url(#${clipId})`}>{ring}</g>
            {digits(ink)}
          </>
        )}
      </g>
    </svg>
  );
}

export default KeyTagMark;
