/**
 * "On this day" / monthly-anniversary slot (SPEC §3.3, §12). A later wave owns
 * src/features/moments/ and can swap this for the full version; this one is data-driven.
 */
import { StayArt } from '@/components/StayArt';
import { IconHeart } from '@/components/icons';
import type { Stay } from '@/data/types';
import { formatDate, today } from '@/lib/dates';
import { pickMoment } from './logic';
import { openStay } from './transition';
import s from './Sections.module.css';

export function MomentsSlot({ stays }: { stays: Stay[] }) {
  const m = pickMoment(stays, today());
  if (!m) return null;
  const heading = m.kind === 'onThisDay' ? 'On this day' : m.title;
  const body = (
    <>
      <span className={s.momentArt} aria-hidden="true">
        {m.kind === 'onThisDay' ? <StayArt seed={m.stay.hotel.hotel_id} /> : <IconHeart size={32} />}
      </span>
      <span className={s.momentText}>
        <strong>{m.body}</strong>
        <span>{m.kind === 'onThisDay' ? formatDate(m.stay.visit.date) : formatDate(m.date)}</span>
      </span>
    </>
  );
  return (
    <section className={s.section} aria-labelledby="moment" data-section="moment">
      <h2 id="moment" className={s.h2}>
        {heading}
      </h2>
      {m.kind === 'onThisDay' ? (
        <a
          className={s.moment}
          href={`#/stay/${m.stay.visit.visit_id}`}
          onClick={(e) => {
            e.preventDefault();
            openStay(m.stay.visit.visit_id);
          }}
        >
          {body}
        </a>
      ) : (
        <div className={s.moment} data-today={m.isToday || undefined}>
          {body}
        </div>
      )}
    </section>
  );
}
