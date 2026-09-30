import { useId } from 'react';
import s from './StayArt.module.css';

export type StayArtMotif = 'window' | 'pool' | 'skyline';

export interface StayArtProps {
  /** Seed: the same hotel_id always yields the same scene. */
  seed: string;
  /** Force a motif; otherwise chosen from the seed. */
  motif?: StayArtMotif;
  /** Accessible label; decorative when absent. */
  label?: string;
  className?: string;
  /** Rounded corners handled by the parent by default. */
  rounded?: boolean;
}

/** FNV-1a 32-bit. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG from a seed. */
export function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  { sky: 'var(--color-honey-soft)', sun: 'var(--color-honey)', ground: 'var(--color-cream)', accent: 'var(--color-ginger)' },
  { sky: 'var(--color-cream)', sun: 'var(--color-ginger)', ground: 'var(--color-honey-soft)', accent: 'var(--color-honey)' },
  { sky: 'var(--color-ginger-soft)', sun: 'var(--color-honey)', ground: 'var(--color-cream)', accent: 'var(--color-ginger)' },
  { sky: 'var(--color-honey)', sun: 'var(--color-paper)', ground: 'var(--color-ginger-soft)', accent: 'var(--color-ginger)' },
] as const;

const MOTIFS: StayArtMotif[] = ['window', 'pool', 'skyline'];

/**
 * Deterministic, on-brand illustrated scene used wherever a photo is missing.
 * Honey/cream/ginger gradients, one motif (window, pool or skyline), ink-outline accents.
 * Scales to any box (uses `preserveAspectRatio="xMidYMid slice"`).
 */
export function StayArt({ seed, motif, label, className, rounded }: StayArtProps) {
  const uid = useId().replace(/:/g, '');
  const h = hashSeed(seed);
  const r = rng(h);
  const h2 = hashSeed(`${seed}|motif`);
  const p = PALETTES[h % PALETTES.length];
  const m = motif ?? MOTIFS[h2 % MOTIFS.length];
  const sunX = 60 + r() * 280;
  const sunY = 50 + r() * 50;
  const gid = `sa-sky-${uid}`;
  const ink = 'var(--color-ink)';
  const paper = 'var(--color-paper)';

  let scene: React.ReactNode;
  if (m === 'skyline') {
    const towers: React.ReactNode[] = [];
    let x = -10;
    let i = 0;
    while (x < 410) {
      const w = 26 + r() * 40;
      const top = 110 + r() * 110;
      const spire = r() > 0.75;
      towers.push(
        <g key={i++}>
          <rect x={x} y={top} width={w} height={300 - top} fill={i % 3 === 0 ? p.accent : paper} stroke={ink} strokeWidth={2.5} />
          {spire ? <path d={`M${x + w / 2} ${top - 34}L${x + w / 2} ${top}`} stroke={ink} strokeWidth={2.5} /> : null}
          {Array.from({ length: Math.floor((300 - top) / 22) }, (_, k) => (
            <line key={k} x1={x + 6} x2={x + w - 6} y1={top + 14 + k * 22} y2={top + 14 + k * 22} stroke={ink} strokeWidth={1.2} opacity={0.35} />
          ))}
        </g>,
      );
      x += w + 4 + r() * 10;
    }
    scene = (
      <>
        <circle cx={sunX} cy={sunY} r={34} fill={p.sun} stroke={ink} strokeWidth={2.5} />
        {towers}
        <rect x={-5} y={262} width={410} height={50} fill={p.ground} stroke={ink} strokeWidth={2.5} />
      </>
    );
  } else if (m === 'pool') {
    const waves = Array.from({ length: 4 }, (_, k) => {
      const y = 214 + k * 18;
      const off = r() * 40;
      return (
        <path
          key={k}
          d={`M${40 + off} ${y} q 20 -8 40 0 t 40 0 t 40 0 t 40 0 t 40 0`}
          fill="none"
          stroke={paper}
          strokeWidth={3}
          strokeLinecap="round"
        />
      );
    });
    const palmX = 300 + r() * 60;
    scene = (
      <>
        <circle cx={sunX} cy={sunY} r={30} fill={p.sun} stroke={ink} strokeWidth={2.5} />
        <rect x={-5} y={170} width={410} height={140} fill={p.ground} stroke={ink} strokeWidth={2.5} />
        <rect x={24} y={192} width={300} height={96} rx={18} fill="var(--color-focus)" opacity={0.28} stroke={ink} strokeWidth={2.5} />
        {waves}
        <path d={`M${palmX} 290 C ${palmX - 6} 240, ${palmX + 4} 200, ${palmX + 14} 150`} fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" />
        {[-60, -20, 20, 60, 110].map((a) => (
          <path
            key={a}
            d={`M${palmX + 14} 150 q ${Math.cos((a * Math.PI) / 180) * 40} ${-20 + Math.sin((a * Math.PI) / 180) * 30} ${Math.cos((a * Math.PI) / 180) * 70} ${Math.sin((a * Math.PI) / 180) * 40}`}
            fill="none"
            stroke={ink}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}
        <rect x={60} y={150} width={70} height={14} rx={7} fill={p.accent} stroke={ink} strokeWidth={2.5} />
      </>
    );
  } else {
    // window: a room with a framed window onto the sky, curtains, bed edge.
    const curtain = p.accent;
    scene = (
      <>
        <rect x={-5} y={-5} width={410} height={310} fill={p.ground} />
        <rect x={110} y={40} width={180} height={160} fill={`url(#${gid})`} stroke={ink} strokeWidth={3} />
        <circle cx={150 + r() * 100} cy={90 + r() * 30} r={22} fill={p.sun} stroke={ink} strokeWidth={2.5} />
        <line x1={200} y1={40} x2={200} y2={200} stroke={ink} strokeWidth={3} />
        <line x1={110} y1={120} x2={290} y2={120} stroke={ink} strokeWidth={3} />
        <path d="M96 30 C 120 90, 100 160, 118 214 L 80 214 L 80 30 Z" fill={curtain} stroke={ink} strokeWidth={2.5} />
        <path d="M304 30 C 280 90, 300 160, 282 214 L 320 214 L 320 30 Z" fill={curtain} stroke={ink} strokeWidth={2.5} />
        <line x1={70} y1={30} x2={330} y2={30} stroke={ink} strokeWidth={4} strokeLinecap="round" />
        <rect x={40} y={236} width={320} height={80} rx={16} fill={paper} stroke={ink} strokeWidth={3} />
        <rect x={70} y={220} width={100} height={34} rx={14} fill={p.sky} stroke={ink} strokeWidth={2.5} />
        <rect x={230} y={220} width={100} height={34} rx={14} fill={p.sky} stroke={ink} strokeWidth={2.5} />
      </>
    );
  }

  return (
    <svg
      className={[s.art, rounded ? s.rounded : '', className ?? ''].join(' ')}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-motif={m}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky} />
          <stop offset="1" stopColor={p.sun} />
        </linearGradient>
      </defs>
      <rect x={-5} y={-5} width={410} height={310} fill={`url(#${gid})`} />
      {scene}
    </svg>
  );
}
