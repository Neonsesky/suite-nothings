/** Map (SPEC §9): one continuous 3D globe, City → Country → World chapters, pins, list view. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate, useQueryParam } from '@/app/router';
import { BottomSheet } from '@/components/BottomSheet';
import { Button, ButtonLink } from '@/components/Button';
import { ClockLoader } from '@/components/ClockLoader';
import { SplitFlap } from '@/components/SplitFlap';
import { IconClose, IconCompass, IconLayers, IconList, IconMap } from '@/components/icons';
import { updateSettings, useSettings, useStays, useStoreReady, useSyncState, useWishes } from '@/data/store';
import { ABROAD, cityTab } from '@/data/stays';
import type { MapLighting, Stay } from '@/data/types';
import { haptic } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/motion';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { chapterTitle, type Chapter } from '@/map/chapters';
import type { SuiteMap } from '@/map/engine';
import { MapList } from './MapList';
import { PinCard } from './PinCard';
import s from './MapScreen.module.css';

const CHIPS: { value: Chapter; label: string }[] = [
  { value: 'city', label: 'City' },
  { value: 'country', label: 'Country' },
  { value: 'world', label: 'World' },
];
const LIGHTING: { value: MapLighting; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'day', label: 'Day' },
  { value: 'golden', label: 'Golden hour' },
  { value: 'night', label: 'Night' },
];

type Status = 'loading' | 'ready' | 'nowebgl';

declare global {
  interface Window {
    __sn?: Record<string, unknown>;
  }
}

function e2eEnabled(): boolean {
  try {
    return localStorage.getItem('sn:e2e') === '1';
  } catch {
    return false;
  }
}

export default function MapScreen() {
  const ready = useStoreReady();
  const settings = useSettings();
  const home = settings.home_base;
  const allStays = useStays({ order: 'oldest' });
  const wishes = useWishes();
  const cityParam = useQueryParam('city');
  const focus = useQueryParam('focus');
  const reduced = useReducedMotion();
  const isDesktop = useIsDesktop();
  const { online } = useSyncState();

  const stays = useMemo(() => {
    if (!cityParam) return allStays;
    return allStays.filter((st) => st.hotel.city === cityParam || (cityParam === ABROAD && cityTab(st.hotel, home) === ABROAD));
  }, [allStays, cityParam, home]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<SuiteMap | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [chapter, setChapterState] = useState<Chapter>('city');
  const [inView, setInView] = useState(0);
  const [bearing, setBearing] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [night, setNight] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [arcs, setArcs] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<string | null>(null);

  const homeKey = `${home.lat},${home.lng},${home.countryCode},${home.city}`;

  // Create the engine once per home base (breakpoints depend on it).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let created: SuiteMap | null = null;
    const offs: (() => void)[] = [];
    void (async () => {
      const mod = await import('@/map/engine');
      if (cancelled) return;
      if (!mod.supportsWebGL()) {
        setStatus('nowebgl');
        setListOpen(true);
        return;
      }
      try {
        created = await mod.createSuiteMap(el, { home, lighting: settings.map_lighting, reducedMotion: reduced, data: { stays, wishes, home } });
      } catch {
        if (!cancelled) {
          setStatus('nowebgl');
          setListOpen(true);
        }
        return;
      }
      if (cancelled) {
        created.destroy();
        return;
      }
      const m = created;
      setChapterState(m.chapter());
      setFallback(m.isFallback());
      setNight(m.look().phase === 'night');
      offs.push(
        m.onChapterChange((c) => {
          setChapterState(c);
          haptic('chapter');
        }),
        m.onView((v) => {
          setInView(v.inView);
          setBearing(v.bearing);
        }),
        m.onFallbackChange(setFallback),
        m.onLookChange((l) => setNight(l.phase === 'night')),
        m.onPinClick((p) => {
          setSelectedHotel(p.hotelId || null);
        }),
      );
      m.map.once('load', () => {
        if (!cancelled) setStatus('ready');
        m.setIdleSpin(true);
        // Warm the home city's tiles in the background once the first view has settled.
        m.map.once('idle', () => {
          const src = m.map.getStyle()?.sources?.openmaptiles as { url?: string } | undefined;
          if (src?.url) void import('@/map/prewarm').then((p) => p.prewarmHomeTiles(home, src.url!));
        });
      });
      if (e2eEnabled()) window.__sn = { ...(window.__sn ?? {}), map: m };
      setEngine(m);
    })();
    return () => {
      cancelled = true;
      for (const off of offs) off();
      created?.destroy();
      if (window.__sn?.map) delete window.__sn.map;
      setEngine(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recreated only when the home base changes
  }, [homeKey]);

  useEffect(() => {
    engine?.setLighting(settings.map_lighting);
  }, [engine, settings.map_lighting]);

  useEffect(() => {
    if (!engine) return;
    void engine.setData({ stays, wishes, home });
  }, [engine, stays, wishes, home]);

  useEffect(() => {
    engine?.setArcsVisible(arcs);
  }, [engine, arcs]);

  useEffect(() => {
    engine?.select(selectedHotel);
  }, [engine, selectedHotel]);

  // ?city= frames that city's stays; ?focus= flies to a stay and opens its card.
  const framedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!engine || status !== 'ready' || !ready) return;
    const key = `${cityParam ?? ''}|${focus ?? ''}`;
    if (framedFor.current === key) return;
    framedFor.current = key;
    if (focus) {
      const st = allStays.find((x) => x.visit.visit_id === focus);
      if (st) {
        const id = st.hotel.hotel_id;
        engine.flyToHotel(id);
        // Open the card once we've landed (or straight away when no flight was needed).
        if (engine.map.isMoving()) engine.map.once('moveend', () => setSelectedHotel(id));
        else queueMicrotask(() => setSelectedHotel(id));
      }
      return;
    }
    if (cityParam && stays.length) {
      const lngs = stays.map((x) => x.hotel.lng);
      const lats = stays.map((x) => x.hotel.lat);
      engine.map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: { top: 180, bottom: 140, left: 48, right: 48 }, maxZoom: engine.breakpoints.city + 3, pitch: 45, duration: reduced ? 0 : 1800 },
      );
    }
  }, [engine, status, ready, cityParam, focus, allStays, stays, reduced]);

  const goChapter = useCallback(
    (c: Chapter) => {
      setSelectedHotel(null);
      engine?.setChapter(c);
    },
    [engine],
  );

  const showOnMap = useCallback(
    (st: Stay) => {
      setListOpen(false);
      setSelectedHotel(st.hotel.hotel_id);
      engine?.flyToHotel(st.hotel.hotel_id);
    },
    [engine],
  );

  const title = chapterTitle(chapter, home);
  const countLabel = `${inView} ${inView === 1 ? 'stay' : 'stays'} in view`;
  const selectedStays = useMemo(
    () => (selectedHotel ? stays.filter((x) => x.hotel.hotel_id === selectedHotel).sort((a, b) => b.stayNumber - a.stayNumber) : []),
    [selectedHotel, stays],
  );
  const cardStay = selectedStays[0] ?? null;
  const empty = ready && allStays.length === 0;

  return (
    <div className={s.screen} data-tone={night ? 'dark' : 'light'} data-list={listOpen || undefined} data-chapter={chapter} data-fallback={fallback || undefined} data-status={status}>
      <h1 className="sr-only">Our map</h1>
      <div ref={containerRef} className={s.map} data-testid="map-canvas" />

      {status === 'loading' ? (
        <div className={s.loading}>
          <ClockLoader label="Loading the map…" />
          <p aria-hidden="true">Loading the map…</p>
        </div>
      ) : null}

      <div className={s.hud}>
        <div className={s.plate} data-tone={night ? 'dark' : 'light'}>
          <span data-testid="map-title" data-chapter={chapter}>
            <SplitFlap value={title} ariaLabel={title} size="sm" className={s.title} live />
          </span>
          <span className={s.count} aria-live="polite" data-testid="map-count">
            {status === 'nowebgl' ? `${stays.length} ${stays.length === 1 ? 'stay' : 'stays'}` : countLabel}
          </span>
        </div>
        <div className={s.chips} role="toolbar" aria-label="Map chapters">
          {CHIPS.map((c) => (
            <button
              key={c.value}
              type="button"
              className={s.chip}
              aria-pressed={chapter === c.value}
              onClick={() => goChapter(c.value)}
              disabled={!engine}
            >
              {c.label}
            </button>
          ))}
          <button type="button" className={s.chip} aria-pressed={listOpen} onClick={() => setListOpen((v) => !v)}>
            {listOpen ? <IconMap size={16} /> : <IconList size={16} />}
            <span>{listOpen ? 'Map' : 'List view'}</span>
          </button>
          {cityParam ? (
            <button type="button" className={s.chip} data-filter onClick={() => navigate('/map', { replace: true })} aria-label="Show all our stays">
              <span>{cityParam}</span>
              <IconClose size={14} />
            </button>
          ) : null}
        </div>
        {fallback || (engine && !online) ? <p className={s.notice}>Offline. Showing what we&apos;ve already loaded.</p> : null}
        {empty ? (
          <div className={s.emptyCard}>
            <strong>No pins yet</strong>
            <span>Add a stay and it&apos;ll show up here.</span>
            <ButtonLink href="#/add" size="sm">
              Add a stay
            </ButtonLink>
          </div>
        ) : null}
      </div>

      {status !== 'nowebgl' ? (
        <div className={s.controls}>
          <div className={s.layersWrap}>
            <button
              type="button"
              className={s.ctrl}
              aria-label="Lighting"
              aria-expanded={layersOpen}
              aria-controls="map-layers"
              onClick={() => setLayersOpen((v) => !v)}
            >
              <IconLayers size={22} />
            </button>
            {layersOpen ? (
              <div className={s.layers} id="map-layers" role="group" aria-label="Lighting">
                <p className={s.layersLabel}>Lighting</p>
                <div className={s.layerOptions}>
                  {LIGHTING.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      className={s.option}
                      aria-pressed={settings.map_lighting === l.value}
                      onClick={() => void updateSettings({ map_lighting: l.value })}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <label className={s.toggle}>
                  <input type="checkbox" checked={arcs} onChange={(e) => setArcs(e.target.checked)} />
                  <span>Our route, stay by stay</span>
                </label>
              </div>
            ) : null}
          </div>
          <button type="button" className={s.ctrl} aria-label="Reset north" onClick={() => engine?.resetNorth()}>
            <span className={s.needle} style={{ transform: `rotate(${-bearing}deg)` }}>
              <IconCompass size={22} />
            </span>
          </button>
        </div>
      ) : null}

      <p className={s.attribution}>
        Map data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap contributors
        </a>
        , tiles via{' '}
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>
        {fallback ? ', land from Natural Earth' : ''}
      </p>

      {status === 'nowebgl' ? (
        <p className={s.webglNote} role="status">
          This browser can&apos;t render our 3D map. Try list view instead.
        </p>
      ) : null}

      <MapList open={listOpen} stays={stays} home={home} onClose={() => setListOpen(false)} onShowOnMap={status === 'ready' ? showOnMap : undefined} />

      {isDesktop ? (
        cardStay ? (
          <aside className={s.floatCard} aria-label={cardStay.hotel.name}>
            <PinCard stay={cardStay} visits={selectedStays.length} onClose={() => setSelectedHotel(null)} />
          </aside>
        ) : null
      ) : (
        <BottomSheet open={Boolean(cardStay)} onClose={() => setSelectedHotel(null)} title={cardStay?.hotel.name ?? 'Stay'} hideTitle snapPoints={[0.62]}>
          {cardStay ? <PinCard stay={cardStay} visits={selectedStays.length} /> : <span />}
        </BottomSheet>
      )}
      {status === 'nowebgl' && !listOpen ? (
        <div className={s.loading}>
          <Button onClick={() => setListOpen(true)} icon={<IconList size={18} />}>
            List view
          </Button>
        </div>
      ) : null}
    </div>
  );
}
