/*
 * Mood stamps: ink-outlined rubber stamps for a stay's `mood` field.
 * Each stamp is a round postmark with a perforated inner ring, a glyph, and the label set
 * along the bottom arc. Stamps sit at a slight tilt, like they were pressed by hand.
 */
import { useId, type ReactElement } from 'react';

export type MoodId =
  | 'blissful'
  | 'lazy'
  | 'fancy'
  | 'giggly'
  | 'romantic'
  | 'adventurous'
  | 'cosy'
  | 'fizzy';

type Glyph = () => ReactElement;

/* Glyphs are drawn on a 24 px grid and placed in the stamp's centre. */
const glyphs: Record<MoodId, Glyph> = {
  blissful: () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M7.8 10.6q1.4-1.6 2.8 0M13.4 10.6q1.4-1.6 2.8 0M8.5 14.2q3.5 3.4 7 0" />
    </>
  ),
  lazy: () => (
    <>
      <path d="M4 20.5v-9M4 17.5h16v3M20 17.5V15a2 2 0 0 0-2-2h-7.5v4.5" />
      <circle cx="7.3" cy="14.2" r="1.6" />
      <path d="M12.5 3.5h3.5l-3.5 4h3.5M17.5 6.5H20l-2.5 3H20" />
    </>
  ),
  fancy: () => (
    <>
      <path d="M12 12 4.5 7.5v9zM12 12l7.5-4.5v9z" />
      <rect x="10.4" y="10.3" width="3.2" height="3.4" rx="1" />
    </>
  ),
  giggly: () => (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M7.6 9.9 10 11l-2.4 1.1M16.4 9.9 14 11l2.4 1.1" />
      <path d="M8 14.5h8a4 4 0 0 1-8 0z" />
    </>
  ),
  romantic: () => (
    <>
      <path
        d="M11 20s-7-4.3-7-9.4A4 4 0 0 1 11 8.2a4 4 0 0 1 7 2.4C18 15.7 11 20 11 20z"
        style={{ fill: 'var(--color-ginger, #FC5E57)' }}
      />
      <path d="M18.5 3v3.5M16.75 4.75h3.5" />
    </>
  ),
  adventurous: () => (
    <>
      <path d="M3 19.5 9.5 9l3.2 5 2.3-3.2 6 8.7z" />
      <path d="M9.5 9V3.8l4 1.4-4 1.5" />
    </>
  ),
  cosy: () => (
    <>
      <path d="M5 10.5h11v5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 15.5z" />
      <path d="M16 12h1.3a2.2 2.2 0 0 1 0 4.4H16" />
      <path d="M8.5 7.5c-.8-1 .8-1.8 0-3M12.5 7.5c-.8-1 .8-1.8 0-3" />
    </>
  ),
  fizzy: () => (
    <>
      <path d="M5.5 8.5h11a5.5 5.5 0 0 1-11 0zM11 14v6M8 20.5h6" />
      <circle cx="16.5" cy="4.5" r="1" />
      <circle cx="19.5" cy="7" r=".8" />
      <circle cx="13" cy="4" r=".7" />
    </>
  ),
};

export const MOODS: ReadonlyArray<{ id: MoodId; label: string; tilt: number }> = [
  { id: 'blissful', label: 'Blissful', tilt: -6 },
  { id: 'lazy', label: 'Lazy', tilt: 4 },
  { id: 'fancy', label: 'Fancy', tilt: -3 },
  { id: 'giggly', label: 'Giggly', tilt: 7 },
  { id: 'romantic', label: 'Romantic', tilt: -5 },
  { id: 'adventurous', label: 'Adventurous', tilt: 3 },
  { id: 'cosy', label: 'Cosy', tilt: -7 },
  { id: 'fizzy', label: 'Fizzy', tilt: 5 },
];

export function isMoodId(value: unknown): value is MoodId {
  return typeof value === 'string' && value in glyphs;
}

export type MoodStampProps = {
  mood: MoodId;
  size?: number;
  /** Accessible name; defaults to the mood label. Pass '' to hide from assistive tech. */
  title?: string;
  className?: string;
  /** Selected stamps get a honey disc (ginger for romantic) behind the glyph. */
  selected?: boolean;
  /** Set false to lay the stamp flat (e.g. in lists). */
  tilted?: boolean;
};

export function MoodStamp({
  mood,
  size = 72,
  title,
  className,
  selected = false,
  tilted = true,
}: MoodStampProps): ReactElement {
  const meta = MOODS.find((m) => m.id === mood) ?? MOODS[0];
  const arcId = `mood-arc-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const Glyph = glyphs[meta.id];
  const label = title ?? meta.label;
  const fill = selected
    ? meta.id === 'romantic'
      ? 'var(--color-ginger-soft, #FFE1DC)'
      : 'var(--color-honey-soft, #FFEAB0)'
    : 'var(--color-paper, #FFFFFF)';
  const long = meta.label.length > 8;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {label ? <title>{label}</title> : null}
      <defs>
        <path id={arcId} d="M14 38a22 22 0 0 0 44 0" />
      </defs>
      <g
        transform={tilted ? `rotate(${meta.tilt} 36 36)` : undefined}
        style={{ color: 'var(--color-ink, #292935)' }}
      >
        <circle cx="36" cy="36" r="33" style={{ fill }} stroke="currentColor" strokeWidth={2.5} />
        <circle
          cx="36"
          cy="36"
          r="28.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          strokeDasharray="1.6 2.4"
          strokeLinecap="round"
        />
        <g
          transform="translate(22 12) scale(1.17)"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Glyph />
        </g>
        <text
          fill="currentColor"
          style={{
            fontFamily: 'var(--font-sans, Manrope, system-ui, sans-serif)',
            fontWeight: 800,
            fontSize: long ? 6.6 : 7.6,
            letterSpacing: long ? '0.06em' : '0.12em',
            textTransform: 'uppercase',
          }}
        >
          <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
            {meta.label}
          </textPath>
        </text>
      </g>
    </svg>
  );
}

export default MoodStamp;
