/*
 * Suite Nothings icon set — original ink-outline icons on a 24 px grid.
 * Rounded caps and joins, 1.8 px stroke in currentColor, 2 px safe margin.
 * Self-contained: React types only. Decorative by default (aria-hidden); pass
 * `title` to make an icon an accessible image.
 */
import type { ReactElement, ReactNode } from 'react';

export type IconProps = {
  size?: number;
  title?: string;
  className?: string;
  /** Override the house stroke weight (1.8 at 24 px). */
  strokeWidth?: number;
};

export type IconComponent = (props: IconProps) => ReactElement;

function Svg({
  size = 24,
  title,
  className,
  strokeWidth = 1.8,
  children,
}: IconProps & { children: ReactNode }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* Navigation */

export function IconStays(p: IconProps) {
  return (
    <Svg {...p}>
      <g transform="rotate(-20 12 13)">
        <path d="M9.1 9.1a3.6 3.6 0 1 1 5.8 0" />
        <rect x="7.5" y="8.5" width="9" height="13.5" rx="4.5" />
        <circle cx="12" cy="11.6" r="1" />
        <path d="M10 16.8h4" />
      </g>
    </Svg>
  );
}

export function IconMap(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8z" />
      <path d="M9 4.5v12.7M15 6.8v12.7" />
    </Svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconJourney(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 19.5c3.5-.4 3.2-4.7 6.8-5.5 2.6-.6 5.2.6 6.4-2.4" strokeDasharray="2.2 2.6" />
      <circle cx="4.5" cy="19.5" r="1.5" />
      <path d="M18.5 2.8a3 3 0 0 1 3 3c0 2.2-3 4.9-3 4.9s-3-2.7-3-4.9a3 3 0 0 1 3-3z" />
    </Svg>
  );
}

export function IconUs(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.5-3.4 2.6-5.3 5.5-5.3s5 1.9 5.5 5.3" />
      <circle cx="16.5" cy="9.2" r="2.6" />
      <path d="M16.2 14.3c2.5 0 4 1.6 4.4 4.7" />
    </Svg>
  );
}

/* Actions and controls */

export function IconSearch(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m19.5 19.5-4.2-4.2" />
    </Svg>
  );
}

export function IconFilter(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7.5h8.5M17.5 7.5H20M4 16.5h2.5M11.5 16.5H20" />
      <circle cx="15" cy="7.5" r="2.3" />
      <circle cx="9" cy="16.5" r="2.3" />
    </Svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </Svg>
  );
}

export function IconBack(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </Svg>
  );
}

/** Points right; rotate with CSS for down (accordions) or left. */
export function IconChevron(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9.5 6 6 6-6 6" />
    </Svg>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </Svg>
  );
}

export function IconCalendar(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Svg>
  );
}

export function IconClock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function IconPin(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </Svg>
  );
}

export function IconCamera(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 9A2 2 0 0 1 5.5 7h2.2l1.6-2.3h5.4L16.3 7h2.2a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.3" />
    </Svg>
  );
}

export function IconStar(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.5-5-2.7-5 2.7.9-5.5-4-4 5.6-.8z" />
    </Svg>
  );
}

export function IconHeart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
    </Svg>
  );
}

export function IconShare(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 14.5v-11M8 7.2l4-3.7 4 3.7" />
      <path d="M8.5 10.5H7.3a1.8 1.8 0 0 0-1.8 1.8v6.4a1.8 1.8 0 0 0 1.8 1.8h9.4a1.8 1.8 0 0 0 1.8-1.8v-6.4a1.8 1.8 0 0 0-1.8-1.8h-1.2" />
    </Svg>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M10.4 3.5h3.2l.5 2.4 1.6.9 2.3-.8 1.6 2.8-1.8 1.6v1.2l1.8 1.6-1.6 2.8-2.3-.8-1.6.9-.5 2.4h-3.2l-.5-2.4-1.6-.9-2.3.8-1.6-2.8 1.8-1.6v-1.2L4.4 8.8 6 6l2.3.8 1.6-.9z" />
    </Svg>
  );
}

export function IconLocate(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </Svg>
  );
}

export function IconList(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" strokeWidth={2.6} />
    </Svg>
  );
}

export function IconLayers(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z" />
      <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
    </Svg>
  );
}

export function IconPlay(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.2-6.8a.8.8 0 0 0 0-1.4L9.2 4.5a.8.8 0 0 0-1.2.7z" />
    </Svg>
  );
}

export function IconPause(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" />
      <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" />
    </Svg>
  );
}

export function IconCompass(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </Svg>
  );
}

/** Home base: a house with a heart. */
export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
      <path d="M12 17.3s-3-1.8-3-3.8a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2-3 3.8-3 3.8z" />
    </Svg>
  );
}

export function IconKey(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="15.5" r="4" />
      <path d="m10.9 12.6 8.6-8.6M16.5 7l2.5 2.5M14 9.5l2 2" />
    </Svg>
  );
}

export function IconSync(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12a7.5 7.5 0 0 1 13.2-4.9" />
      <path d="M18 3.5v3.8h-3.8M6 20.5v-3.8h3.8" />
    </Svg>
  );
}

export function IconOffline(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 7.6a6 6 0 0 1 8.8 3 4 4 0 0 1 2 6.8M16 18.5H7a4.6 4.6 0 0 1-1.4-9" />
      <path d="m4 4 16 16" />
    </Svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function IconEdit(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </Svg>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12" />
      <path d="M10 11v5.5M14 11v5.5" />
    </Svg>
  );
}

export function IconUndo(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 5 4.5 9.5 9 14" />
      <path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3" />
    </Svg>
  );
}

export function IconSound(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </Svg>
  );
}

export function IconMute(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </Svg>
  );
}

export function IconGlobe(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.3 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.3-3.4-8.5s1.1-6.1 3.4-8.5z" />
    </Svg>
  );
}

export function IconCar(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5.5 16.5H4.3a.8.8 0 0 1-.8-.8v-2.9a2 2 0 0 1 1.3-1.9l2.2-.8 1.9-3.2A2 2 0 0 1 10.6 6h4.1a2 2 0 0 1 1.6.8l2.5 3.4 1.2.4a2 2 0 0 1 1.5 1.9v3.2a.8.8 0 0 1-.8.8h-1.2M9.5 16.5h5" />
      <path d="M7 10.5h13" />
      <circle cx="7.5" cy="16.5" r="2" />
      <circle cx="16.5" cy="16.5" r="2" />
    </Svg>
  );
}

export function IconPlane(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20.6 3.4c.8.8.3 2.2-.7 3.2l-3.4 3.4 2.2 8.8-1.5 1.5-3.9-7-3.3 3.3.4 2.8-1.2 1.2-1.8-3.5-3.5-1.8 1.2-1.2 2.8.4 3.3-3.3-7-3.9L6 5.8l8.8 2.2 3.4-3.4c1-1 2.4-1.5 3.2-.7z" />
    </Svg>
  );
}

export function IconLink(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </Svg>
  );
}

export function IconExternal(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13.5 4.5h6v6M19.5 4.5l-8 8" />
      <path d="M17.5 14v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 6 7h4.5" />
    </Svg>
  );
}

export function IconQr(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2" />
      <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 20.5h.5M20.5 14v.5" />
    </Svg>
  );
}

export function IconDownload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />
    </Svg>
  );
}

export function IconUpload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 19.5h15" />
    </Svg>
  );
}

export function IconSparkle(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M11 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5z" />
      <path d="M18.5 15.5v4M16.5 17.5h4" />
    </Svg>
  );
}

/* Extras used across the app */

export function IconBed(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 18.5V6M3.5 15h17v3.5M20.5 15v-3a2.5 2.5 0 0 0-2.5-2.5h-7V15" />
      <circle cx="7.3" cy="11.5" r="1.8" />
    </Svg>
  );
}

export function IconMail(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </Svg>
  );
}

export function IconDice(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" strokeWidth={2.8} />
    </Svg>
  );
}

export function IconSun(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </Svg>
  );
}

export function IconMoon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />
    </Svg>
  );
}

export function IconInfo(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </Svg>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10.3 4.6 3.2 17a2 2 0 0 0 1.7 3h14.2a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 16.8h.01" />
    </Svg>
  );
}

export function IconPhone(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 4.5h3.2l1.6 4-2 1.3a10 10 0 0 0 6.4 6.4l1.3-2 4 1.6V19a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 3.5 6.1 1.5 1.5 0 0 1 5 4.5z" />
    </Svg>
  );
}

export function IconMore(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={2.8} />
    </Svg>
  );
}

export function IconMinus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconBookmark(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.5 4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5V21L12 17l-5.5 4z" />
    </Svg>
  );
}

/** Custom-place mark: a fork and spoon. */
export function IconRestaurant(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 3v8a1.6 1.6 0 0 0 3.2 0V3M7 3v4.5M9.6 3v4.5M8.6 11v10" />
      <path d="M16 3c-1.4 0-2.5 2-2.5 5s1.1 5 2.5 5v8" />
    </Svg>
  );
}

/** Custom-place mark: an umbrella on the beach. */
export function IconBeach(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8z" />
      <path d="M12 3v2.2M12 11v8a2 2 0 0 1-2 2" />
    </Svg>
  );
}

/** Custom-place mark: a dome and crescent. */
export function IconMosque(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 20V13a8 8 0 0 1 16 0v7" />
      <path d="M4 20h16M12 13V9" />
      <path d="M13.8 5.3a2.4 2.4 0 1 1-2.3-3.1 3 3 0 1 0 2.3 3.1z" />
    </Svg>
  );
}

/** Custom-place mark: a dumbbell. */
export function IconGym(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 10v4M6 8v8M18 8v8M21 10v4M6.5 12h11" strokeWidth={2.2} />
    </Svg>
  );
}

/** Custom-place mark: a tree. */
export function IconPark(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3 7 11h3l-4 6h5v4h2v-4h5l-4-6h3z" />
    </Svg>
  );
}

/** Custom-place mark: a coffee cup. */
export function IconCoffee(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 8h11v6a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14z" />
      <path d="M16 9.5h1.5a2.3 2.3 0 0 1 0 4.6H16M8 4.5c-.6.8-.6 1.3 0 2M11.5 4.5c-.6.8-.6 1.3 0 2" />
    </Svg>
  );
}

/** Custom-place mark: a simple dot pin for "other". */
export function IconOther(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Name → component, for pickers, docs and tests. */
export const icons = {
  IconStays,
  IconMap,
  IconPlus,
  IconJourney,
  IconUs,
  IconSearch,
  IconFilter,
  IconClose,
  IconBack,
  IconChevron,
  IconArrowRight,
  IconCalendar,
  IconClock,
  IconPin,
  IconCamera,
  IconStar,
  IconHeart,
  IconShare,
  IconSettings,
  IconLocate,
  IconList,
  IconLayers,
  IconPlay,
  IconPause,
  IconCompass,
  IconHome,
  IconKey,
  IconSync,
  IconOffline,
  IconCheck,
  IconEdit,
  IconTrash,
  IconUndo,
  IconSound,
  IconMute,
  IconGlobe,
  IconCar,
  IconPlane,
  IconLink,
  IconExternal,
  IconQr,
  IconDownload,
  IconUpload,
  IconSparkle,
  IconBed,
  IconMail,
  IconDice,
  IconSun,
  IconMoon,
  IconInfo,
  IconAlert,
  IconPhone,
  IconMore,
  IconMinus,
  IconBookmark,
  IconRestaurant,
  IconBeach,
  IconMosque,
  IconGym,
  IconPark,
  IconCoffee,
  IconOther,
} satisfies Record<string, IconComponent>;

export type IconName = keyof typeof icons;
