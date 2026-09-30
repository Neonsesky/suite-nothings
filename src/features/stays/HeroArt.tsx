import { useId, useMemo } from 'react';
import { hashSeed, rng } from '../../components/StayArt';
import s from './HeroArt.module.css';

export type TimeOfDay = 'dawn' | 'day' | 'golden' | 'night';

/** 5–7 dawn, 8–15 day, 16–18 golden, else night. */
export function timeOfDayFor(hour: number): TimeOfDay {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  if (h >= 5 && h <= 7) return 'dawn';
  if (h >= 8 && h <= 15) return 'day';
  if (h >= 16 && h <= 18) return 'golden';
  return 'night';
}

export interface HeroArtProps {
  /** Same seed always yields the same skyline (deterministic). */
  seed: string;
  /** Defaults to `timeOfDayFor(new Date().getHours())`. */
  time?: TimeOfDay;
  className?: string;
}

const W = 1600;
const H = 900;
/** Waterline: skyline sits above this, its reflection below it. */
const WATER_Y = 610;

interface Palette {
  skyTop: string;
  skyBottom: string;
  sunFill: string;
  sunGlow: string;
  isMoon: boolean;
  waterTop: string;
  waterBottom: string;
  litColor: string;
  litOpacity: number;
  unlitOpacity: number;
  drawUnlit: boolean;
  litRatio: number;
  farOpacity: number;
  midOpacity: number;
  nearOpacity: number;
  stars: boolean;
}

const PALETTES: Record<TimeOfDay, Palette> = {
  day: {
    skyTop: '#79c2ea',
    skyBottom: '#dff0ee',
    sunFill: '#fff8e0',
    sunGlow: 'rgba(255, 255, 255, 0.55)',
    isMoon: false,
    waterTop: '#bfe3e6',
    waterBottom: '#6fb2c4',
    litColor: 'var(--color-ink)',
    litOpacity: 0.28,
    unlitOpacity: 0.16,
    drawUnlit: true,
    litRatio: 0.12,
    farOpacity: 0.22,
    midOpacity: 0.48,
    nearOpacity: 0.92,
    stars: false,
  },
  golden: {
    skyTop: 'var(--color-honey-soft)',
    skyBottom: 'var(--color-ginger-soft)',
    sunFill: 'var(--color-honey-deep)',
    sunGlow: 'rgba(255, 175, 54, 0.5)',
    isMoon: false,
    waterTop: '#ffd9ac',
    waterBottom: '#fc8f68',
    litColor: 'var(--color-honey)',
    litOpacity: 0.92,
    unlitOpacity: 0.18,
    drawUnlit: true,
    litRatio: 0.58,
    farOpacity: 0.3,
    midOpacity: 0.58,
    nearOpacity: 0.95,
    stars: false,
  },
  dawn: {
    skyTop: 'var(--color-ginger-soft)',
    skyBottom: 'var(--color-cream)',
    sunFill: 'var(--color-honey-soft)',
    sunGlow: 'rgba(255, 225, 220, 0.55)',
    isMoon: false,
    waterTop: '#ffd6d0',
    waterBottom: '#f2b8ae',
    litColor: 'var(--color-honey-soft)',
    litOpacity: 0.8,
    unlitOpacity: 0.14,
    drawUnlit: true,
    litRatio: 0.3,
    farOpacity: 0.26,
    midOpacity: 0.5,
    nearOpacity: 0.92,
    stars: false,
  },
  night: {
    skyTop: '#12122a',
    skyBottom: '#33334f',
    sunFill: '#fdf6e3',
    sunGlow: 'rgba(253, 246, 227, 0.35)',
    isMoon: true,
    waterTop: '#22223c',
    waterBottom: '#0f0f22',
    litColor: 'var(--color-honey)',
    litOpacity: 0.95,
    unlitOpacity: 0,
    drawUnlit: false,
    litRatio: 0.66,
    farOpacity: 0.3,
    midOpacity: 0.55,
    nearOpacity: 0.98,
    stars: true,
  },
};

const INK = 'var(--color-ink)';

type TowerKind = 'block' | 'stepped' | 'round' | 'needle' | 'sail';

interface TowerWindow {
  x1: number;
  x2: number;
  y: number;
  lit: boolean;
}

interface Tower {
  d: string;
  windows: TowerWindow[];
}

/** A gently chamfered trapezoid: reads as a tapered tower top rather than a flat block. */
function trapezoid(x: number, w: number, baseY: number, topY: number, taper: number): string {
  const inset = Math.min(w * taper, w * 0.45);
  return `M${x} ${baseY} L${x} ${topY + inset} L${x + inset} ${topY} L${x + w - inset} ${topY} L${x + w} ${topY + inset} L${x + w} ${baseY} Z`;
}

function steppedTower(x: number, w: number, baseY: number, h: number): string {
  const s1 = h * 0.5;
  const s2 = h * 0.3;
  const s3 = h * 0.2;
  const w2 = w * 0.66;
  const w3 = w * 0.38;
  const y1 = baseY - s1;
  const y2 = y1 - s2;
  const y3 = y2 - s3;
  const d1 = (w - w2) / 2;
  const d2 = (w - w3) / 2;
  return `M${x} ${baseY} L${x} ${y1} L${x + d1} ${y1} L${x + d1} ${y2} L${x + d2} ${y2} L${x + d2} ${y3} L${x + w - d2} ${y3} L${x + w - d2} ${y2} L${x + w - d1} ${y2} L${x + w - d1} ${y1} L${x + w} ${y1} L${x + w} ${baseY} Z`;
}

function roundedTopTower(x: number, w: number, baseY: number, h: number): string {
  const topY = baseY - h;
  const r = Math.min(w * 0.48, h * 0.3);
  return `M${x} ${baseY} L${x} ${topY + r} A${r} ${r} 0 0 1 ${x + w} ${topY + r} L${x + w} ${baseY} Z`;
}

/** A Burj-Khalifa-flavoured tiered needle: the tallest, thinnest silhouette in the scene. */
function needleTower(x: number, w: number, baseY: number, h: number) {
  const topY = baseY - h;
  const seg1 = baseY - h * 0.42;
  const seg2 = baseY - h * 0.72;
  const seg3 = topY + h * 0.1;
  const w1 = w;
  const w2 = w * 0.6;
  const w3 = w * 0.3;
  const c = x + w / 2;
  const body = `M${x} ${baseY} L${x} ${seg1} L${c - w2 / 2} ${seg1} L${c - w2 / 2} ${seg2} L${c - w3 / 2} ${seg2} L${c - w3 / 2} ${seg3} L${c + w3 / 2} ${seg3} L${c + w3 / 2} ${seg2} L${c + w2 / 2} ${seg2} L${c + w2 / 2} ${seg1} L${x + w} ${seg1} L${x + w} ${baseY} Z`;
  return { body, spire: `M${c} ${seg3} L${c} ${topY - w1 * 0.9}`, cx: c, spireBase: seg3 };
}

/** A Burj-Al-Arab-flavoured sail: a billowing curve against a near-straight spine. */
function sailTower(x: number, w: number, baseY: number, h: number): string {
  const topY = baseY - h;
  const tipX = x + w * 0.18;
  return (
    `M${x} ${baseY} L${x} ${baseY - h * 0.06} ` +
    `C ${x - w * 0.08} ${baseY - h * 0.42}, ${tipX - w * 0.12} ${topY + h * 0.22}, ${tipX} ${topY} ` +
    `C ${tipX + w * 0.18} ${topY + h * 0.18}, ${x + w * 1.05} ${baseY - h * 0.5}, ${x + w} ${baseY - h * 0.08} ` +
    `L${x + w} ${baseY} Z`
  );
}

function windowFloors(r: () => number, x: number, w: number, baseY: number, topY: number, litRatio: number): TowerWindow[] {
  const floorH = 30;
  const count = Math.max(0, Math.floor((baseY - topY - 20) / floorH));
  const out: TowerWindow[] = [];
  for (let k = 0; k < count; k++) {
    out.push({ x1: x + w * 0.18, x2: x + w * 0.82, y: baseY - 16 - k * floorH, lit: r() < litRatio });
  }
  return out;
}

interface LayerConfig {
  count: number;
  minH: number;
  maxH: number;
  minW: number;
  maxW: number;
  withWindows: boolean;
  landmark?: 'needle' | 'sail';
}

function buildLayer(seedBase: number, cfg: LayerConfig, litRatio: number) {
  const r = rng(seedBase);
  const towers: Tower[] = [];
  let needleSpire: { d: string; cx: number } | null = null;
  const landmarkIndex = Math.floor(r() * cfg.count);
  let x = -60;
  let i = 0;
  const kinds: TowerKind[] = ['block', 'block', 'stepped', 'round', 'block'];
  while (i < cfg.count && x < W + 60) {
    const w = cfg.minW + r() * (cfg.maxW - cfg.minW);
    const h = cfg.minH + r() * (cfg.maxH - cfg.minH);
    const baseY = WATER_Y;
    const isLandmark = i === landmarkIndex && !!cfg.landmark;
    let d: string;
    let windows: Tower['windows'] = [];
    if (isLandmark && cfg.landmark === 'needle') {
      const tallH = h * 1.55;
      const needle = needleTower(x, w * 1.1, baseY, tallH);
      d = needle.body;
      towers.push({ d, windows: [] });
      needleSpire = { d: needle.spire, cx: needle.cx };
      x += w * 1.1 + 26 + r() * 30;
      i++;
      continue;
    } else if (isLandmark && cfg.landmark === 'sail') {
      d = sailTower(x, w * 1.2, baseY, h * 1.25);
    } else {
      const kind = kinds[Math.floor(r() * kinds.length)];
      if (kind === 'stepped') d = steppedTower(x, w, baseY, h);
      else if (kind === 'round') d = roundedTopTower(x, w, baseY, h);
      else d = trapezoid(x, w, baseY, baseY - h, 0.08 + r() * 0.18);
    }
    if (cfg.withWindows) {
      windows = windowFloors(r, x, w, baseY, baseY - h, litRatio);
    }
    towers.push({ d, windows });
    x += w + 18 + r() * 34;
    i++;
  }
  return { towers, needleSpire };
}

interface PalmSpec {
  trunk: string;
  fronds: string[];
}

function buildPalm(r: () => number, baseX: number, baseY: number, scale: number, lean: number): PalmSpec {
  const topX = baseX + lean * scale;
  const topY = baseY - 210 * scale;
  const midX = baseX + lean * 0.45 * scale;
  const midY = baseY - 110 * scale;
  const trunk =
    `M${baseX - 9 * scale} ${baseY} ` +
    `C ${baseX - 6 * scale} ${baseY - 70 * scale}, ${midX - 4 * scale} ${midY + 20 * scale}, ${midX} ${midY} ` +
    `C ${midX + 6 * scale} ${midY - 45 * scale}, ${topX - 4 * scale} ${topY + 40 * scale}, ${topX} ${topY} ` +
    `L${topX + 6 * scale} ${topY} ` +
    `C ${topX + 2 * scale} ${topY + 42 * scale}, ${midX + 12 * scale} ${midY - 30 * scale}, ${midX + 8 * scale} ${midY + 8 * scale} ` +
    `C ${midX + 2 * scale} ${midY + 40 * scale}, ${baseX + 4 * scale} ${baseY - 60 * scale}, ${baseX + 9 * scale} ${baseY} Z`;
  const fronds: string[] = [];
  const angles = [-100, -55, -15, 20, 60, 100, 140];
  for (const a of angles) {
    const jitter = (r() - 0.5) * 18;
    const rad = ((a + jitter) * Math.PI) / 180;
    const len = (150 + r() * 55) * scale;
    const droop = 46 + r() * 30;
    const ex = topX + Math.cos(rad) * len;
    const ey = topY + Math.sin(rad) * len * 0.55 + droop * scale * 0.4;
    const cx1 = topX + Math.cos(rad) * len * 0.35;
    const cy1 = topY + Math.sin(rad) * len * 0.18 - droop * scale * 0.2;
    const cx2 = topX + Math.cos(rad) * len * 0.75;
    const cy2 = ey - droop * scale * 0.3;
    fronds.push(
      `M${topX} ${topY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${ex} ${ey} ` +
        `C ${cx2} ${cy2 + 10 * scale}, ${cx1 + 6 * scale} ${cy1 + 10 * scale}, ${topX} ${topY + 4 * scale} Z`,
    );
  }
  return { trunk, fronds };
}

export function HeroArt({ seed, time, className }: HeroArtProps) {
  const uid = useId().replace(/:/g, '');
  const t = time ?? timeOfDayFor(new Date().getHours());
  const p = PALETTES[t];

  const scene = useMemo(() => {
    const baseSeed = hashSeed(seed);

    const far = buildLayer(baseSeed ^ 0x1a2b3c, { count: 11, minH: 90, maxH: 190, minW: 46, maxW: 78, withWindows: false, landmark: 'needle' }, p.litRatio);
    const mid = buildLayer(baseSeed ^ 0x4d5e6f, { count: 9, minH: 140, maxH: 260, minW: 58, maxW: 96, withWindows: true, landmark: 'sail' }, p.litRatio);
    const near = buildLayer(baseSeed ^ 0x7a8b9c, { count: 7, minH: 190, maxH: 340, minW: 74, maxW: 130, withWindows: true }, p.litRatio);

    const rPalm = rng(baseSeed ^ 0x9f9f1);
    const palms = [
      buildPalm(rPalm, 40, H - 6, 1.05, 34),
      buildPalm(rPalm, 168, H + 30, 0.78, 18),
      buildPalm(rPalm, W - 46, H - 2, 1.1, -30),
    ];

    const rStar = rng(baseSeed ^ 0x5151);
    const stars = p.stars
      ? Array.from({ length: 14 }, () => ({
          cx: rStar() * W,
          cy: rStar() * (WATER_Y - 60) + 20,
          r: 1 + rStar() * 1.6,
          o: 0.4 + rStar() * 0.5,
        }))
      : [];

    const rSun = rng(baseSeed ^ 0x2c2c);
    const sunCx = 260 + rSun() * (W - 520);
    const sunCy = t === 'night' ? 120 + rSun() * 70 : 90 + rSun() * 60;

    return { far, mid, near, palms, stars, sunCx, sunCy };
  }, [seed, t, p.litRatio, p.stars]);

  const skyId = `hero-sky-${uid}`;
  const waterId = `hero-water-${uid}`;
  const glowId = `hero-glow-${uid}`;
  const reflMaskId = `hero-reflmask-${uid}`;
  const reflFadeId = `hero-relffade-${uid}`;
  const reflBlurId = `hero-reflblur-${uid}`;
  const grainId = `hero-grain-${uid}`;
  const skylineGroupId = `hero-skyline-${uid}`;

  const renderTower = (tower: Tower, key: string, fillOpacity: number, outline: boolean) => (
    <g key={key}>
      <path
        d={tower.d}
        fill={INK}
        fillOpacity={fillOpacity}
        stroke={outline ? INK : 'none'}
        strokeWidth={outline ? 2 : 0}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {tower.windows.map((win, wi) => {
        if (!win.lit && !p.drawUnlit) return null;
        return (
          <line
            key={wi}
            x1={win.x1}
            x2={win.x2}
            y1={win.y}
            y2={win.y}
            stroke={win.lit ? p.litColor : INK}
            strokeOpacity={win.lit ? p.litOpacity : p.unlitOpacity}
            strokeWidth={3}
            strokeDasharray="5 5"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );

  const renderPalm = (palm: PalmSpec, key: string) => (
    <g key={key}>
      {palm.fronds.map((d, i) => (
        <path key={i} d={d} fill={INK} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ))}
      <path d={palm.trunk} fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </g>
  );

  return (
    <div className={[s.root, className ?? ''].join(' ')} aria-hidden="true">
      <svg className={s.svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-time={t}>
        <defs>
          <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.skyTop} />
            <stop offset="1" stopColor={p.skyBottom} />
          </linearGradient>
          <linearGradient id={waterId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.waterTop} />
            <stop offset="1" stopColor={p.waterBottom} />
          </linearGradient>
          <radialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={p.sunGlow} />
            <stop offset="1" stopColor={p.sunGlow} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={reflFadeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={reflMaskId}>
            <rect x="0" y={WATER_Y} width={W} height={H - WATER_Y} fill={`url(#${reflFadeId})`} />
          </mask>
          <filter id={reflBlurId} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id={grainId} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0" />
          </filter>
        </defs>

        {/* Sky */}
        <rect x="0" y="0" width={W} height={H} fill={`url(#${skyId})`} />

        {/* Stars (night only) */}
        {scene.stars.map((star, i) => (
          <circle key={i} cx={star.cx} cy={star.cy} r={star.r} fill="#fdf6e3" opacity={star.o} />
        ))}

        {/* Sun / moon */}
        <circle cx={scene.sunCx} cy={scene.sunCy} r={140} fill={`url(#${glowId})`} />
        <circle cx={scene.sunCx} cy={scene.sunCy} r={p.isMoon ? 34 : 46} fill={p.sunFill} />

        {/* Skyline (far -> mid -> near), grouped so the reflection can reuse it via <use>. */}
        <g id={skylineGroupId}>
          <g opacity={p.farOpacity}>
            {scene.far.towers.map((tw, i) => renderTower(tw, `f${i}`, 1, false))}
            {scene.far.needleSpire ? (
              <path
                d={scene.far.needleSpire.d}
                stroke={INK}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </g>
          <g opacity={p.midOpacity}>{scene.mid.towers.map((tw, i) => renderTower(tw, `m${i}`, 1, false))}</g>
          <g opacity={p.nearOpacity}>{scene.near.towers.map((tw, i) => renderTower(tw, `n${i}`, 1, true))}</g>
        </g>

        {/* Water + blurred, fading reflection of the skyline */}
        <rect x="0" y={WATER_Y} width={W} height={H - WATER_Y} fill={`url(#${waterId})`} />
        <g opacity={0.34} filter={`url(#${reflBlurId})`} mask={`url(#${reflMaskId})`}>
          <use href={`#${skylineGroupId}`} transform={`translate(0, ${2 * WATER_Y}) scale(1,-1)`} />
        </g>
        <rect x="0" y={WATER_Y} width={W} height={H - WATER_Y} fill={`url(#${waterId})`} opacity={0.22} />
        {[0.22, 0.45, 0.68, 0.86].map((f, i) => (
          <line
            key={i}
            className={s.shimmer}
            x1={W * 0.06}
            x2={W * 0.94}
            y1={WATER_Y + (H - WATER_Y) * f}
            y2={WATER_Y + (H - WATER_Y) * f}
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.25}
            style={{ animationDelay: `${i * 1.3}s` }}
          />
        ))}

        {/* Foreground palms */}
        {scene.palms.map((palm, i) => renderPalm(palm, `p${i}`))}

        {/* Grain */}
        <rect x="0" y="0" width={W} height={H} filter={`url(#${grainId})`} opacity={0.06} />
      </svg>
      <div className={s.scrim} />
    </div>
  );
}

export default HeroArt;
