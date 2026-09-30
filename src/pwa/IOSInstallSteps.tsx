/**
 * The illustrated "Add to Home Screen" steps shown to iOS Safari visitors (design/copy.md
 * §1 `onboarding.install.*`). Used by both the onboarding screen and IOSInstallSheet.
 *
 * Drawn, not photographed: flat ink-outline (2px `--color-ink`) shapes with honey/cream fills,
 * matching the rest of the brand (see `design/tools/mark.mjs`, `KeyTagMark.tsx`). The SVGs are
 * decorative only — the real content is the `<ol>` text underneath them.
 */
import { KeyTagMark } from '@/components/brand/KeyTagMark';
import s from './IOSInstallSteps.module.css';

const INK = 'var(--color-ink)';
const HONEY = 'var(--color-honey)';
const CREAM = 'var(--color-cream)';
const PAPER = 'var(--color-paper)';

const STROKE = 2;

/** Step 1: Safari's bottom toolbar, with the share (square + up-arrow) icon ringed in honey. */
function ShareToolbarArt({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="4" y="34" width="56" height="24" rx="8" fill={PAPER} stroke={INK} strokeWidth={STROKE} />
      <circle cx="18" cy="46" r="7" fill="none" stroke={INK} strokeWidth="1.25" opacity="0.35" />
      <circle cx="46" cy="46" r="7" fill="none" stroke={INK} strokeWidth="1.25" opacity="0.35" />
      <circle cx="32" cy="46" r="13" fill={HONEY} stroke={INK} strokeWidth={STROKE} />
      <rect x="26" y="45" width="12" height="9" rx="2.5" fill="none" stroke={INK} strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M32 37v9M27.5 41.5 32 37l4.5 4.5" fill="none" stroke={INK} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Step 2: a share-sheet row with the "Add to Home Screen" plus-in-square glyph. */
function AddRowArt({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="4" y="16" width="56" height="32" rx="10" fill={PAPER} stroke={INK} strokeWidth={STROKE} />
      <rect x="14" y="24" width="16" height="16" rx="4" fill={CREAM} stroke={INK} strokeWidth={STROKE} />
      <path d="M22 28v8M18 32h8" stroke={INK} strokeWidth="1.75" strokeLinecap="round" />
      <path d="M40 27h14M40 32h14M40 37h9" stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

/** Step 3: a home-screen grid with our honey key-tag tile ringed as the new arrival. */
function HomeScreenArt({ size }: { size: number }) {
  const tiles = [
    { x: 6, y: 6 },
    { x: 24, y: 6 },
    { x: 6, y: 24 },
  ];
  return (
    <span className={s.homeArt} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect x="2" y="2" width="60" height="60" rx="12" fill={CREAM} />
        {tiles.map((t, i) => (
          <rect key={i} x={t.x} y={t.y} width="16" height="16" rx="4.5" fill={PAPER} stroke={INK} strokeWidth="1.25" opacity="0.4" />
        ))}
        <circle cx="41" cy="41" r="16" fill="none" stroke={HONEY} strokeWidth="3" />
        <rect x="32" y="32" width="18" height="18" rx="5" fill={HONEY} stroke={INK} strokeWidth={STROKE} />
      </svg>
      <span className={s.homeMark} style={{ color: PAPER }}>
        <KeyTagMark size={Math.round(size * 0.28)} variant="mono" />
      </span>
    </span>
  );
}

const STEPS = [
  { Art: ShareToolbarArt, title: 'Tap Share' },
  { Art: AddRowArt, title: 'Tap Add to Home Screen' },
  { Art: HomeScreenArt, title: 'Open Our Suites' },
] as const;

export function IOSInstallSteps({ compact = false }: { compact?: boolean }) {
  const size = compact ? 44 : 56;
  return (
    <div className={compact ? s.compact : undefined}>
      <ol className={s.list}>
        {STEPS.map((step, i) => (
          <li key={step.title} className={s.step}>
            <step.Art size={size} />
            <div className={s.text}>
              <span className={s.num}>Step {i + 1}</span>
              <span className={s.title}>{step.title}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className={s.helper}>Look for the square with an arrow, at the bottom of Safari.</p>
    </div>
  );
}

export default IOSInstallSteps;
