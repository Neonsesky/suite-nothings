/** The 2D intro: the same beats as the 3D one, drawn in ink outlines with CSS motion. */
import s from './Intro.module.css';

export type Door2DVariant = 'full' | 'short' | 'still';

export function Door2D({ variant }: { variant: Door2DVariant }) {
  return (
    <div className={s.stage2d} data-variant={variant} aria-hidden="true">
      <div className={s.frame}>
        <div className={s.room} />
        <div className={s.door}>
          <svg viewBox="0 0 230 430" width="100%" height="100%">
            <rect x="1.5" y="1.5" width="227" height="427" rx="3" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="3" />
            <rect x="30" y="35" width="170" height="165" rx="4" fill="none" stroke="var(--color-ink)" strokeWidth="1.8" />
            <rect x="30" y="245" width="170" height="150" rx="4" fill="none" stroke="var(--color-ink)" strokeWidth="1.8" />
            <rect x="84" y="25" width="62" height="30" rx="4" fill="var(--color-honey)" stroke="var(--color-ink)" strokeWidth="2.2" />
            <path d="M101 34c-3 .6-5 3-5 6.2m2.6 3.6a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 1 0 0 5.4Zm6-8.1 2.4-1.7v10m9.8-10a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 1 0 0-5.4Zm2.7 2.7c0 3.5-1.9 6.2-5.1 7.1" fill="none" stroke="var(--color-ink)" strokeWidth="1.8" strokeLinecap="round" transform="translate(4 -1)" />
            <rect x="167" y="146" width="36" height="78" rx="6" fill="var(--color-ink)" />
            <circle className={s.led} cx="185" cy="159" r="5.5" />
            <rect x="175" y="178" width="20" height="34" rx="2" fill="none" stroke="var(--color-paper)" strokeWidth="1.2" opacity="0.6" />
            <circle cx="185" cy="250" r="10" fill="var(--color-ink)" />
            <rect x="129" y="245.5" width="62" height="9" rx="4.5" fill="var(--color-ink)" />
            <g className={s.tag}>
              <circle cx="134" cy="256" r="9" fill="none" stroke="var(--color-ink)" strokeWidth="2.6" />
              <path d="M134 262c20 0 34 38 34 70s-14 48-34 48-34-16-34-48 14-70 34-70Z" fill="var(--color-honey)" stroke="var(--color-ink)" strokeWidth="2.6" strokeLinejoin="round" />
              <circle cx="134" cy="278" r="5" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="2" />
              <ellipse cx="134" cy="340" rx="21" ry="26" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="1.8" />
              <path d="M130.9 334.8c-3.3.6-5.8 3.3-5.8 6.8m3-3.9a3 3 0 1 0 0 6 3 3 0 1 0 0-6Zm6.6-2.9 2.7-1.9v11m8.5-11a3 3 0 1 0 0 6 3 3 0 1 0 0-6Zm3 3c0 3.9-2.1 6.9-5.7 7.9" fill="none" stroke="var(--color-ink)" strokeWidth="1.9" strokeLinecap="round" transform="translate(-2 0)" />
            </g>
          </svg>
        </div>
        <div className={s.card}>
          <svg viewBox="0 0 54 86" width="100%" height="100%">
            <rect x="1.5" y="1.5" width="51" height="83" rx="5" fill="var(--color-honey)" stroke="var(--color-ink)" strokeWidth="2.4" />
            <rect x="1.5" y="14" width="51" height="11" fill="var(--color-ink)" />
            <circle cx="27" cy="58" r="9" fill="none" stroke="var(--color-ink)" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </div>
  );
}
