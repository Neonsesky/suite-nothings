/**
 * Journey mode, the "Indiana Jones" replay (SPEC §10). The screen owns the map, the HUD and the
 * controls; `JourneyPlayer` owns the timeline. React re-renders only when a stop or phase
 * changes; the scrubber and veil are written through refs every frame.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { goBack } from '@/app/router';
import { Button, ButtonLink } from '@/components/Button';
import { ClockLoader } from '@/components/ClockLoader';
import { EmptyState } from '@/components/EmptyState';
import { SplitFlap } from '@/components/SplitFlap';
import { IconClose, IconJourney, IconMute, IconPause, IconPlay, IconShare, IconSound, IconUndo } from '@/components/icons';
import { COUPLE } from '@/config/couple';
import { useSettings, useStays, useStoreReady, useWishes } from '@/data/store';
import type { Stay } from '@/data/types';
import type { SuiteMap } from '@/map/engine';
import { formatDate, today } from '@/lib/dates';
import { useReducedMotion } from '@/lib/motion';
import { isMuted, setMuted } from '@/lib/sound';
import { openStay } from '@/features/stays/transition';
import { FILTERS, boardDate, finaleStats, journeyStays, monthTicks, type JourneyFilter } from './data';
import { Finale } from './Finale';
import { Postcard } from './Postcard';
import { JourneyPlayer, type Phase } from './player';
import { Soundtrack } from './music';
import { ShareJourney } from './ShareJourney';
import s from './Journey.module.css';

type Status = 'loading' | 'ready' | 'nowebgl';
const SPEEDS = [0.5, 1, 2] as const;
const OPENING_ISO = COUPLE.togetherSince.slice(0, 10);

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

export default function JourneyScreen() {
  const ready = useStoreReady();
  const settings = useSettings();
  const home = settings.home_base;
  const all = useStays({ order: 'oldest' });
  const wishes = useWishes();
  const reduced = useReducedMotion();
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const stays = useMemo(() => journeyStays(all, filter, home, today()), [all, filter, home]);
  const stopsKey = stays.map((x) => `${x.visit.visit_id}:${x.hotel.lat},${x.hotel.lng}`).join('|');

  const stageRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<JourneyPlayer | null>(null);
  const musicRef = useRef<Soundtrack | null>(null);
  const wasPlaying = useRef(false);

  const [engine, setEngine] = useState<SuiteMap | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [fallback, setFallback] = useState(false);
  const [player, setPlayer] = useState<JourneyPlayer | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [stop, setStop] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [muted, setMutedState] = useState(isMuted);
  const [shareOpen, setShareOpen] = useState(false);
  const [recording, setRecording] = useState(false);

  const homeKey = `${home.lat},${home.lng},${home.countryCode},${home.city}`;
  const hasStays = stays.length > 0;

  // Map: created once per home base, non-interactive (the replay is the camera).
  useEffect(() => {
    const el = mapRef.current;
    if (!el || !hasStays) return;
    let cancelled = false;
    let created: SuiteMap | null = null;
    let offFallback: (() => void) | null = null;
    void (async () => {
      const mod = await import('@/map/engine');
      if (cancelled) return;
      if (!mod.supportsWebGL()) return setStatus('nowebgl');
      try {
        created = await mod.createSuiteMap(el, {
          home,
          lighting: settings.map_lighting,
          reducedMotion: reduced,
          interactive: false,
          overlays: false,
          settle: false,
          camera: { center: [home.lng, home.lat], zoom: 1.6, pitch: 0, bearing: 0 },
        });
      } catch {
        if (!cancelled) setStatus('nowebgl');
        return;
      }
      if (cancelled) return created.destroy();
      const m = created;
      m.setIdleSpin(false);
      m.map.getCanvas().setAttribute('aria-hidden', 'true');
      m.map.getCanvas().tabIndex = -1;
      setFallback(m.isFallback());
      offFallback = m.onFallbackChange(setFallback);
      const onLoad = () => !cancelled && setStatus('ready');
      if (m.map.loaded()) onLoad();
      else m.map.once('load', onLoad);
      setEngine(m);
    })();
    return () => {
      cancelled = true;
      offFallback?.();
      created?.destroy();
      setEngine(null);
      setStatus('loading');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recreated only when the home base changes or stays first appear
  }, [homeKey, hasStays]);

  useEffect(() => {
    engine?.setLighting(settings.map_lighting);
  }, [engine, settings.map_lighting]);

  // Player: rebuilt when the stops, motion preference or recording stage change.
  useEffect(() => {
    if (!engine || status !== 'ready' || !stays.length) return;
    const stage = stageRef.current;
    engine.map.resize();
    const p = new JourneyPlayer({
      engine,
      stops: stays.map((x) => ({ lat: x.hotel.lat, lng: x.hotel.lng, hotelId: x.hotel.hotel_id })),
      home,
      wishes: wishes.filter((w) => w.lat != null && w.lng != null && !w.fulfilled_visit_id).map((w) => ({ lat: w.lat!, lng: w.lng! })),
      reduced,
      viewport: { width: stage?.clientWidth || 390, height: stage?.clientHeight || 844 },
      veil: veilRef.current,
      baseScale: e2eEnabled() ? 20 : 1,
      classes: { pin: s.pin, pinDrop: s.pinDrop, wish: s.wish, traveller: s.traveller },
      events: {
        onStop: (i) => setStop(i),
        onPhase: (ph) => setPhase(ph),
        onPlayState: (pl) => {
          setPlaying(pl);
          if (pl) void musicRef.current?.play();
          else musicRef.current?.pause();
        },
        onTick: (time, total) => {
          const f = total ? time / total : 0;
          if (scrubRef.current && document.activeElement !== scrubRef.current) scrubRef.current.value = String(Math.round(f * 1000));
          if (fillRef.current) fillRef.current.style.transform = `scaleX(${f})`;
        },
      },
    });
    playerRef.current = p;
    setPlayer(p);
    p.setSpeed(speed);
    if (wasPlaying.current) p.play();
    if (e2eEnabled()) window.__sn = { ...(window.__sn ?? {}), journey: p, journeyMap: engine };
    return () => {
      wasPlaying.current = p.playing;
      p.destroy();
      playerRef.current = null;
      setPlayer(null);
      setStop(-1);
      setPhase('ready');
      if (window.__sn?.journey === p) delete window.__sn.journey;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `speed` is applied separately; stops are keyed by stopsKey
  }, [engine, status, stopsKey, reduced, recording]);

  useEffect(() => {
    player?.setSpeed(speed);
  }, [player, speed]);

  useEffect(() => {
    const m = new Soundtrack();
    musicRef.current = m;
    return () => m.destroy();
  }, []);

  const start = useCallback(() => {
    setStarted(true);
    playerRef.current?.play();
  }, []);

  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    setStarted(true);
    p.toggle();
  }, []);

  const openFromPostcard = useCallback((st: Stay) => {
    playerRef.current?.pause();
    openStay(st.visit.visit_id);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !isMuted();
    setMuted(next);
    setMutedState(next);
    musicRef.current?.sync(playerRef.current?.playing ?? false);
  }, []);

  // Keyboard: space plays/pauses, arrows step stops, 1/2/3 pick the speed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
      const p = playerRef.current;
      if (!p) return;
      if (e.key === ' ' && tag !== 'BUTTON') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setStarted(true);
        p.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStarted(true);
        p.prev();
      } else if (e.key === '1' || e.key === '2' || e.key === '3') {
        setSpeed(SPEEDS[Number(e.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // Scrubbing: pause while dragging, resume after.
  const scrubResume = useRef(false);
  const onScrubStart = () => {
    const p = playerRef.current;
    if (!p) return;
    scrubResume.current = p.playing;
    if (p.playing) p.pause();
  };
  const onScrub = (v: number) => {
    const p = playerRef.current;
    if (!p) return;
    setStarted(true);
    p.seek((v / 1000) * p.total);
  };
  const onScrubEnd = () => {
    if (scrubResume.current) playerRef.current?.play();
    scrubResume.current = false;
  };

  const current = stop >= 0 ? stays[stop] ?? null : null;
  const boardValue = current ? boardDate(current.visit.date) : boardDate(OPENING_ISO);
  const ticks = useMemo(() => (player ? monthTicks(stays, player.schedule.stopTimes, player.total) : []), [player, stays]);
  const stats = useMemo(() => finaleStats(stays, home), [stays, home]);
  const showPostcard = phase === 'hold' && current && started;
  const showFinale = phase === 'finale' || phase === 'end';
  const scrubLabel = current ? `${formatDate(current.visit.date)}, stay ${stop + 1} of ${stays.length}` : `Opening, ${formatDate(OPENING_ISO)}`;

  // ---- empty / unavailable states ----------------------------------------------------------
  if (ready && all.length === 0) {
    return (
      <div className={s.emptyPage}>
        <EmptyState
          art={<IconJourney size={32} />}
          title="Our journey starts with one stay"
          body="Add our first stay and we'll plot the route from there, every check-in in order."
          action={<ButtonLink href="#/add">Add our first stay</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div
      className={s.screen}
      data-phase={phase}
      data-status={status}
      data-playing={playing || undefined}
      data-reduced={reduced || undefined}
      data-recording={recording || undefined}
      data-testid="journey-screen"
    >
      <h1 className="sr-only">Our journey</h1>
      <div ref={stageRef} className={s.stage}>
        <div ref={mapRef} className={s.map} data-testid="journey-map" />
        <div ref={veilRef} className={s.veil} aria-hidden="true" />
      </div>

      {status === 'loading' && hasStays ? (
        <div className={s.loading}>
          <ClockLoader label="Loading our journey…" />
          <p aria-hidden="true">Loading our journey…</p>
        </div>
      ) : null}

      <header className={s.top}>
        <button type="button" className={s.roundBtn} aria-label="Close the journey" onClick={() => goBack('/map')}>
          <IconClose size={22} />
        </button>
        <div className={s.board} data-testid="journey-date" data-date={boardValue}>
          {started ? <SplitFlap value={boardValue} length={11} ariaLabel={current ? formatDate(current.visit.date) : formatDate(OPENING_ISO)} size="md" animateOnMount sound={!muted} /> : null}
        </div>
        <button type="button" className={s.roundBtn} aria-pressed={muted} aria-label={muted ? 'Sound on' : 'Mute'} onClick={toggleMute}>
          {muted ? <IconMute size={22} /> : <IconSound size={22} />}
        </button>
      </header>

      {fallback ? <p className={s.notice}>Offline. Flying over what we&apos;ve already loaded.</p> : null}

      <p className="sr-only" aria-live="polite">
        {current && started ? `Stay ${stop + 1} of ${stays.length}: ${current.hotel.name}, ${formatDate(current.visit.date)}` : ''}
      </p>

      {!started && status === 'ready' && hasStays ? (
        <section className={s.startCard} aria-label="Our journey">
          <p className={s.startDate}>{formatDate(OPENING_ISO)}</p>
          <h2 className={s.startTitle}>Our journey</h2>
          <p className={s.startBody}>
            {stays.length === 1 ? 'Our first stop, and the start of the route.' : 'Every stay, in order, from 19 Jun 2026 to now.'}
          </p>
          {reduced ? <p className={s.startNote}>Reduced motion is on. We&apos;ll crossfade between stops instead of flying.</p> : null}
          <Button onClick={start} icon={<IconPlay size={18} />} data-testid="journey-start">
            Play our journey
          </Button>
        </section>
      ) : null}

      {showPostcard && current ? (
        <div className={s.postcardWrap} key={current.visit.visit_id}>
          <Postcard stay={current} index={stop} count={stays.length} onOpen={openFromPostcard} />
        </div>
      ) : null}

      {showFinale && started ? (
        <div className={s.finaleWrap}>
          <Finale
            stats={stats}
            reduced={reduced}
            actions={
              phase === 'end' && !recording ? (
                <>
                  <Button variant="secondary" size="sm" icon={<IconUndo size={16} />} onClick={() => playerRef.current?.play()}>
                    Play again
                  </Button>
                  <Button size="sm" icon={<IconShare size={16} />} onClick={() => setShareOpen(true)}>
                    Share our journey
                  </Button>
                </>
              ) : null
            }
          />
        </div>
      ) : null}

      {status === 'nowebgl' ? (
        <div className={s.loading}>
          <p className={s.noGl} role="status">
            This browser can&apos;t fly our 3D map, so the journey can&apos;t play here. Our stays are all still on the map&apos;s list view.
          </p>
          <ButtonLink href="#/map" variant="secondary">
            Open our map
          </ButtonLink>
        </div>
      ) : null}

      {!hasStays && ready ? (
        <div className={s.loading}>
          <p className={s.noGl}>No stays in this view yet.</p>
          <Button variant="secondary" onClick={() => setFilter('all')}>
            Show all time
          </Button>
        </div>
      ) : null}

      <div className={s.dock} hidden={recording}>
        <div className={s.scrubber}>
          <div className={s.track} aria-hidden="true">
            <div ref={fillRef} className={s.fill} />
            {ticks.map((t) => (
              <span key={`${t.label}-${t.at}`} className={s.tick} style={{ left: `${t.at * 100}%` }}>
                <span className={s.tickLabel}>{t.label}</span>
              </span>
            ))}
          </div>
          <input
            ref={scrubRef}
            className={s.range}
            type="range"
            min={0}
            max={1000}
            step={1}
            defaultValue={0}
            aria-label="Journey timeline"
            aria-valuetext={scrubLabel}
            data-testid="journey-scrubber"
            disabled={!player}
            onPointerDown={onScrubStart}
            onPointerUp={onScrubEnd}
            onPointerCancel={onScrubEnd}
            onInput={(e) => onScrub(Number((e.target as HTMLInputElement).value))}
            onKeyUp={onScrubEnd}
          />
        </div>
        <div className={s.controls}>
          <button type="button" className={s.ctrl} aria-label="Previous stop" disabled={!player} onClick={() => (setStarted(true), player?.prev())}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M6 5v14M18 6l-9 6 9 6z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className={s.playBtn}
            aria-label={playing ? 'Pause' : 'Play'}
            disabled={!player}
            onClick={toggle}
            data-testid="journey-play"
          >
            {playing ? <IconPause size={26} /> : <IconPlay size={26} />}
          </button>
          <button type="button" className={s.ctrl} aria-label="Next stop" disabled={!player} onClick={() => (setStarted(true), player?.next())}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M18 5v14M6 6l9 6-9 6z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className={s.speed}
            aria-label={`Speed ${speed}×`}
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
            data-testid="journey-speed"
          >
            {speed}×
          </button>
          <label className={s.filter}>
            <span className="sr-only">Show</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value as JourneyFilter)} data-testid="journey-filter">
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ShareJourney
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        stays={stays}
        stats={stats}
        wishes={wishes}
        engine={engine}
        player={player}
        onRecording={setRecording}
      />
    </div>
  );
}
