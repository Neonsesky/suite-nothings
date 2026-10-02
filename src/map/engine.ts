/**
 * The Suite Nothings map engine (SPEC §9). One continuous MapLibre globe whose City / Country /
 * World chapters are zoom ranges; MapScreen, MiniMap and (wave 2) Journey all drive it.
 *
 * `maplibre-gl` is only ever loaded through `loadMaplibre()` (a lazy chunk), never on the
 * initial path. See docs/contracts.md → "Map engine".
 */
import type * as ML from 'maplibre-gl';
import type {
  ExpressionSpecification,
  GeoJSONSource,
  LayerSpecification,
  LngLatLike,
  Map as MlMap,
  Marker,
  StyleSpecification,
} from 'maplibre-gl';
import type { Feature, LineString } from 'geojson';
import type { HomeBase, Place, Stay, Wish } from '@/data/types';
import { BASE_URL } from '@/config/env';
import { pinDataUrl, stayPin } from '@/components/brand/pins';
import baseStyle from './style.json';
import {
  cityBBox,
  chapterForZoom,
  computeBreakpoints,
  fadeStops,
  framingFor,
  onVisibleHemisphere,
  settleTarget,
  type Breakpoints,
  type Chapter,
  type Framing,
} from './chapters';
import { LIGHTING_REFRESH_MS, lookFor, resolvePhase, solarPosition, type LightingLook, type LightingMode } from './lighting';
import { aggregate, ensurePinImages, mapPixelRatio, neighbours, type PinAggregates, type StayPinProps } from './pins';
import s from './engine.module.css';

type MaplibreModule = typeof ML;

let libPromise: Promise<MaplibreModule> | null = null;

/** Lazily load maplibre-gl, its CSS and its worker (once). */
export function loadMaplibre(): Promise<MaplibreModule> {
  libPromise ??= Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl.css'),
    import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
  ]).then(([lib, , worker]) => {
    lib.setWorkerUrl(worker.default);
    return lib;
  });
  return libPromise;
}

/** True when this browser can create a WebGL context (MapLibre needs WebGL2 or WebGL1). */
export function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export interface MapData {
  stays: readonly Stay[];
  wishes?: readonly Wish[];
  places?: readonly Place[];
  home?: HomeBase | null;
}

export interface SuiteMapOptions {
  home: HomeBase;
  lighting?: LightingMode;
  /** Initial camera; defaults to the framing of `chapter` (default City). */
  camera?: Partial<Framing>;
  chapter?: Chapter;
  /** Gestures and keyboard (default true). */
  interactive?: boolean;
  /** Initial pins (also centres the City framing on our stays). */
  data?: MapData;
  /** Pins, bubbles, wishes, home and arcs (default true). MiniMap turns them off. */
  overlays?: boolean;
  reducedMotion?: boolean;
  /** Gentle ease into a chapter after a gesture ends near a breakpoint (default = interactive). */
  settle?: boolean;
}

export interface ViewInfo {
  zoom: number;
  chapter: Chapter;
  /** Visits (not hotels) whose pin is on screen. */
  inView: number;
  bearing: number;
  pitch: number;
}

export interface LineStyle {
  color?: string;
  width?: number;
  /** Ink outline under the line (the old-adventure-map look). */
  outline?: boolean;
  opacity?: number;
  dash?: number[];
}

export interface LineHandle {
  readonly id: string;
  setCoordinates(coords: readonly [number, number][]): void;
  /** Draw the first `p` (0..1) of the line, measured along its length. */
  setProgress(p: number): void;
  setOpacity(o: number): void;
  remove(): void;
}

export interface MarkerHandle {
  readonly element: HTMLElement;
  setLngLat(lngLat: LngLatLike): void;
  /** Degrees clockwise from north, relative to the map. */
  setRotation(deg: number): void;
  remove(): void;
}

export interface SuiteMap {
  readonly map: MlMap;
  readonly maplibre: MaplibreModule;
  readonly breakpoints: Breakpoints;
  readonly home: HomeBase;
  chapter(): Chapter;
  framing(chapter: Chapter): Framing;
  /** Fly to a chapter's framing (instant under reduced motion or with `animate: false`). */
  setChapter(chapter: Chapter, opts?: { animate?: boolean }): void;
  setLighting(mode: LightingMode): void;
  look(): LightingLook;
  setData(data: MapData): Promise<void>;
  setArcsVisible(visible: boolean): void;
  setIdleSpin(enabled: boolean): void;
  select(hotelId: string | null): void;
  flyToHotel(hotelId: string, opts?: { zoom?: number }): void;
  onChapterChange(cb: (chapter: Chapter, prev: Chapter) => void): () => void;
  onView(cb: (info: ViewInfo) => void): () => void;
  onPinClick(cb: (pin: StayPinProps) => void): () => void;
  onLookChange(cb: (look: LightingLook) => void): () => void;
  onFallbackChange(cb: (fallback: boolean) => void): () => void;
  isFallback(): boolean;
  /** True once a vector tile has loaded; false while offline with nothing cached. */
  hasTiles(): boolean;
  resetNorth(): void;
  addLine(id: string, coords: readonly [number, number][], style?: LineStyle): LineHandle;
  addMarker(element: HTMLElement, lngLat: LngLatLike, opts?: { anchor?: 'center' | 'bottom' }): MarkerHandle;
  project(lngLat: LngLatLike): { x: number; y: number };
  unproject(point: { x: number; y: number }): { lng: number; lat: number };
  destroy(): void;
}

const SOURCES = {
  pins: 'sn-pins',
  cities: 'sn-cities',
  countries: 'sn-countries',
  wishes: 'sn-wishes',
  places: 'sn-places',
  arcs: 'sn-arcs',
  home: 'sn-home',
} as const;
const CLICK_LAYERS = ['sn-pins', 'sn-cities', 'sn-countries'];
const FALLBACK_LAND = 'sn-land';

const INK = '#292935';
const GINGER = '#FC5E57';

const SETTLE_DELAY_MS = 260;
const SPIN_IDLE_MS = 4000;
const SPIN_DEG_PER_SEC = 2.4;

const zoomExpr = (...stops: (number | string)[]) => ['interpolate', ['linear'], ['zoom'], ...stops] as unknown as ExpressionSpecification;

/** Our overlay layers, with every chapter change as a zoom-interpolated crossfade. */
function overlayLayers(bp: Breakpoints): LayerSpecification[] {
  const [c0, c1] = fadeStops(bp.country);
  const [k0, k1] = fadeStops(bp.city);
  const common = { 'icon-allow-overlap': true, 'icon-ignore-placement': true } as const;
  return [
    {
      id: 'sn-arcs-casing',
      type: 'line',
      source: SOURCES.arcs,
      maxzoom: c1 + 0.8,
      layout: { visibility: 'none', 'line-cap': 'round' },
      paint: { 'line-color': INK, 'line-width': 4, 'line-opacity': zoomExpr(c0 - 0.6, 0.55, c1 + 0.6, 0) },
    },
    {
      id: 'sn-arcs',
      type: 'line',
      source: SOURCES.arcs,
      maxzoom: c1 + 0.8,
      layout: { visibility: 'none', 'line-cap': 'round' },
      paint: { 'line-color': GINGER, 'line-width': 2.2, 'line-opacity': zoomExpr(c0 - 0.6, 0.95, c1 + 0.6, 0) },
    },
    {
      id: 'sn-home',
      type: 'symbol',
      source: SOURCES.home,
      layout: { ...common, 'icon-image': ['get', 'icon'], 'icon-anchor': 'center', 'icon-size': zoomExpr(1, 0.62, bp.city, 0.9, bp.city + 3, 1) },
    },
    {
      id: 'sn-wishes',
      type: 'symbol',
      source: SOURCES.wishes,
      layout: { ...common, 'icon-image': ['get', 'icon'], 'icon-anchor': 'bottom', 'icon-size': zoomExpr(1, 0.55, bp.city, 0.85, bp.city + 3, 1) },
      paint: { 'icon-opacity': 0.92 },
    },
    {
      id: 'sn-places',
      type: 'symbol',
      source: SOURCES.places,
      layout: { ...common, 'icon-image': ['get', 'icon'], 'icon-anchor': 'bottom', 'icon-size': zoomExpr(1, 0.55, bp.city, 0.85, bp.city + 3, 1) },
    },
    {
      id: 'sn-countries',
      type: 'symbol',
      source: SOURCES.countries,
      maxzoom: c1 + 0.05,
      layout: { ...common, 'icon-image': ['get', 'icon'], 'icon-anchor': 'center', 'icon-size': zoomExpr(0, 0.9, c1, 1), 'symbol-sort-key': ['get', 'count'] },
      paint: { 'icon-opacity': zoomExpr(c0, 1, c1, 0) },
    },
    {
      id: 'sn-cities',
      type: 'symbol',
      source: SOURCES.cities,
      minzoom: c0 - 0.05,
      maxzoom: k1 + 0.05,
      layout: { ...common, 'icon-image': ['get', 'icon'], 'icon-anchor': 'center', 'symbol-sort-key': ['get', 'count'] },
      paint: { 'icon-opacity': zoomExpr(c0, 0, c1, 1, k0, 1, k1, 0) },
    },
    {
      id: 'sn-pins',
      type: 'symbol',
      source: SOURCES.pins,
      minzoom: k0 - 0.05,
      layout: {
        ...common,
        'icon-image': ['get', 'icon'],
        'icon-anchor': 'bottom',
        'icon-size': zoomExpr(k0, 0.8, k1 + 2, 1),
        'symbol-z-order': 'viewport-y',
      },
      paint: { 'icon-opacity': zoomExpr(k0, 0, k1, 1) },
    },
  ];
}

type Paint = Record<string, unknown>;

/** Per-layer paint overrides for a lighting look; anything not listed restores the original. */
function lookPaint(layer: LayerSpecification, look: LightingLook): Paint {
  const night = look.phase === 'night';
  const sl = 'source-layer' in layer ? layer['source-layer'] : undefined;
  const id = layer.id;
  if (id === 'sn-ocean') return { 'background-color': look.waterColor };
  if (layer.type === 'background') return { 'background-color': look.landColor };
  if (id === FALLBACK_LAND) return { 'fill-color': look.landColor };
  if (id === 'building-3d') return { 'fill-extrusion-color': look.buildingColor };
  if (id === 'building') return { 'fill-color': look.buildingColor, 'fill-outline-color': look.buildingColor };
  if (sl === 'water' && layer.type === 'fill') return { 'fill-color': look.waterColor };
  if (sl === 'waterway' && layer.type === 'line') return { 'line-color': look.waterColor };
  if (layer.type === 'fill' && (sl === 'landcover' || sl === 'park' || sl === 'landuse')) return night ? { 'fill-color': '#34384F' } : {};
  if (sl === 'transportation' && layer.type === 'line') {
    if (id.includes('casing')) return night ? { 'line-color': '#15172A' } : {};
    if (id.includes('rail')) return night ? { 'line-color': '#5E6180' } : {};
    return { 'line-color': look.roadColor };
  }
  if (sl === 'boundary') return night ? { 'line-color': '#B9B6CC' } : {};
  if (layer.type === 'symbol' && !id.startsWith('sn-')) return { 'text-color': look.labelColor, 'text-halo-color': look.labelHalo };
  return {};
}

function fallbackStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'Suite Nothings offline',
    sources: {
      [FALLBACK_LAND]: {
        type: 'geojson',
        data: `${BASE_URL}fallback-world.geojson`,
        attribution: 'Natural Earth',
      },
    },
    layers: [
      { id: 'sn-ocean', type: 'background', paint: { 'background-color': '#CFDFE3' } },
      { id: FALLBACK_LAND, type: 'fill', source: FALLBACK_LAND, paint: { 'fill-color': '#FBF6EC' } },
      { id: 'sn-land-outline', type: 'line', source: FALLBACK_LAND, paint: { 'line-color': INK, 'line-width': 0.8, 'line-opacity': 0.35 } },
    ],
  };
}

function primaryStyle(): StyleSpecification {
  return structuredClone(baseStyle) as unknown as StyleSpecification;
}

export async function createSuiteMap(container: HTMLElement, opts: SuiteMapOptions): Promise<SuiteMap> {
  const lib = await loadMaplibre();
  const home = opts.home;
  const bp = computeBreakpoints(home);
  const overlays = opts.overlays ?? true;
  const interactive = opts.interactive ?? true;
  const settleOn = opts.settle ?? interactive;
  const reduced = opts.reducedMotion ?? false;
  const vp = () => ({ width: container.clientWidth || 390, height: container.clientHeight || 700 });

  let lightingMode: LightingMode = opts.lighting ?? 'auto';
  const computeLook = (): LightingLook => {
    const now = new Date();
    const phase = resolvePhase(lightingMode, now, home.lat, home.lng);
    return lookFor(phase, lightingMode === 'auto' ? solarPosition(now, home.lat, home.lng) : undefined);
  };
  let look = computeLook();

  let fallback = typeof navigator !== 'undefined' && navigator.onLine === false;
  const buildStyle = (): StyleSpecification => {
    const style = fallback ? fallbackStyle() : primaryStyle();
    style.projection = { type: 'globe' };
    style.sky = look.sky;
    style.light = look.light;
    style.transition = { duration: reduced ? 0 : 900, delay: 0 };
    return style;
  };

  let data: MapData = { stays: [], wishes: [], places: [], home, ...opts.data };
  let agg: PinAggregates = aggregate(data.stays, data.wishes ?? [], home, data.places ?? []);
  /** City framing centres on our home-city stays (not the city's geographic centre). */
  const framing = (c: Chapter): Framing => {
    const f = framingFor(c, home, bp, vp());
    if (c !== 'city') return f;
    const box = cityBBox(home);
    const pts = agg.pins.features.map((x) => x.geometry.coordinates).filter(([lng, lat]) => lng >= box[0] && lng <= box[2] && lat >= box[1] && lat <= box[3]);
    if (!pts.length) return f;
    const lng = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const lat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return { ...f, center: [lng, lat] };
  };
  const start = { ...framing(opts.chapter ?? 'city'), ...opts.camera };
  const map = new lib.Map({
    container,
    style: buildStyle(),
    center: start.center,
    zoom: start.zoom,
    pitch: start.pitch,
    bearing: start.bearing,
    pixelRatio: mapPixelRatio(),
    attributionControl: false,
    interactive,
    maxPitch: 72,
    fadeDuration: reduced ? 0 : 250,
    renderWorldCopies: false,
  });
  if (interactive) map.getCanvas().setAttribute('aria-label', 'Map of our stays. Use the arrow keys to pan, plus and minus to zoom.');

  // ---- state ----------------------------------------------------------------------------
  let arcsVisible = false;
  let selected: string | null = null;
  let htmlMarkers: Marker[] = [];
  let tilesLoaded = false;
  let tileErrors = 0;
  let destroyed = false;
  let styleReady = false;
  let overlaysReady = false;
  const lines = new Map<string, { coords: readonly [number, number][]; style: LineStyle; progress: number; opacity: number }>();
  const chapterCbs = new Set<(c: Chapter, prev: Chapter) => void>();
  const viewCbs = new Set<(v: ViewInfo) => void>();
  const pinCbs = new Set<(p: StayPinProps) => void>();
  const lookCbs = new Set<(l: LightingLook) => void>();
  const fallbackCbs = new Set<(f: boolean) => void>();
  let chapter: Chapter = chapterForZoom(map.getZoom(), bp);
  const originals = new Map<string, Paint>();

  const sub = <T>(set: Set<T>, cb: T) => {
    set.add(cb);
    return () => void set.delete(cb);
  };

  // ---- style install (runs after every style load, including the fallback swap) ----------
  const setSourceData = (id: string, fc: unknown) => {
    const src = map.getSource<GeoJSONSource>(id);
    src?.setData(fc as never);
  };

  const pinFilter = (): ExpressionSpecification => {
    const hidden = htmlMarkers.map((m) => m.getElement().dataset.hotelId).filter(Boolean);
    return ['!', ['in', ['get', 'hotelId'], ['literal', hidden]]];
  };

  const installOverlays = async () => {
    if (!overlays) return;
    overlaysReady = false;
    for (const [key, id] of Object.entries(SOURCES)) {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: (agg as unknown as Record<string, unknown>)[key] as never });
    }
    await ensurePinImages(map, agg);
    if (destroyed) return;
    for (const layer of overlayLayers(bp)) if (!map.getLayer(layer.id)) map.addLayer(layer);
    map.setLayoutProperty('sn-arcs', 'visibility', arcsVisible ? 'visible' : 'none');
    map.setLayoutProperty('sn-arcs-casing', 'visibility', arcsVisible ? 'visible' : 'none');
    // Data may have changed while the images were rasterising.
    await ensurePinImages(map, agg);
    if (destroyed) return;
    for (const [key, id] of Object.entries(SOURCES)) setSourceData(id, (agg as unknown as Record<string, unknown>)[key]);
    overlaysReady = true;
    renderHtmlMarkers();
  };

  const installLines = () => {
    for (const [id, l] of lines) addLineLayers(id, l.coords, l.style, l.progress, l.opacity);
  };

  const applyLook = () => {
    const style = map.getStyle();
    if (!style) return;
    map.setSky(look.sky);
    map.setLight(look.light);
    for (const layer of style.layers) {
      const over = lookPaint(layer, look);
      const orig = originals.get(layer.id) ?? {};
      if (!originals.has(layer.id)) {
        const paint = ('paint' in layer ? (layer.paint as Paint | undefined) : undefined) ?? {};
        for (const k of Object.keys(over)) orig[k] = paint[k];
        originals.set(layer.id, orig);
      }
      for (const k of new Set([...Object.keys(over), ...Object.keys(orig)])) {
        if (!(k in orig)) orig[k] = undefined;
        const next = k in over ? over[k] : orig[k];
        const prop = k as keyof ML.AllPaintProperties;
        if (JSON.stringify(map.getPaintProperty(layer.id, prop)) !== JSON.stringify(next)) map.setPaintProperty(layer.id, prop, next as never);
      }
    }
    for (const cb of lookCbs) cb(look);
  };

  map.on('style.load', () => {
    styleReady = true;
    originals.clear();
    void installOverlays().then(() => {
      if (destroyed) return;
      installLines();
      applyLook();
      emitView();
    });
  });

  // ---- fallback (SPEC §7.5) -------------------------------------------------------------
  const setFallback = (next: boolean) => {
    if (next === fallback || destroyed) return;
    fallback = next;
    tileErrors = 0;
    styleReady = false;
    overlaysReady = false;
    map.setStyle(buildStyle(), { diff: false });
    for (const cb of fallbackCbs) cb(fallback);
  };
  map.on('error', (e) => {
    // Swallow tile/glyph failures (offline, flaky networks); nothing is lost, we fall back instead.
    const msg = String((e.error as Error | undefined)?.message ?? '');
    const isTiles = (e as { sourceId?: string }).sourceId === 'openmaptiles' || /openfreemap/.test(msg);
    if (isTiles && !fallback && !tilesLoaded && ++tileErrors >= 1) setFallback(true);
  });
  map.on('sourcedata', (e) => {
    if (e.sourceId === 'openmaptiles' && e.tile) tilesLoaded = true;
  });
  const onOnline = () => {
    if (fallback) setFallback(false);
  };
  window.addEventListener('online', onOnline);

  // ---- chapters, view info, settle --------------------------------------------------------
  let viewTimer = 0;
  const inView = (): number => {
    const c = map.getCenter();
    const { width, height } = vp();
    let n = 0;
    for (const f of agg.pins.features) {
      const [lng, lat] = f.geometry.coordinates;
      if (chapter === 'world' && !onVisibleHemisphere({ lat: c.lat, lng: c.lng }, { lat, lng })) continue;
      const p = map.project([lng, lat]);
      if (p.x >= 0 && p.y >= 0 && p.x <= width && p.y <= height) n += f.properties.count;
    }
    return n;
  };
  const emitView = () => {
    window.clearTimeout(viewTimer);
    viewTimer = window.setTimeout(() => {
      if (destroyed) return;
      const info = { zoom: map.getZoom(), chapter, inView: inView(), bearing: map.getBearing(), pitch: map.getPitch() };
      for (const cb of viewCbs) cb(info);
    }, 180);
  };
  const checkChapter = () => {
    const next = chapterForZoom(map.getZoom(), bp);
    if (next !== chapter) {
      const prev = chapter;
      chapter = next;
      for (const cb of chapterCbs) cb(next, prev);
      if (next !== 'city' && selected) api.select(null);
    }
  };
  map.on('zoom', checkChapter);
  map.on('move', emitView);

  let userGesture = false;
  let settleTimer = 0;
  const markUser = (e: { originalEvent?: unknown }) => {
    if (e.originalEvent) {
      userGesture = true;
      window.clearTimeout(settleTimer);
      stopSpin();
    }
  };
  map.on('movestart', markUser);
  map.on('zoomstart', markUser);
  map.on('moveend', () => {
    emitView();
    if (!userGesture) return;
    userGesture = false;
    scheduleSpin();
    if (!settleOn) return;
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      if (map.isMoving()) return;
      const t = settleTarget(map.getZoom(), bp);
      if (!t) return;
      // Interruptible: any new input stops this ease (MapLibre cancels camera animations on input).
      map.easeTo({ zoom: t.zoom, pitch: t.pitch, duration: reduced ? 0 : 900, easing: (x) => 1 - (1 - x) ** 3 });
    }, SETTLE_DELAY_MS);
  });

  // ---- idle spin on the World chapter -------------------------------------------------------
  let spinEnabled = false;
  let spinning = false;
  let spinTimer = 0;
  const stopSpin = () => {
    window.clearTimeout(spinTimer);
    if (spinning) {
      spinning = false;
      map.stop();
    }
  };
  const spinStep = () => {
    if (!spinning || destroyed) return;
    if (chapter !== 'world' || document.hidden) {
      spinning = false;
      scheduleSpin();
      return;
    }
    const c = map.getCenter();
    map.easeTo({ center: [c.lng + SPIN_DEG_PER_SEC, c.lat], duration: 1000, easing: (x) => x });
    map.once('moveend', () => spinStep());
  };
  const scheduleSpin = () => {
    window.clearTimeout(spinTimer);
    if (!spinEnabled || reduced || !interactive) return;
    spinTimer = window.setTimeout(() => {
      if (chapter !== 'world' || map.isMoving() || document.hidden) return scheduleSpin();
      spinning = true;
      spinStep();
    }, SPIN_IDLE_MS);
  };
  const canvasEl = map.getCanvasContainer();
  const onPointer = () => stopSpin();
  canvasEl.addEventListener('pointerdown', onPointer);
  canvasEl.addEventListener('wheel', onPointer, { passive: true });
  canvasEl.addEventListener('keydown', onPointer);

  // ---- lighting refresh ------------------------------------------------------------------
  const lightTimer = window.setInterval(() => {
    if (lightingMode !== 'auto') return;
    const next = computeLook();
    if (next.phase !== look.phase || JSON.stringify(next.light) !== JSON.stringify(look.light)) {
      look = next;
      if (styleReady) applyLook();
    }
  }, LIGHTING_REFRESH_MS);

  // ---- pins: clicks, HTML markers for the selected pin and its neighbours ----------------
  const pinArt = (p: StayPinProps, isSelected: boolean) => stayPin({ count: p.count, favourite: p.favourite, selected: isSelected });
  const makePinButton = (p: StayPinProps, isSelected: boolean): HTMLElement => {
    const art = pinArt(p, isSelected);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = [s.pin, isSelected ? s.selected : ''].join(' ');
    btn.dataset.hotelId = p.hotelId;
    btn.setAttribute('aria-label', p.label);
    if (isSelected) btn.setAttribute('aria-pressed', 'true');
    btn.style.width = `${art.width}px`;
    btn.style.height = `${art.height}px`;
    const img = document.createElement('img');
    img.src = pinDataUrl(art);
    img.alt = '';
    img.draggable = false;
    btn.append(img);
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      for (const cb of pinCbs) cb(p);
    });
    return btn;
  };
  const renderHtmlMarkers = () => {
    for (const m of htmlMarkers) m.remove();
    htmlMarkers = [];
    if (selected) {
      const me = agg.pins.features.find((f) => f.properties.hotelId === selected);
      if (me) {
        const list = [{ p: me.properties, sel: true }, ...neighbours(agg, selected, 4).map((p) => ({ p, sel: false }))];
        for (const { p, sel } of list) {
          const f = agg.pins.features.find((x) => x.properties.hotelId === p.hotelId);
          if (!f) continue;
          const el = makePinButton(p, sel);
          htmlMarkers.push(new lib.Marker({ element: el, anchor: 'bottom', offset: [0, 4] }).setLngLat(f.geometry.coordinates as [number, number]).addTo(map));
        }
      }
    }
    if (map.getLayer('sn-pins')) map.setFilter('sn-pins', pinFilter());
  };

  map.on('click', (e) => {
    if (!overlays) return;
    const pad = 12;
    const layers = CLICK_LAYERS.filter((l) => map.getLayer(l));
    if (!layers.length) return;
    const hits = map.queryRenderedFeatures(
      [
        [e.point.x - pad, e.point.y - pad],
        [e.point.x + pad, e.point.y + pad],
      ],
      { layers },
    );
    const hit = hits[0];
    if (!hit) {
      if (selected) {
        api.select(null);
        for (const cb of pinCbs) cb({ hotelId: '' } as StayPinProps);
      }
      return;
    }
    const props = hit.properties as Record<string, unknown>;
    const [lng, lat] = (hit.geometry as unknown as { coordinates: [number, number] }).coordinates;
    const dur = reduced ? 0 : 1400;
    if (hit.layer.id === 'sn-pins') {
      const pin = agg.pins.features.find((f) => f.properties.hotelId === props.hotelId)?.properties;
      if (pin) for (const cb of pinCbs) cb(pin);
    } else if (hit.layer.id === 'sn-cities') {
      map.flyTo({ center: [lng, lat], zoom: bp.city + 1.2, pitch: 50, duration: dur, essential: true });
    } else {
      map.flyTo({ center: [lng, lat], zoom: (bp.country + bp.city) / 2, pitch: 20, duration: dur, essential: true });
    }
  });
  const hoverLayers = CLICK_LAYERS;
  for (const l of hoverLayers) {
    map.on('mouseenter', l, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', l, () => (map.getCanvas().style.cursor = ''));
  }

  // ---- lines (journey route) -----------------------------------------------------------
  function lineFeature(coords: readonly [number, number][]): Feature<LineString> {
    return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords.map((c) => [...c]) } };
  }
  function progressGradient(color: string, p: number): ExpressionSpecification {
    const q = Math.min(1, Math.max(0, p));
    if (q >= 1) return ['interpolate', ['linear'], ['line-progress'], 0, color, 1, color];
    if (q <= 0) return ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0)'];
    return ['step', ['line-progress'], color, q, 'rgba(0,0,0,0)'];
  }
  function addLineLayers(id: string, coords: readonly [number, number][], style: LineStyle, progress: number, opacity: number) {
    const src = `sn-line-${id}`;
    if (!map.getSource(src)) map.addSource(src, { type: 'geojson', data: lineFeature(coords), lineMetrics: true });
    const before = map.getLayer('sn-home') ? 'sn-home' : undefined;
    const color = style.color ?? GINGER;
    const width = style.width ?? 3.5;
    if (style.outline !== false && !map.getLayer(`${src}-casing`)) {
      map.addLayer(
        {
          id: `${src}-casing`,
          type: 'line',
          source: src,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-width': width + 2.5, 'line-gradient': progressGradient(INK, progress), 'line-opacity': opacity },
        },
        before,
      );
    }
    if (!map.getLayer(src)) {
      map.addLayer(
        {
          id: src,
          type: 'line',
          source: src,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-width': width,
            'line-gradient': progressGradient(color, progress),
            'line-opacity': opacity,
            ...(style.dash ? { 'line-dasharray': style.dash } : {}),
          },
        },
        before,
      );
    }
  }

  const api: SuiteMap = {
    map,
    maplibre: lib,
    breakpoints: bp,
    home,
    chapter: () => chapter,
    framing,
    setChapter(c, o) {
      stopSpin();
      const f = framing(c);
      const camera = { center: f.center, zoom: f.zoom, pitch: f.pitch, bearing: f.bearing };
      if (reduced || o?.animate === false) map.jumpTo(camera);
      else map.flyTo({ ...camera, duration: 2200, curve: 1.3, essential: true });
      if (c === 'world') scheduleSpin();
    },
    setLighting(mode) {
      lightingMode = mode;
      look = computeLook();
      if (styleReady) applyLook();
    },
    look: () => look,
    async setData(d) {
      data = { ...data, ...d };
      agg = aggregate(data.stays, data.wishes ?? [], data.home ?? home, data.places ?? []);
      if (!overlays || !overlaysReady) return;
      await ensurePinImages(map, agg);
      if (destroyed) return;
      for (const [key, id] of Object.entries(SOURCES)) setSourceData(id, (agg as unknown as Record<string, unknown>)[key]);
      if (selected && !agg.pins.features.some((f) => f.properties.hotelId === selected)) selected = null;
      renderHtmlMarkers();
      emitView();
    },
    setArcsVisible(v) {
      arcsVisible = v;
      for (const id of ['sn-arcs', 'sn-arcs-casing']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
    },
    setIdleSpin(v) {
      spinEnabled = v;
      if (v) scheduleSpin();
      else stopSpin();
    },
    select(hotelId) {
      selected = hotelId;
      renderHtmlMarkers();
    },
    flyToHotel(hotelId, o) {
      const f = agg.pins.features.find((x) => x.properties.hotelId === hotelId);
      if (!f) return;
      stopSpin();
      const zoom = Math.max(o?.zoom ?? bp.city + 5, map.getZoom());
      const camera = { center: f.geometry.coordinates as [number, number], zoom, pitch: 58, bearing: map.getBearing() };
      if (reduced) map.jumpTo(camera);
      else map.flyTo({ ...camera, duration: 2600, essential: true });
    },
    onChapterChange: (cb) => sub(chapterCbs, cb),
    onView: (cb) => sub(viewCbs, cb),
    onPinClick: (cb) => sub(pinCbs, cb),
    onLookChange: (cb) => sub(lookCbs, cb),
    onFallbackChange: (cb) => sub(fallbackCbs, cb),
    isFallback: () => fallback,
    hasTiles: () => tilesLoaded,
    resetNorth() {
      map.easeTo({ bearing: 0, pitch: chapter === 'city' ? map.getPitch() : 0, duration: reduced ? 0 : 600 });
    },
    addLine(id, coords, style = {}) {
      const entry = { coords, style, progress: 1, opacity: style.opacity ?? 1 };
      lines.set(id, entry);
      const src = `sn-line-${id}`;
      if (styleReady) addLineLayers(id, coords, style, 1, entry.opacity);
      const setGradient = () => {
        if (!map.getLayer(src)) return;
        map.setPaintProperty(src, 'line-gradient', progressGradient(style.color ?? GINGER, entry.progress));
        if (map.getLayer(`${src}-casing`)) map.setPaintProperty(`${src}-casing`, 'line-gradient', progressGradient(INK, entry.progress));
      };
      return {
        id,
        setCoordinates(c) {
          entry.coords = c;
          setSourceData(src, lineFeature(c));
        },
        setProgress(p) {
          entry.progress = p;
          setGradient();
        },
        setOpacity(o) {
          entry.opacity = o;
          for (const l of [src, `${src}-casing`]) if (map.getLayer(l)) map.setPaintProperty(l, 'line-opacity', o);
        },
        remove() {
          lines.delete(id);
          for (const l of [src, `${src}-casing`]) if (map.getLayer(l)) map.removeLayer(l);
          if (map.getSource(src)) map.removeSource(src);
        },
      };
    },
    addMarker(element, lngLat, o) {
      const marker = new lib.Marker({ element, anchor: o?.anchor ?? 'center', rotationAlignment: 'map', pitchAlignment: 'map' })
        .setLngLat(lngLat)
        .addTo(map);
      return {
        element,
        setLngLat: (ll) => void marker.setLngLat(ll),
        setRotation: (deg) => void marker.setRotation(deg),
        remove: () => void marker.remove(),
      };
    },
    project: (ll) => {
      const p = map.project(ll);
      return { x: p.x, y: p.y };
    },
    unproject: (pt) => {
      const ll = map.unproject([pt.x, pt.y]);
      return { lng: ll.lng, lat: ll.lat };
    },
    destroy() {
      destroyed = true;
      window.clearInterval(lightTimer);
      window.clearTimeout(viewTimer);
      window.clearTimeout(settleTimer);
      window.clearTimeout(spinTimer);
      window.removeEventListener('online', onOnline);
      canvasEl.removeEventListener('pointerdown', onPointer);
      canvasEl.removeEventListener('wheel', onPointer);
      canvasEl.removeEventListener('keydown', onPointer);
      for (const m of htmlMarkers) m.remove();
      chapterCbs.clear();
      viewCbs.clear();
      pinCbs.clear();
      lookCbs.clear();
      fallbackCbs.clear();
      map.remove();
    },
  };
  return api;
}
