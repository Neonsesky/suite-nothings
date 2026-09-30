/** List view: the accessible alternative to the map, grouped by chapter and then by city. */
import { useEffect, useMemo, useRef } from 'react';
import { IconClose, IconPin } from '@/components/icons';
import type { HomeBase, Stay } from '@/data/types';
import { StayCardWithPhoto } from './PinCard';
import s from './MapScreen.module.css';

interface Group {
  key: string;
  title: string;
  cities: { city: string; stays: Stay[] }[];
}

/** Pure: City (home city), Country (rest of the home country), World (abroad); newest first. */
export function groupForList(stays: readonly Stay[], home: HomeBase): Group[] {
  const chapterOf = (st: Stay) =>
    st.hotel.country_code !== home.countryCode ? 'world' : st.hotel.city === home.city ? 'city' : 'country';
  const titles = { city: home.city, country: home.country, world: 'The world' } as const;
  return (['city', 'country', 'world'] as const)
    .map((key) => {
      const inChapter = stays.filter((st) => chapterOf(st) === key).sort((a, b) => b.stayNumber - a.stayNumber);
      const byCity = new Map<string, Stay[]>();
      for (const st of inChapter) byCity.set(st.hotel.city, [...(byCity.get(st.hotel.city) ?? []), st]);
      return { key, title: titles[key], cities: [...byCity].map(([city, list]) => ({ city, stays: list })) };
    })
    .filter((g) => g.cities.length > 0);
}

export function MapList({
  open,
  stays,
  home,
  onClose,
  onShowOnMap,
}: {
  open: boolean;
  stays: readonly Stay[];
  home: HomeBase;
  onClose(): void;
  onShowOnMap?: (st: Stay) => void;
}) {
  const groups = useMemo(() => groupForList(stays, home), [stays, home]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <section className={s.list} aria-labelledby="map-list-heading" data-testid="map-list">
      <div className={s.listHead}>
        <h2 id="map-list-heading" ref={headingRef} tabIndex={-1}>
          Our stays, listed
        </h2>
        <button type="button" className={s.ctrl} onClick={onClose} aria-label="Close list">
          <IconClose size={20} />
        </button>
      </div>
      {groups.length === 0 ? (
        <div className={s.listEmpty}>
          <strong>No pins yet</strong>
          <span>Add a stay and it&apos;ll show up here.</span>
        </div>
      ) : null}
      {groups.map((g) => (
        <div key={g.key} className={s.listGroup}>
          <h3>{g.title}</h3>
          {g.cities.map(({ city, stays: list }) => (
            <div key={city} className={s.listCity}>
              {g.key !== 'city' ? <h4>{city}</h4> : null}
              <ul>
                {list.map((st) => (
                  <li key={st.visit.visit_id}>
                    <StayCardWithPhoto stay={st} />
                    {onShowOnMap ? (
                      <button type="button" className={s.showOnMap} onClick={() => onShowOnMap(st)} aria-label={`Show ${st.hotel.name} on the map`}>
                        <IconPin size={16} />
                        <span>Show on the map</span>
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
