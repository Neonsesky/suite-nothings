import type { ReactNode } from 'react';
import { formatDate } from '@/lib/dates';
import type { Stay } from '@/data/types';
import { Badge, type BadgeTone } from './Badge';
import { IconHeart } from './icons';
import { StayArt } from './StayArt';
import { TimestampChip } from './TimestampChip';
import s from './StayCard.module.css';

export interface StayCardProps {
  stay: Stay;
  /** Photo URL (object URL of the thumb). Falls back to StayArt. */
  photoUrl?: string | null;
  /** Override the auto badge ("First", "Visit 3", "♡ 5"). null hides it. */
  badge?: { label: ReactNode; tone?: BadgeTone } | null;
  href?: string;
  onClick?: () => void;
  /** Shared-element name for the card → detail transition. */
  viewTransitionName?: string;
  /** Extra line under the area (e.g. "Waiting for Shady's rating"). */
  footnote?: ReactNode;
  className?: string;
}

/** Automatic badge per SPEC §3.3: First stay, "Visit N" for revisits, "♡ N" for a 5-heart pair. */
export function autoBadge(stay: Stay): { label: ReactNode; tone: BadgeTone } | null {
  if (stay.stayNumber === 1) return { label: 'First', tone: 'ginger' };
  if (stay.visitNumber > 1) return { label: `Visit ${stay.visitNumber}`, tone: 'honey' };
  const r = [stay.visit.rating_nirsh, stay.visit.rating_shady].filter((x): x is NonNullable<typeof x> => x != null);
  if (r.length) {
    const avg = r.reduce((a, b) => a + b, 0) / r.length;
    return {
      label: (
        <>
          <IconHeart size={12} /> {Number.isInteger(avg) ? avg : avg.toFixed(1)}
        </>
      ),
      tone: 'cream',
    };
  }
  return null;
}

/**
 * Dayuse card anatomy: photo, name, area; the date where the price sits; a badge where the
 * discount sits; the timestamp chip where the struck-through price sits.
 */
export function StayCard({ stay, photoUrl, badge, href, onClick, viewTransitionName, footnote, className }: StayCardProps) {
  const { visit, hotel } = stay;
  const b = badge === undefined ? autoBadge(stay) : badge;
  const nights = visit.nights > 0 ? `${visit.nights} ${visit.nights === 1 ? 'night' : 'nights'}` : undefined;
  const place = [hotel.area, hotel.city].filter(Boolean).join(', ');
  const body = (
    <>
      <div className={s.photo} style={viewTransitionName ? { viewTransitionName } : undefined}>
        {photoUrl ? <img src={photoUrl} alt="" loading="lazy" decoding="async" /> : <StayArt seed={hotel.hotel_id} />}
        {b ? (
          <Badge tone={b.tone} className={s.badge}>
            {b.label}
          </Badge>
        ) : null}
      </div>
      <div className={s.body}>
        <h3 className={s.name}>{hotel.name}</h3>
        <p className={s.area}>{place || hotel.country}</p>
        <div className={s.meta}>
          <span className={s.date}>{formatDate(visit.date)}</span>
          <TimestampChip checkIn={visit.check_in} checkOut={visit.check_out} fallback={nights} />
        </div>
        {footnote ? <p className={s.footnote}>{footnote}</p> : null}
      </div>
    </>
  );
  const cls = [s.card, className ?? ''].join(' ');
  const label = `${hotel.name}, ${formatDate(visit.date)}`;
  if (href) {
    return (
      <a className={cls} href={href} onClick={onClick} aria-label={label} data-visit-id={visit.visit_id}>
        {body}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-label={label} data-visit-id={visit.visit_id}>
        {body}
      </button>
    );
  }
  return (
    <article className={cls} aria-label={label} data-visit-id={visit.visit_id}>
      {body}
    </article>
  );
}
