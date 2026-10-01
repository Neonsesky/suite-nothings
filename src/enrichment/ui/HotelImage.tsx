/** A Wikimedia Commons picture of the hotel with its licence and author shown under it. */
import { useState } from 'react';
import { commonsPageFor } from '../wikidata';
import s from './enrichment.module.css';

export function HotelImage({ url, credit, name }: { url: string; credit: string | null | undefined; name: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  const page = commonsPageFor(url);
  return (
    <figure className={s.figure}>
      <img src={url} alt={`${name}, from Wikimedia Commons`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      <figcaption>
        {page ? (
          <a href={page} target="_blank" rel="noopener noreferrer">
            {credit ?? 'Wikimedia Commons'}
          </a>
        ) : (
          (credit ?? 'Wikimedia Commons')
        )}
      </figcaption>
    </figure>
  );
}
