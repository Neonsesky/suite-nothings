/**
 * The journey player (SPEC §10). One paused GSAP master timeline holds a tween per segment
 * (opening, each leg, each stop's hold, finale); each tween drives that segment's `p` from 0 to 1.
 * Every frame we read the active segment's `p`, compute the camera with the pure maths in
 * `camera.ts` and `map.jumpTo` it, so the whole replay is scrubbable. React only hears about
 * low-frequency changes (stop reached, phase changed, play state); per-frame DOM work (scrubber,
 * crossfade veil, traveller) goes through refs and MapLibre markers.
 */
import { gsap } from 'gsap';
import type { LineHandle, MarkerHandle, SuiteMap } from '@/map/engine';
import { play } from '@/lib/sound';
import type { LatLng, LegStyle } from '@/lib/geo';
import {
  HOLD_S,
  OPENING_S,
  buildSchedule,
  cameraAt,
  mercatorFractions,
  planJourney,
  stopIndexAt,
  type Camera,
  type LegPlan,
  type LngLat,
  type Schedule,
  type Segment,
} from './camera';
import type { OverlayState, TravellerKind } from './export/overlay';

export type Phase = 'ready' | 'opening' | 'travel' | 'hold' | 'finale' | 'end';

export interface JourneyStop extends LatLng {
  hotelId: string;
}

export interface PlayerClasses {
  pin: string;
  pinDrop: string;
  wish: string;
  traveller: string;
}

export interface PlayerEvents {
  /** The last stop reached changed (-1 before the first arrival). `how` is 'play' when reached by playing. */
  onStop?(index: number, how: 'play' | 'seek'): void;
  onPhase?(phase: Phase): void;
  onPlayState?(playing: boolean): void;
  /** Every frame. Keep it to ref writes. */
  onTick?(time: number, total: number): void;
}

export interface PlayerOptions {
  engine: SuiteMap;
  stops: readonly JourneyStop[];
  home: LatLng;
  wishes: readonly LatLng[];
  reduced: boolean;
  viewport: { width: number; height: number };
  classes: PlayerClasses;
  /** Cream veil used for reduced-motion crossfades. */
  veil?: HTMLElement | null;
  /** Base time scale (the e2e hook passes 20). */
  baseScale?: number;
  events: PlayerEvents;
}

/** Reduced motion: each move is a quick crossfade instead of a flight. */
const CROSSFADE_S = 1.2;
const TRAIL_OPACITY = 0.42;

const TRAVELLER_ICON: Record<TravellerKind, string> = {
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" fill="currentColor"/>',
  car: '<path d="M5.5 16.5H4.3a.8.8 0 0 1-.8-.8v-2.9a2 2 0 0 1 1.3-1.9l2.2-.8 1.9-3.2A2 2 0 0 1 10.6 6h4.1a2 2 0 0 1 1.6.8l2.5 3.4 1.2.4a2 2 0 0 1 1.5 1.9v3.2a.8.8 0 0 1-.8.8h-1.2M9.5 16.5h5" fill="none"/><path d="M7 10.5h13" fill="none"/><circle cx="7.5" cy="16.5" r="2" fill="none"/><circle cx="16.5" cy="16.5" r="2" fill="none"/>',
  plane: '<path d="M20.6 3.4c.8.8.3 2.2-.7 3.2l-3.4 3.4 2.2 8.8-1.5 1.5-3.9-7-3.3 3.3.4 2.8-1.2 1.2-1.8-3.5-3.5-1.8 1.2-1.2 2.8.4 3.3-3.3-7-3.9L6 5.8l8.8 2.2 3.4-3.4c1-1 2.4-1.5 3.2-.7z" fill="currentColor"/>',
};

export function travellerFor(style: LegStyle): TravellerKind {
  return style === 'glide' ? 'heart' : style === 'hop' ? 'car' : 'plane';
}

/** Shift a path's longitudes by whole turns so it starts next to `lng`. */
function alignLng(path: readonly LngLat[], lng: number): LngLat[] {
  if (!path.length) return [];
  const shift = Math.round((lng - path[0][0]) / 360) * 360;
  return shift ? path.map(([x, y]) => [x + shift, y] as LngLat) : path.slice();
}

export class JourneyPlayer {
  readonly schedule: Schedule;
  readonly plan: ReturnType<typeof planJourney>;
  private tl: gsap.core.Timeline;
  private progress: { p: number }[] = [];
  private o: PlayerOptions;
  private trail: LineHandle | null = null;
  private active: LineHandle | null = null;
  private traveller: MarkerHandle | null = null;
  private travellerKind: TravellerKind | null = null;
  private pins = new Map<string, { marker: MarkerHandle; first: number; shown: boolean }>();
  private wishMarkers: MarkerHandle[] = [];
  /** Trail fraction (mercator, along the concatenated route) at the end of each leg. */
  private trailEnds: number[] = [];
  private lastStop = -2;
  private lastPhase: Phase = 'ready';
  private lastSeg = -1;
  private activeLeg = -1;
  private cache = { trail: -1, trailOpacity: -1, active: -1, veil: -1 };
  private seeking = false;
  private scale = 1;
  private destroyed = false;
  private cam: Camera | null = null;

  constructor(o: PlayerOptions) {
    this.o = o;
    const vw = o.viewport.width;
    const vh = o.viewport.height;
    this.plan = planJourney(o.stops, { viewportWidth: vw, viewportHeight: vh, home: o.home });
    if (o.reduced) {
      for (const leg of [this.plan.opening, ...this.plan.legs, this.plan.finale]) if (leg) leg.duration = CROSSFADE_S;
    }
    this.schedule = buildSchedule(this.plan);
    this.scale = o.baseScale ?? 1;
    this.tl = gsap.timeline({
      paused: true,
      onUpdate: () => this.render(),
      onComplete: () => {
        this.render();
        o.events.onPlayState?.(false);
      },
    });
    this.tl.timeScale(this.scale);
    for (const seg of this.schedule.segments) {
      const state = { p: 0 };
      this.progress.push(state);
      this.tl.to(state, { p: 1, duration: seg.duration, ease: 'none' }, seg.start);
    }
    // Pad so an empty schedule still has a (zero) length and `progress()` is defined.
    if (!this.schedule.segments.length) this.tl.set({}, {}, 0);
    this.installRoute();
    this.render(true);
  }

  // ---- public controls --------------------------------------------------------------------
  get total(): number {
    return this.schedule.total;
  }
  get time(): number {
    return this.tl.time();
  }
  get playing(): boolean {
    return this.tl.isActive() || (!this.tl.paused() && this.tl.progress() < 1);
  }
  get stopIndex(): number {
    return this.lastStop;
  }
  get phase(): Phase {
    return this.lastPhase;
  }

  play(): void {
    if (this.destroyed) return;
    if (this.tl.progress() >= 1) this.seek(0);
    this.tl.play();
    this.o.events.onPlayState?.(true);
  }
  pause(): void {
    this.tl.pause();
    this.o.events.onPlayState?.(false);
  }
  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }
  setSpeed(speed: number): void {
    this.tl.timeScale(speed * this.scale);
  }
  seek(time: number): void {
    this.seeking = true;
    this.tl.time(Math.max(0, Math.min(this.total, time)), false);
    this.render();
    this.seeking = false;
  }
  seekStop(index: number): void {
    const times = this.schedule.stopTimes;
    if (!times.length) return;
    const i = Math.max(0, Math.min(times.length - 1, index));
    this.seek(times[i]);
  }
  /** Next stop's arrival, or the finale after the last one. */
  next(): void {
    const i = stopIndexAt(this.schedule, this.time + 1e-3);
    if (i + 1 < this.schedule.stopTimes.length) this.seekStop(i + 1);
    else {
      const fin = this.schedule.segments.find((s) => s.kind === 'finale');
      if (fin) this.seek(fin.start + fin.duration);
    }
  }
  /** Back to the start of this stop, or the one before when we're already at its arrival. */
  prev(): void {
    const t = this.time;
    const i = stopIndexAt(this.schedule, t + 1e-3);
    if (i < 0) return this.seek(0);
    const here = this.schedule.stopTimes[i];
    this.seekStop(t - here > 0.6 ? i : i - 1);
  }

  /** Where everything is on screen right now, for the video recorder. */
  overlayState(): Omit<OverlayState, 'date' | 'postcard' | 'finale'> {
    const e = this.o.engine;
    const pins: OverlayState['pins'] = [];
    for (const [, pin] of this.pins) {
      if (!pin.shown) continue;
      const ll = (pin.marker as MarkerHandle & { lngLat?: LngLat }).lngLat;
      if (ll) pins.push({ ...e.project(ll), scale: 1 });
    }
    const wishes = this.wishMarkers.map((m) => {
      const ll = (m as MarkerHandle & { lngLat?: LngLat }).lngLat ?? [0, 0];
      return { ...e.project(ll), pulse: (performance.now() % 1800) / 1800 };
    });
    let traveller: OverlayState['traveller'] = null;
    if (this.traveller && this.travellerKind && this.traveller.element.dataset.hidden !== '1') {
      const ll = (this.traveller as MarkerHandle & { lngLat?: LngLat }).lngLat;
      const rot = Number(this.traveller.element.dataset.heading ?? 0) - (this.cam?.bearing ?? 0);
      if (ll) traveller = { ...e.project(ll), rotation: this.travellerKind === 'plane' ? rot : 0, kind: this.travellerKind };
    }
    return { pins, wishes, traveller };
  }

  destroy(): void {
    this.destroyed = true;
    this.tl.kill();
    this.trail?.remove();
    this.active?.remove();
    this.traveller?.remove();
    for (const [, p] of this.pins) p.marker.remove();
    for (const w of this.wishMarkers) w.remove();
    this.pins.clear();
    this.wishMarkers = [];
  }

  // ---- setup ------------------------------------------------------------------------------
  private installRoute(): void {
    const e = this.o.engine;
    const legs = this.plan.legs;
    // One faded trail for every leg already flown, one bright line for the leg in progress.
    const route: LngLat[] = [];
    const legEndIdx: number[] = [];
    for (const leg of legs) {
      const prevLng = route.length ? route[route.length - 1][0] : leg.path[0]?.[0] ?? 0;
      const path = alignLng(leg.path, prevLng);
      route.push(...(route.length ? path.slice(1) : path));
      legEndIdx.push(route.length - 1);
    }
    if (route.length >= 2) {
      const fr = mercatorFractions(route);
      this.trailEnds = legEndIdx.map((i) => fr[i] ?? 1);
      this.trail = e.addLine('journey-trail', route, { width: 3, opacity: TRAIL_OPACITY });
      this.trail.setProgress(0);
      this.active = e.addLine('journey-leg', legs[0].path, { width: 4.5 });
      this.active.setProgress(0);
    }
    // Pins, hidden until the replay reaches them.
    this.o.stops.forEach((s, i) => {
      if (this.pins.has(s.hotelId)) return;
      const el = document.createElement('div');
      el.className = this.o.classes.pin;
      el.dataset.shown = '0';
      el.setAttribute('aria-hidden', 'true');
      const marker = this.track(e.addMarker(el, [s.lng, s.lat], { anchor: 'bottom' }), [s.lng, s.lat]);
      this.pins.set(s.hotelId, { marker, first: i, shown: false });
    });
    // The traveller rides the tip of the bright line.
    if (legs.length) {
      const el = document.createElement('div');
      el.className = this.o.classes.traveller;
      el.dataset.hidden = '1';
      el.setAttribute('aria-hidden', 'true');
      this.traveller = this.track(e.addMarker(el, legs[0].path[0], { anchor: 'center' }), legs[0].path[0]);
    }
  }

  /** Remember a marker's position so the recorder can project it without asking MapLibre. */
  private track(m: MarkerHandle, ll: LngLat): MarkerHandle {
    const t = m as MarkerHandle & { lngLat?: LngLat };
    t.lngLat = ll;
    const set = m.setLngLat;
    t.setLngLat = (x) => {
      t.lngLat = x as LngLat;
      set(x);
    };
    return t;
  }

  private setTraveller(kind: TravellerKind | null, pos?: LngLat, heading = 0): void {
    const t = this.traveller;
    if (!t) return;
    const el = t.element;
    if (!kind || !pos) {
      if (el.dataset.hidden !== '1') el.dataset.hidden = '1';
      return;
    }
    if (kind !== this.travellerKind) {
      this.travellerKind = kind;
      el.dataset.kind = kind;
      el.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${TRAVELLER_ICON[kind]}</svg>`;
    }
    el.dataset.hidden = '0';
    t.setLngLat(pos);
    const bearing = this.cam?.bearing ?? 0;
    // Marker rotation is map-aligned. The plane noses along the heading (its glyph points
    // north-east); the car turns but keeps its wheels down; the heart stays upright.
    el.dataset.heading = String(heading);
    if (kind === 'plane') t.setRotation(heading - 45);
    else if (kind === 'car') {
      const west = ((((heading - bearing) % 360) + 360) % 360) > 180;
      el.dataset.west = west ? '1' : '0';
      t.setRotation(west ? heading + 90 : heading - 90);
    } else t.setRotation(bearing);
  }

  private showPinsUpTo(index: number, animate: boolean): void {
    for (const [, pin] of this.pins) {
      const show = pin.first <= index;
      if (show === pin.shown) continue;
      pin.shown = show;
      const el = pin.marker.element;
      el.dataset.shown = show ? '1' : '0';
      el.classList.toggle(this.o.classes.pinDrop, show && animate && !this.o.reduced);
    }
  }

  private setWishes(on: boolean): void {
    if (on && !this.wishMarkers.length) {
      this.wishMarkers = this.o.wishes.map((w) => {
        const el = document.createElement('div');
        el.className = this.o.classes.wish;
        el.setAttribute('aria-hidden', 'true');
        return this.track(this.o.engine.addMarker(el, [w.lng, w.lat], { anchor: 'bottom' }), [w.lng, w.lat]);
      });
    } else if (!on && this.wishMarkers.length) {
      for (const m of this.wishMarkers) m.remove();
      this.wishMarkers = [];
    }
  }

  // ---- per frame ----------------------------------------------------------------------------
  private segmentAt(time: number): number {
    const segs = this.schedule.segments;
    for (let i = segs.length - 1; i >= 0; i--) if (time >= segs[i].start) return i;
    return segs.length ? 0 : -1;
  }

  private legFor(seg: Segment): LegPlan | null {
    if (seg.kind === 'opening') return this.plan.opening;
    if (seg.kind === 'finale') return this.plan.finale;
    if (seg.kind === 'leg') return this.plan.legs[seg.legIndex ?? 0] ?? null;
    return null;
  }

  /** The leg that brought us to stop i (the opening for stop 0). */
  private arrivalLeg(stop: number): LegPlan | null {
    return stop <= 0 ? this.plan.opening : this.plan.legs[stop - 1] ?? null;
  }

  private render(force = false): void {
    if (this.destroyed) return;
    const time = this.tl.time();
    const total = this.total;
    const i = this.segmentAt(time);
    const seg = i >= 0 ? this.schedule.segments[i] : null;
    const p = i >= 0 ? this.progress[i].p : 0;
    const map = this.o.engine.map;
    const reduced = this.o.reduced;
    const ended = total > 0 && time >= total - 1e-6;

    let cam: Camera | null = null;
    let phase: Phase = 'ready';
    let travel: { kind: TravellerKind; pos: LngLat; heading: number } | null = null;
    let veil = 0;
    let activeLeg = -1;
    let activeProgress = 0;
    let trailUpTo = -1; // legs [0..trailUpTo] are in the faded trail
    let trailOpacity = TRAIL_OPACITY;
    let wishes = false;

    if (seg) {
      const leg = this.legFor(seg);
      if (seg.kind === 'opening' && leg) {
        const local = time - seg.start;
        const t = local <= OPENING_S ? 0 : (local - OPENING_S) / leg.duration;
        phase = local <= 0 && !this.playing && time === 0 ? 'ready' : 'opening';
        ({ cam, veil } = this.move(leg, Math.min(1, t), reduced));
      } else if (seg.kind === 'leg' && leg) {
        phase = 'travel';
        const s = cameraAt(leg, reduced ? 1 : p);
        ({ cam, veil } = this.move(leg, p, reduced));
        activeLeg = seg.legIndex ?? 0;
        activeProgress = reduced ? 1 : s.lineProgress;
        trailUpTo = activeLeg - 1;
        if (!reduced && p > 0 && p < 1) travel = { kind: travellerFor(leg.style), pos: s.position, heading: s.heading };
      } else if (seg.kind === 'hold') {
        phase = 'hold';
        const stop = seg.stopIndex ?? 0;
        const leg0 = this.arrivalLeg(stop);
        cam = leg0 ? cameraAt(leg0, 1).camera : null;
        if (stop > 0) {
          activeLeg = stop - 1;
          activeProgress = 1;
          trailUpTo = stop - 2;
        }
      } else if (seg.kind === 'finale' && leg) {
        phase = ended ? 'end' : 'finale';
        ({ cam, veil } = this.move(leg, p, reduced));
        trailUpTo = this.plan.legs.length - 1;
        trailOpacity = TRAIL_OPACITY + (0.95 - TRAIL_OPACITY) * Math.min(1, p * 1.6);
        wishes = p > 0.55 || ended;
      }
    }

    if (cam) {
      this.cam = cam;
      map.jumpTo(cam);
    }

    // Route lines (only touch MapLibre when a value actually changed).
    if (this.trail) {
      const tp = trailUpTo < 0 ? 0 : this.trailEnds[Math.min(trailUpTo, this.trailEnds.length - 1)];
      if (tp !== this.cache.trail) this.trail.setProgress((this.cache.trail = tp));
      if (trailOpacity !== this.cache.trailOpacity) this.trail.setOpacity((this.cache.trailOpacity = trailOpacity));
    }
    if (this.active) {
      if (activeLeg >= 0 && activeLeg !== this.activeLeg) {
        this.active.setCoordinates(this.plan.legs[activeLeg].path);
        this.activeLeg = activeLeg;
      }
      const ap = activeLeg >= 0 ? activeProgress : 0;
      if (ap !== this.cache.active) this.active.setProgress((this.cache.active = ap));
    }
    this.setTraveller(travel?.kind ?? null, travel?.pos, travel?.heading);
    this.setWishes(wishes);
    if (this.o.veil && veil !== this.cache.veil) {
      this.cache.veil = veil;
      this.o.veil.style.opacity = String(veil);
    }

    // Stops and phases: low-frequency events for React.
    const naturally = !this.seeking && !force;
    const stop = stopIndexAt(this.schedule, time);
    if (stop !== this.lastStop) {
      const forward = stop === this.lastStop + 1;
      this.showPinsUpTo(stop, naturally && forward);
      if (naturally && forward && stop >= 0) play('beep');
      this.lastStop = stop;
      this.o.events.onStop?.(stop, naturally ? 'play' : 'seek');
    }
    if (i !== this.lastSeg) {
      if (naturally && seg?.kind === 'leg' && !reduced) {
        const style = this.legFor(seg)?.style;
        if (style === 'flight' || style === 'hop') play('whoosh');
      }
      this.lastSeg = i;
    }
    if (phase !== this.lastPhase) {
      this.lastPhase = phase;
      this.o.events.onPhase?.(phase);
    }
    this.o.events.onTick?.(time, total);
  }

  /** Camera for a move: a flight along the plan, or under reduced motion a cut hidden by a veil. */
  private move(leg: LegPlan, p: number, reduced: boolean): { cam: Camera; veil: number } {
    if (!reduced) return { cam: cameraAt(leg, p).camera, veil: 0 };
    const cam = cameraAt(leg, p < 0.5 ? 0 : 1).camera;
    return { cam, veil: Math.max(0, 1 - Math.abs(p * 2 - 1) * 1.15) };
  }
}

export { HOLD_S };
