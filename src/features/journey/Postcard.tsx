/** The postcard that pops up at each stop (SPEC §10). Tapping it pauses and opens the stay. */
import { StayArt } from '@/components/StayArt';
import { usePhotoUrl } from '@/data/store';
import type { Stay } from '@/data/types';
import { formatDate } from '@/lib/dates';
import { postcardLine } from './data';
import s from './Journey.module.css';

export function postcardPhotoId(stay: Stay): string | null {
  const live = stay.photos.filter((p) => !p.deleted);
  return live[0]?.photo_id ?? stay.hotel.cover_photo_id ?? null;
}

export function Postcard({ stay, index, count, onOpen }: { stay: Stay; index: number; count: number; onOpen(stay: Stay): void }) {
  const url = usePhotoUrl(postcardPhotoId(stay), 'thumb');
  const line = postcardLine(stay);
  const stayOf = `Stay ${index + 1} of ${count}`;
  return (
    <button
      type="button"
      className={s.postcard}
      onClick={() => onOpen(stay)}
      data-testid="journey-postcard"
      data-visit-id={stay.visit.visit_id}
      aria-label={`${stay.hotel.name}, ${formatDate(stay.visit.date)}, ${stayOf}. Open this stay`}
    >
      <span className={s.postcardArt} aria-hidden="true">
        {url ? <img src={url} alt="" /> : <StayArt seed={stay.hotel.hotel_id} />}
      </span>
      <span className={s.postcardBody}>
        <strong className={s.postcardName}>{stay.hotel.name}</strong>
        <span className={s.postcardMeta}>
          {formatDate(stay.visit.date)} · {stayOf}
        </span>
        {line ? <span className={s.postcardLine}>“{line}”</span> : null}
      </span>
      <span className={s.postcardStamp} aria-hidden="true">
        {stay.hotel.city}
      </span>
    </button>
  );
}
