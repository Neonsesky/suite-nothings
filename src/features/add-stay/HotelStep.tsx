/**
 * Step 1, Hotel: previous hotels first (one tap = revisit), Photon autocomplete with the server
 * geocoder as a fallback, "We're here now" via GPS, and a manual pin drop that always works.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/Button';
import { ClockLoader } from '@/components/ClockLoader';
import { Skeleton } from '@/components/Skeleton';
import { StayArt } from '@/components/StayArt';
import { IconClose, IconLocate, IconPin, IconSearch } from '@/components/icons';
import { getAdapter, useAllStays, useHotel, usePhotoUrl, useSettings } from '@/data/store';
import type { Hotel, Stay } from '@/data/types';
import { formatKm, haversineKm, type LatLng } from '@/lib/geo';
import { GeocodeError, nearbyHotels, searchPlaces, type PlaceResult } from '@/lib/geocode';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { MiniMap } from '@/map/MiniMap';
import { hotelFromPlace, type HotelChoice, type NewHotel } from './draft';
import { countryCodeFor } from './places';
import s from './AddStay.module.css';

export interface HotelStepProps {
  choice: HotelChoice | null;
  onPick(choice: HotelChoice): void;
  onClear(): void;
  /** Start the "We're here now" search on mount (`#/add?here=1`). */
  autoHere: boolean;
}

type SearchStatus = 'idle' | 'loading' | 'done' | 'error' | 'offline';
type HereStatus = 'idle' | 'locating' | 'searching' | 'done' | 'denied' | 'unavailable' | 'error';

const DEBOUNCE_MS = 280;

interface Row {
  id: string;
  title: string;
  sub: string;
  meta?: string;
  thumb?: { hotelId: string; photoId: string | null };
  pick(): void;
}

export function HotelStep({ choice, onPick, onClear, autoHere }: HotelStepProps) {
  const settings = useSettings();
  const home = settings.home_base;
  const stays = useAllStays();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [here, setHere] = useState<{ status: HereStatus; at: LatLng | null; results: PlaceResult[] }>({ status: 'idle', at: null, results: [] });
  const [manual, setManual] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const desktop = useIsDesktop();
  useEffect(() => {
    // Phones keep the keyboard down so the one-tap revisit list stays visible.
    if (desktop) inputRef.current?.focus({ preventScroll: true });
  }, [desktop]);

  const previous = useMemo(() => previousHotels(stays), [stays]);
  const byOsm = useMemo(() => new Map(previous.filter((p) => p.hotel.osm_id).map((p) => [p.hotel.osm_id!, p.hotel])), [previous]);
  const near: LatLng = here.at ?? { lat: home.lat, lng: home.lng };
  const fallback = { city: home.city, country: home.country, countryCode: home.countryCode };

  // Debounced search: Photon first (hotels, then looser), the server geocoder if Photon fails.
  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setStatus('offline');
        setResults([]);
        return;
      }
      setStatus('loading');
      try {
        const r = await searchPlaces(q, { near, signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        setResults(r);
        setStatus('done');
      } catch (e) {
        if (ctrl.signal.aborted || (e instanceof GeocodeError && e.code === 'aborted')) return;
        try {
          const r = await getAdapter().geocode(q, near);
          if (ctrl.signal.aborted) return;
          setResults(r);
          setStatus(r.length ? 'done' : navigator.onLine === false ? 'offline' : 'error');
        } catch {
          if (!ctrl.signal.aborted) {
            setResults([]);
            setStatus(navigator.onLine === false ? 'offline' : 'error');
          }
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // `near` is derived; re-search only when the query or the bias point changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, near.lat, near.lng]);

  const pickPlace = (p: PlaceResult) => {
    const known = p.osm_id ? byOsm.get(p.osm_id) : undefined;
    if (known) onPick({ kind: 'existing', hotel_id: known.hotel_id });
    else onPick({ kind: 'new', hotel: hotelFromPlace(p, fallback) });
  };

  const findHere = () => {
    if (!('geolocation' in navigator)) {
      setHere({ status: 'unavailable', at: null, results: [] });
      return;
    }
    setHere((h) => ({ ...h, status: 'locating' }));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setHere({ status: 'searching', at, results: [] });
        try {
          let r = await nearbyHotels(at.lat, at.lng, { radiusKm: 1.5 });
          if (r.length === 0) r = await nearbyHotels(at.lat, at.lng, { radiusKm: 5 });
          setHere({ status: 'done', at, results: r });
        } catch {
          const known = previous
            .map((p) => ({ p, km: haversineKm(at, p.hotel) }))
            .filter((x) => x.km < 2)
            .sort((a, b) => a.km - b.km);
          if (known.length) onPick({ kind: 'existing', hotel_id: known[0].p.hotel.hotel_id });
          else setHere({ status: 'error', at, results: [] });
        }
      },
      (err) => setHere({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable', at: null, results: [] }),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoHere && !autoStarted.current && !choice) {
      autoStarted.current = true;
      findHere();
    }
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (choice) return <PickedHotel choice={choice} onClear={onClear} />;

  if (manual) {
    return (
      <ManualHotel
        initialName={q}
        at={here.at ?? (results[0] ? { lat: results[0].lat, lng: results[0].lng } : { lat: home.lat, lng: home.lng })}
        defaults={fallback}
        onCancel={() => setManual(false)}
        onDone={(h) => onPick({ kind: 'new', hotel: h })}
      />
    );
  }

  const searching = q.length >= 2;
  const matchingPrevious = searching ? previous.filter((p) => matches(p.hotel, q)) : previous;
  const prevRows: Row[] = matchingPrevious.slice(0, searching ? 3 : 8).map((p) => ({
    id: `prev-${p.hotel.hotel_id}`,
    title: p.hotel.name,
    sub: [`Visit ${p.visits + 1}`, placeLine(p.hotel)].filter(Boolean).join(' · '),
    thumb: { hotelId: p.hotel.hotel_id, photoId: p.photoId },
    pick: () => onPick({ kind: 'existing', hotel_id: p.hotel.hotel_id }),
  }));
  const placeRows = (list: PlaceResult[], withDistance: boolean): Row[] =>
    list
      .filter((r) => !prevRows.some((p) => p.id === `prev-${r.osm_id ? byOsm.get(r.osm_id)?.hotel_id : ''}`))
      .map((r) => ({
        id: `place-${r.id}`,
        title: r.name,
        sub: r.address ?? [r.area, r.city, r.country].filter(Boolean).join(', '),
        meta: withDistance && r.distanceKm != null ? formatKm(r.distanceKm, settings.units) : undefined,
        pick: () => pickPlace(r),
      }));
  const hereRows = here.status === 'done' ? placeRows(here.results, true) : [];
  const resultRows = searching && status === 'done' ? placeRows(results, false) : [];
  const rows = searching ? [...prevRows, ...resultRows] : [...hereRows, ...prevRows];

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(rows.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === 'Enter' && active >= 0 && rows[active]) {
      e.preventDefault();
      rows[active].pick();
    } else if (e.key === 'Escape' && query) {
      e.stopPropagation();
      setQuery('');
    }
  };

  const renderRows = (list: Row[], offset: number) => (
    <ul className={s.list} role="listbox" id={offset === 0 ? listId : undefined} aria-label="Hotels">
      {list.map((r, i) => (
        <li key={r.id} role="presentation">
          <button
            type="button"
            role="option"
            id={`${listId}-${offset + i}`}
            aria-selected={active === offset + i}
            data-active={active === offset + i}
            className={s.option}
            onClick={r.pick}
          >
            <span className={s.optionThumb}>{r.thumb ? <HotelThumb {...r.thumb} /> : <span className={s.optionIcon}><IconPin size={20} /></span>}</span>
            <span className={s.optionText}>
              <span className={s.optionTitle}>{r.title}</span>
              {r.sub ? <span className={s.optionSub}>{r.sub}</span> : null}
            </span>
            {r.meta ? <span className={s.optionMeta}>{r.meta}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <p className={s.helper}>Search, or pick somewhere we've stayed before.</p>
      <div className={s.search}>
        <span className={s.searchIcon} aria-hidden="true">
          <IconSearch size={18} />
        </span>
        <input
          className={`${s.input} ${s.searchInput}`}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Search hotels or areas"
          aria-label="Search hotels or areas"
          role="combobox"
          aria-expanded={rows.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(-1);
            if (e.target.value.trim().length < 2) setStatus('idle');
          }}
          onKeyDown={onKeyDown}
          ref={inputRef}
        />
        {query ? (
          <button type="button" className={s.searchClear} aria-label="Clear search" onClick={() => setQuery('')}>
            <IconClose size={18} />
          </button>
        ) : null}
      </div>

      {!searching ? (
        <>
          <button type="button" className={s.option} onClick={findHere} disabled={here.status === 'locating' || here.status === 'searching'}>
            <span className={s.optionIcon}>
              <IconLocate size={20} />
            </span>
            <span className={s.optionText}>
              <span className={s.optionTitle}>We're here now</span>
            </span>
          </button>
          <HereState status={here.status} count={here.results.length} onManual={() => setManual(true)} />
          {hereRows.length ? renderRows(hereRows, 0) : null}
          {prevRows.length ? (
            <>
              <div className={s.sectionLabel}>Stayed here before</div>
              {renderRows(prevRows, hereRows.length)}
            </>
          ) : null}
        </>
      ) : (
        <>
          {prevRows.length ? (
            <>
              <div className={s.sectionLabel}>Stayed here before</div>
              {renderRows(prevRows, 0)}
            </>
          ) : null}
          <SearchState status={status} empty={resultRows.length === 0} query={q} />
          {resultRows.length ? (
            <>
              <div className={s.sectionLabel}>Hotels</div>
              {renderRows(resultRows, prevRows.length)}
            </>
          ) : null}
        </>
      )}

      <div className={s.state}>
        <Button variant="ghost" size="sm" icon={<IconPin size={18} />} onClick={() => setManual(true)}>
          Add it by hand
        </Button>
      </div>
    </div>
  );
}

function SearchState({ status, empty, query }: { status: SearchStatus; empty: boolean; query: string }) {
  if (status === 'loading')
    return (
      <div aria-live="polite" aria-busy="true">
        <span className="sr-only">Searching hotels</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className={s.skeletonRow}>
            <Skeleton width="2.75rem" height="2.75rem" radius="sm" />
            <div style={{ flex: 1 }}>
              <Skeleton width={`${70 - i * 12}%`} height="0.875rem" />
              <div style={{ height: 'var(--space-2)' }} />
              <Skeleton width="45%" height="0.75rem" />
            </div>
          </div>
        ))}
      </div>
    );
  if (status === 'offline') return <p className={s.state} role="status">Offline. Add it by hand.</p>;
  if (status === 'error') return <p className={s.state} role="status">Can't search hotels right now. Add it by hand, or try again in a moment.</p>;
  if (status === 'done' && empty) return <p className={s.state} role="status">No hotels called “{query}” yet. Try another name, or add it by hand.</p>;
  return null;
}

function HereState({ status, count, onManual }: { status: HereStatus; count: number; onManual(): void }) {
  if (status === 'locating' || status === 'searching')
    return (
      <div className={s.state} role="status">
        <ClockLoader size={24} label="Finding hotels near us" />
        <span>{status === 'locating' ? 'Finding where we are…' : 'Looking for hotels around us…'}</span>
      </div>
    );
  const msg =
    status === 'denied'
      ? "No location access. Allow it in your phone's settings, or add the hotel by hand."
      : status === 'unavailable'
        ? "Can't get your location right now. Try again, or add the hotel by hand."
        : status === 'error'
          ? "Can't search hotels right now."
          : status === 'done' && count === 0
            ? 'No hotels right around us. Drop a pin instead.'
            : null;
  if (!msg) return null;
  return (
    <div className={s.state} role="status">
      <span>{msg}</span>
      {status !== 'done' || count === 0 ? (
        <button type="button" className={s.linkBtn} onClick={onManual}>
          Add it by hand
        </button>
      ) : null}
    </div>
  );
}

function PickedHotel({ choice, onClear }: { choice: HotelChoice; onClear(): void }) {
  const existing = useHotel(choice.kind === 'existing' ? choice.hotel_id : null);
  const h = choice.kind === 'existing' ? existing : choice.hotel;
  return (
    <div>
      <p className={s.helper}>Search, or pick somewhere we've stayed before.</p>
      <div className={s.picked} data-testid="picked-hotel">
        <span className={s.optionThumb}>
          <StayArt seed={choice.kind === 'existing' ? choice.hotel_id : `${h?.lat},${h?.lng}`} motif="window" />
        </span>
        <span className={s.optionText}>
          <span className={s.optionTitle}>{h?.name ?? 'Our hotel'}</span>
          {h ? <span className={s.optionSub}>{placeLine(h)}</span> : null}
        </span>
        <Button variant="secondary" size="sm" onClick={onClear}>
          Change
        </Button>
      </div>
    </div>
  );
}

function ManualHotel({ initialName, at, defaults, onCancel, onDone }: { initialName: string; at: LatLng; defaults: { city: string; country: string; countryCode: string }; onCancel(): void; onDone(h: NewHotel): void }) {
  const [name, setName] = useState(initialName);
  const [area, setArea] = useState('');
  const [city, setCity] = useState(defaults.city);
  const [country, setCountry] = useState(defaults.country);
  const [pin, setPin] = useState<LatLng>(at);
  const [tried, setTried] = useState(false);
  const ok = name.trim().length > 0 && city.trim().length > 0 && country.trim().length > 0;
  const done = () => {
    setTried(true);
    if (!ok) return;
    const code = country.trim().toLowerCase() === defaults.country.toLowerCase() ? defaults.countryCode : countryCodeFor(country) ?? defaults.countryCode;
    onDone({
      name: name.trim(),
      brand: null,
      address: [area.trim(), city.trim(), country.trim()].filter(Boolean).join(', '),
      area: area.trim() || null,
      city: city.trim(),
      region: null,
      country: country.trim(),
      country_code: code,
      lat: pin.lat,
      lng: pin.lng,
      source: 'manual',
      osm_id: null,
      wikidata_id: null,
      website: null,
      phone: null,
      stars: null,
    });
  };
  return (
    <div className={s.manual} data-testid="manual-hotel">
      <p className={s.helper}>Move the map so the pin sits on the hotel.</p>
      <div className={s.pinMap} data-no-drag>
        <MiniMap lat={at.lat} lng={at.lng} zoom={15} interactive onMove={setPin} label={name || 'our hotel'} />
      </div>
      <div className={s.group}>
        <label className={s.label} htmlFor="manual-name">
          Hotel name
        </label>
        <input id="manual-name" className={s.input} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={tried && !name.trim()} autoComplete="off" />
      </div>
      <div className={s.group}>
        <label className={s.label} htmlFor="manual-area">
          Area
        </label>
        <input id="manual-area" className={s.input} value={area} onChange={(e) => setArea(e.target.value)} autoComplete="off" />
      </div>
      <div className={`${s.row} ${s.group}`}>
        <div>
          <label className={s.label} htmlFor="manual-city">
            City
          </label>
          <input id="manual-city" className={s.input} value={city} onChange={(e) => setCity(e.target.value)} aria-invalid={tried && !city.trim()} />
        </div>
        <div>
          <label className={s.label} htmlFor="manual-country">
            Country
          </label>
          <input id="manual-country" className={s.input} value={country} onChange={(e) => setCountry(e.target.value)} aria-invalid={tried && !country.trim()} />
        </div>
      </div>
      <p className={s.hint}>
        Pin at {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
      </p>
      {tried && !ok ? <p className={s.problem}>Add a hotel to continue.</p> : null}
      <div className={s.cardActions} style={{ marginTop: 'var(--space-4)' }}>
        <Button onClick={done}>Use this hotel</Button>
        <Button variant="ghost" onClick={onCancel}>
          Back to search
        </Button>
      </div>
    </div>
  );
}

function HotelThumb({ hotelId, photoId }: { hotelId: string; photoId: string | null }) {
  const url = usePhotoUrl(photoId, 'thumb');
  return url ? <img src={url} alt="" /> : <StayArt seed={hotelId} motif="window" />;
}

/** Hotels we've stayed at, most recent first, with visit counts and a photo for the thumb. */
function previousHotels(stays: readonly Stay[]): { hotel: Hotel; visits: number; last: string; photoId: string | null }[] {
  const by = new Map<string, { hotel: Hotel; visits: number; last: string; photoId: string | null }>();
  for (const st of stays) {
    if (st.visit.deleted || st.hotel.deleted) continue;
    const cur = by.get(st.hotel.hotel_id);
    const photoId = st.hotel.cover_photo_id ?? st.photos[0]?.photo_id ?? null;
    if (!cur) by.set(st.hotel.hotel_id, { hotel: st.hotel, visits: 1, last: st.visit.date, photoId });
    else {
      cur.visits += 1;
      if (st.visit.date >= cur.last) {
        cur.last = st.visit.date;
        cur.photoId = photoId ?? cur.photoId;
      }
    }
  }
  return [...by.values()].sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0));
}

function placeLine(h: Pick<Hotel, 'area' | 'city' | 'country'>): string {
  return [h.area, h.city].filter((x, i, a) => x && a.indexOf(x) === i).join(', ') || h.country;
}

function matches(h: Hotel, q: string): boolean {
  const needle = q.toLowerCase();
  return [h.name, h.area, h.city, h.brand].some((x) => x?.toLowerCase().includes(needle));
}
