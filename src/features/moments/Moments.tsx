/** Home "moment" section (SPEC §3.3, §12): today's anniversary first, then on-this-day memories. */
import { useMemo } from 'react';
import { StayArt } from '@/components/StayArt';
import { IconHeart } from '@/components/icons';
import { usePhotoUrl } from '@/data/store';
import { parseJsonArray } from '@/data/stays';
import type { Stay } from '@/data/types';
import { openStay } from '@/features/stays/transition';
import { formatDate, today } from '@/lib/dates';
import { anniversary, onThisDay, type OnThisDay } from './logic';
import s from './Moments.module.css';

function MemoryCard({ m }: { m: OnThisDay }) {
  const cover = m.stay.hotel.cover_photo_id ?? parseJsonArray(m.stay.visit.photo_ids_json)[0] ?? null;
  const url = usePhotoUrl(cover, 'thumb');
  const id = m.stay.visit.visit_id;
  return (
    <li>
      <a
        className={s.card}
        href={`#/stay/${id}`}
        data-moment="on-this-day"
        onClick={(e) => {
          e.preventDefault();
          openStay(id);
        }}
      >
        <span className={s.art} aria-hidden="true">
          {url ? <img src={url} alt="" /> : <StayArt seed={m.stay.hotel.hotel_id} />}
        </span>
        <span className={s.text}>
          <span className={s.kicker}>{m.when}</span>
          <strong>We checked into {m.stay.hotel.name}.</strong>
          <span>{formatDate(m.stay.visit.date)}</span>
        </span>
      </a>
    </li>
  );
}

export function Moments({ stays, day = today(), now }: { stays: readonly Stay[]; day?: string; now?: Date }) {
  const memories = useMemo(() => onThisDay(stays, day), [stays, day]);
  const anniv = useMemo(() => anniversary(stays, day, now ?? new Date(), memories.length === 0), [stays, day, now, memories.length]);
  if (!memories.length && !anniv) return null;
  const heading = anniv?.isToday ? 'Happy 19th' : memories.length ? 'On this day' : anniv!.title;
  return (
    <section className={s.section} aria-labelledby="moment" data-section="moment">
      <h2 id="moment" className={s.h2}>
        {heading}
      </h2>
      <ul className={s.list} role="list">
        {anniv ? (
          <li>
            <div className={s.card} data-moment="anniversary" data-today={anniv.isToday || undefined}>
              <span className={`${s.art} ${s.heart}`} aria-hidden="true">
                <IconHeart size={32} />
              </span>
              <span className={s.text}>
                <span className={s.kicker}>{anniv.isToday ? 'Today' : formatDate(anniv.date)}</span>
                <strong>{anniv.body}</strong>
                <span>{anniv.isToday ? 'Same time, same us, more keys.' : 'Our last monthly anniversary'}</span>
              </span>
            </div>
          </li>
        ) : null}
        {memories.map((m) => (
          <MemoryCard key={`${m.monthsAgo}-${m.stay.visit.visit_id}`} m={m} />
        ))}
      </ul>
    </section>
  );
}
