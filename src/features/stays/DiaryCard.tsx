/**
 * Our version of the Dayuse hotel card (SPEC §3.3, design/plan.md §4): photo with a feature pill
 * and heart, name, stars and area, then the date where the price sits, an ink pill where the
 * discount sits and the timestamp chip where the struck price sits.
 */
import type { MouseEvent } from 'react';
import { IconHeart, IconStar } from '@/components/icons';
import { StayArt } from '@/components/StayArt';
import { otherPerson, personName, type PersonId } from '@/config/couple';
import { averageRating } from '@/data/stays';
import { usePhotoUrl } from '@/data/store';
import type { Stay } from '@/data/types';
import { formatDate, formatTimeRange } from '@/lib/dates';
import { stayHours } from '@/lib/stats';
import { openStay, photoTransitionName } from './transition';
import s from './DiaryCard.module.css';

export interface DiaryCardProps {
  stay: Stay;
  /** Visits to this hotel in total (3+ earns "Our regular"). */
  hotelVisits: number;
  me: PersonId | null;
  /** Arrived from the other phone just now: animate in. */
  arriving?: boolean;
  className?: string;
}

function lengthLabel(stay: Stay): string | null {
  const { nights } = stay.visit;
  if (nights > 0) return `${nights} ${nights === 1 ? 'night' : 'nights'}`;
  const h = stayHours(stay.visit);
  return h > 0 ? `${Math.round(h)} h` : null;
}

const fmtRating = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function DiaryCard({ stay, hotelVisits, me, arriving, className }: DiaryCardProps) {
  const { visit, hotel } = stay;
  const photoId = stay.photos[0]?.photo_id ?? null;
  const url = usePhotoUrl(photoId, 'thumb');
  const avg = averageRating(visit);
  const feature = hotelVisits >= 3 ? 'Our regular' : stay.stayNumber === 1 ? 'First' : null;
  const pill = stay.visitNumber > 1 ? `Visit ${stay.visitNumber}` : avg != null ? `♡ ${fmtRating(avg)}` : null;
  const partner = me ? otherPerson(me) : null;
  const partnerRating = partner === 'nirsh' ? visit.rating_nirsh : partner === 'shady' ? visit.rating_shady : null;
  const waiting = partner && partnerRating == null && (visit.rating_nirsh != null || visit.rating_shady != null);
  const place = [hotel.area, hotel.city].filter(Boolean).join(', ') || hotel.country;
  const times = formatTimeRange(visit.check_in, visit.check_out);
  const length = lengthLabel(stay);
  const favourite = avg != null && avg >= 4.5;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    openStay(visit.visit_id);
  };

  return (
    <a
      className={[s.card, arriving ? s.arriving : '', className ?? ''].join(' ')}
      href={`#/stay/${visit.visit_id}`}
      onClick={onClick}
      data-visit-id={visit.visit_id}
      aria-label={`${hotel.name}, ${formatDate(visit.date)}`}
    >
      <div className={s.photo} style={{ viewTransitionName: photoTransitionName(visit.visit_id) }}>
        {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : <StayArt seed={hotel.hotel_id} />}
        {feature ? <span className={s.feature}>{feature}</span> : null}
        {favourite ? (
          <span className={s.heart} aria-hidden="true">
            <IconHeart size={18} />
          </span>
        ) : null}
      </div>
      <div className={s.body}>
        <h3 className={s.name}>{hotel.name}</h3>
        <p className={s.area}>
          {hotel.stars ? (
            <span className={s.stars} aria-label={`${hotel.stars} stars`}>
              {Array.from({ length: hotel.stars }, (_, i) => (
                <IconStar key={i} size={12} aria-hidden="true" />
              ))}
            </span>
          ) : null}
          <span>{place}</span>
        </p>
        {waiting ? <p className={s.waiting}>Waiting for {personName(partner)}'s rating</p> : null}
        <div className={s.price}>
          <span className={s.date}>{formatDate(visit.date)}</span>
          <span className={s.deal}>
            {pill ? <span className={s.pill}>{pill}</span> : null}
            {length ? <span className={s.length}>{length}</span> : null}
          </span>
        </div>
        {times ? <span className={s.slot}>{times}</span> : null}
      </div>
    </a>
  );
}
