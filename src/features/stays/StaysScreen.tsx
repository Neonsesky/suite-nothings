/**
 * Stays (home) v1 — Dayuse homepage anatomy (SPEC §3.3): hero, stats row, city tabs, card grid.
 * Owned by w1-stays, who replaces it with the full anatomy.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ButtonLink } from '@/components/Button';
import { ChipGroup } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { IconKey, IconLocate, IconMap, IconSearch } from '@/components/icons';
import { StayCardSkeleton } from '@/components/Skeleton';
import { SplitFlap } from '@/components/SplitFlap';
import { StayArt } from '@/components/StayArt';
import { StayCard } from '@/components/StayCard';
import { consumeSearchFocus, FOCUS_SEARCH_EVENT } from '@/app/shortcuts';
import { href } from '@/app/router';
import { personName } from '@/config/couple';
import { ABROAD, cityTab } from '@/data/stays';
import { useMe, usePhotoUrl, useSettings, useStays, useStoreReady } from '@/data/store';
import type { Stay } from '@/data/types';
import { formatMonth } from '@/lib/dates';
import { latestStay, summary } from '@/lib/stats';
import s from './StaysScreen.module.css';

function headline(stays: Stay[], meName: string): string {
  const latest = latestStay(stays);
  if (!latest) return 'Our first check-in is waiting';
  const n = new Set(stays.map((x) => x.hotel.hotel_id)).size;
  const greeting = meName ? `Hi ${meName}. ` : '';
  return `${greeting}${n} ${n === 1 ? 'room' : 'rooms'} we've made ours, most recently ${latest.hotel.name}.`;
}

function Hero({ stays }: { stays: Stay[] }) {
  const latest = latestStay(stays);
  const me = useMe();
  const cover = latest?.photos[0]?.photo_id ?? null;
  const url = usePhotoUrl(cover, 'full');
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focus = () => {
      if (inputRef.current && consumeSearchFocus()) inputRef.current.focus();
    };
    focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, focus);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focus);
  }, []);
  return (
    <section className={s.hero} aria-label="Our latest stay">
      <div className={s.heroArt} aria-hidden="true">
        {url ? <img src={url} alt="" /> : <StayArt seed={latest?.hotel.hotel_id ?? 'suite-nothings'} motif="window" />}
      </div>
      <div className={s.heroInner}>
        <h1 className={s.headline}>{headline(stays, personName(me))}</h1>
        {latest ? <p className={s.heroSub}>{formatMonth(latest.visit.date)} · {latest.hotel.city}</p> : null}
        <form
          className={s.search}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('sn:search', { detail: query }));
          }}
        >
          <IconSearch size={20} />
          <input
            ref={inputRef}
            type="search"
            placeholder="Find a stay we've had"
            aria-label="Find a stay we've had"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              window.dispatchEvent(new CustomEvent('sn:search', { detail: e.target.value }));
            }}
            data-search
          />
        </form>
        <ButtonLink href={href('/add', { here: 1 })} variant="secondary" icon={<IconLocate size={18} />} className={s.here}>
          We're at a hotel right now
        </ButtonLink>
      </div>
    </section>
  );
}

function StatsRow({ stays }: { stays: Stay[] }) {
  const home = useSettings().home_base;
  const sum = summary(stays, home);
  const items = [
    { value: sum.visits, label: sum.visits === 1 ? 'visit' : 'visits' },
    { value: sum.hours, label: 'hours together' },
    { value: sum.cities, label: sum.cities === 1 ? 'city' : 'cities' },
    { value: sum.countries, label: sum.countries === 1 ? 'country' : 'countries' },
  ];
  return (
    <section className={s.stats} aria-label="Our numbers">
      <div className={s.counter}>
        <SplitFlap value={sum.hotels} length={Math.max(2, String(sum.hotels).length)} charset=" 0123456789" size="lg" ariaLabel={`${sum.hotels} hotels together`} />
        <span className={s.counterLabel}>{sum.hotels === 1 ? 'hotel' : 'hotels'} together</span>
      </div>
      <ul className={s.statList} role="list">
        {items.map((i) => (
          <li key={i.label} className={s.stat}>
            <IconKey size={18} />
            <span>
              <strong>{i.value.toLocaleString('en-GB')}</strong> {i.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function StaysScreen() {
  const ready = useStoreReady();
  const all = useStays();
  const home = useSettings().home_base;
  const [city, setCity] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const onSearch = (e: Event) => setQuery(String((e as CustomEvent<string>).detail ?? ''));
    window.addEventListener('sn:search', onSearch);
    return () => window.removeEventListener('sn:search', onSearch);
  }, []);

  const tabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const st of all) {
      const t = cityTab(st.hotel, home);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => (a[0] === ABROAD ? 1 : b[0] === ABROAD ? -1 : b[1] - a[1]))
      .map(([value, count]) => ({ value, label: value, count }));
  }, [all, home]);

  const activeCity = city ?? tabs[0]?.value ?? null;
  const shown = useStays({ city: query ? null : activeCity, query: query || null });

  if (!ready) {
    return (
      <div className={`page ${s.screen}`} aria-busy="true">
        <div className={s.grid}>
          {Array.from({ length: 6 }, (_, i) => (
            <StayCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (all.length === 0) {
    return (
      <div className="page">
        <EmptyState
          art={<IconKey size={32} />}
          title="Our first check-in is waiting"
          body="Every hotel we visit lands here, with the date, the times and the good part."
          action={<ButtonLink href="#/add">Add our first stay</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className={s.screen}>
      <Hero stays={all} />
      <div className="page">
        <StatsRow stays={all} />
        <section className={s.section} aria-labelledby="our-stays">
          <h2 id="our-stays" className={s.sectionTitle}>
            {query ? `Stays matching “${query}”` : 'Our stays'}
          </h2>
          {query ? null : <ChipGroup label="City" scroll options={tabs} value={activeCity} onChange={(v) => setCity(v as string)} />}
          {shown.length === 0 ? (
            <EmptyState title="No stays match that" body="Try a hotel name, an area or a word from our notes." />
          ) : (
            <div className={s.grid}>
              {shown.map((st) => (
                <StayCard
                  key={st.visit.visit_id}
                  stay={st}
                  href={`#/stay/${st.visit.visit_id}`}
                  footnote={st.visit.rating_shady == null ? `Waiting for ${personName('shady')}'s rating` : st.visit.rating_nirsh == null ? `Waiting for ${personName('nirsh')}'s rating` : undefined}
                />
              ))}
            </div>
          )}
          {!query && activeCity && activeCity !== ABROAD ? (
            <a className={s.seeAll} href={href('/map', { city: activeCity })}>
              <IconMap size={18} /> See all our {activeCity} stays
            </a>
          ) : null}
        </section>
      </div>
    </div>
  );
}
