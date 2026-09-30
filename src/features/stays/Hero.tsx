/**
 * Home hero (SPEC §3.3 row 2): full-bleed photo from our latest stay (or the illustrated scene),
 * a headline generated from our data, the Dayuse-style search "Find a stay we've had" with live
 * results, and "We're at a hotel right now".
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { consumeSearchFocus, FOCUS_SEARCH_EVENT } from '@/app/shortcuts';
import { href } from '@/app/router';
import { KeyTagMark } from '@/components/brand/KeyTagMark';
import { IconBed, IconCalendar, IconLocate, IconSearch } from '@/components/icons';
import { StayArt } from '@/components/StayArt';
import { COUPLE } from '@/config/couple';
import { usePhotoUrl } from '@/data/store';
import type { Stay } from '@/data/types';
import { formatDate, monthsTogether, today, zonedParts } from '@/lib/dates';
import { hotelCount, latestStay } from '@/lib/stats';
import { HeroArt, timeOfDayFor } from './HeroArt';
import { matchesQuery, pickHeadline } from './logic';
import { openStay } from './transition';
import s from './Hero.module.css';

const SINCE = formatDate(COUPLE.togetherSince.slice(0, 10));

function SearchResults({ results, query, active, listId, onPick }: { results: Stay[]; query: string; active: number; listId: string; onPick(st: Stay): void }) {
  return (
    <div className={s.results} role="region" aria-live="polite" aria-label="Search results">
      {results.length === 0 ? (
        <div className={s.noResults}>
          <strong>No stays match that</strong>
          <span>Try a different name, area, or a word from a note.</span>
        </div>
      ) : (
        <>
          <p className={s.resultsCount}>{results.length === 1 ? '1 stay found' : `${results.length} stays found`}</p>
          <ul id={listId} role="listbox" aria-label={`Stays matching ${query}`} className={s.resultList}>
            {results.slice(0, 8).map((st, i) => {
              const note = [st.visit.note, st.visit.favourite_moment].find((t) => t && t.toLowerCase().includes(query.toLowerCase()));
              return (
                <li key={st.visit.visit_id} role="option" aria-selected={i === active} id={`${listId}-${i}`}>
                  <button type="button" className={s.result} data-active={i === active || undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(st)}>
                    <span className={s.resultArt} aria-hidden="true">
                      <StayArt seed={st.hotel.hotel_id} />
                    </span>
                    <span className={s.resultText}>
                      <strong>{st.hotel.name}</strong>
                      <span>
                        {[st.hotel.area, st.hotel.city].filter(Boolean).join(', ')} · {formatDate(st.visit.date)}
                      </span>
                      {note ? <em>“{note}”</em> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export function HeroSearch({ stays }: { stays: Stay[] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId().replace(/:/g, '');
  const q = query.trim();
  const results = useMemo(() => (q ? stays.filter((st) => matchesQuery(st, q)).sort((a, b) => b.visit.date.localeCompare(a.visit.date)) : []), [stays, q]);

  useEffect(() => {
    const focus = () => {
      if (inputRef.current && consumeSearchFocus()) {
        inputRef.current.focus();
        inputRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };
    focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, focus);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focus);
  }, []);

  const pick = (st: Stay) => {
    setOpen(false);
    openStay(st.visit.visit_id);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('');
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.min(results.length, 8) - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
  };

  return (
    <div className={s.searchWrap}>
      <form
        className={s.search}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (results[active]) pick(results[active]);
        }}
      >
        <span className={s.searchDisc} aria-hidden="true">
          <IconSearch size={20} />
        </span>
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          placeholder="Find a stay we've had"
          aria-label="Find a stay we've had"
          aria-expanded={open && q !== ''}
          aria-controls={listId}
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          role="combobox"
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKey}
          data-search
        />
        <button type="submit" className={s.searchButton} disabled={!results.length}>
          Find
        </button>
      </form>
      {open && q ? <SearchResults results={results} query={q} active={active} listId={listId} onPick={pick} /> : null}
    </div>
  );
}

export function Hero({ stays }: { stays: Stay[] }) {
  const latest = latestStay(stays);
  const cover = latest?.photos[0]?.photo_id ?? null;
  const url = usePhotoUrl(cover, 'full');
  const now = new Date();
  const headline = pickHeadline(stays, { today: today(), monthsTogether: monthsTogether(now) });
  const time = timeOfDayFor(zonedParts(now).hh);
  const sub =
    latest && headline.kind !== 'byLatest' && headline.kind !== 'byLatestRevisit'
      ? `Latest: ${latest.hotel.name}, ${formatDate(latest.visit.date)}`
      : COUPLE.tagline;
  const hotels = hotelCount(stays);

  return (
    <section className={s.hero} aria-labelledby="hero-headline" data-time={time} data-hero>
      <div className={s.art} aria-hidden="true">
        {url ? (
          <>
            <img src={url} alt="" />
            <span className={s.scrim} />
          </>
        ) : (
          <HeroArt seed={latest?.hotel.hotel_id ?? 'suite-nothings'} time={time} />
        )}
      </div>
      <div className={s.inner}>
        <p className={s.brand}>
          <KeyTagMark size={28} variant="mono" />
          <span>{COUPLE.appName}</span>
        </p>
        <div className={s.top}>
          <HeroSearch stays={stays} />
          <a className={s.here} href={href('/add', { here: 1 })}>
            <IconLocate size={18} aria-hidden="true" />
            We're at a hotel right now
          </a>
          <ul className={s.trust} role="list">
            <li>
              <IconBed size={18} aria-hidden="true" />
              {hotels === 1 ? '1 hotel together' : `${hotels} hotels together`}
            </li>
            <li>
              <IconCalendar size={18} aria-hidden="true" />
              Since {SINCE}
            </li>
          </ul>
        </div>
        <div className={s.copy}>
          <h1 id="hero-headline" className={s.headline} data-kind={headline.kind}>
            {headline.text}
          </h1>
          <p className={s.sub}>{sub}</p>
        </div>
      </div>
    </section>
  );
}
