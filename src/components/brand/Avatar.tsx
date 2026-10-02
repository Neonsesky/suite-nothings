/**
 * A face for each of us. Drops in `public/photos/{nirsh,shady}.jpg` when present (see SETUP.md);
 * until then, an ink-outline initial stands in, in the same hand as KeyTagMark.
 */
import { useState, type ReactElement } from 'react';
import { COUPLE, type PersonId } from '@/config/couple';

export type AvatarProps = {
  person: PersonId;
  size?: number;
  className?: string;
};

const RING = 'var(--color-ink, #292935)';
const PAPER = 'var(--color-paper, #FFFFFF)';
const HONEY = 'var(--color-honey, #FFC536)';

export function Avatar({ person, size = 40, className }: AvatarProps): ReactElement {
  const info = COUPLE.people[person];
  const [broken, setBroken] = useState(false);
  const initial = info.name.charAt(0).toUpperCase();

  if (!broken) {
    return (
      <img
        src={info.avatar}
        alt={info.name}
        width={size}
        height={size}
        className={className}
        style={{ borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${RING}` }}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={info.name}
      className={className}
      focusable="false"
    >
      <circle cx="20" cy="20" r="18.5" fill={HONEY} fillOpacity={0.5} stroke={RING} strokeWidth={1.5} />
      <text
        x="20"
        y="21"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-display, Manrope, sans-serif)"
        fontWeight={700}
        fontSize={17}
        fill={RING}
      >
        {initial}
      </text>
      <circle cx="20" cy="20" r="18.5" fill="none" stroke={PAPER} strokeOpacity={0.4} strokeWidth={0.75} />
    </svg>
  );
}

export default Avatar;
