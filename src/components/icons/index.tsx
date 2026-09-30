/**
 * Provisional ink-outline icons (24×24, stroke = currentColor).
 * The w0-design agent replaces this file wholesale; keep every export name and the props.
 */
import type { ReactNode, SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /** px or any CSS length. Default 24. */
  size?: number | string;
  /** Accessible name. Without it the icon is decorative (aria-hidden). */
  title?: string;
}

function make(name: string, body: ReactNode) {
  const Icon = ({ size = 24, title, ...rest }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  );
  Icon.displayName = name;
  return Icon;
}

export const IconStays = make('IconStays', <><path d="M3 20V9l9-5 9 5v11" /><path d="M9 20v-6h6v6" /><path d="M3 20h18" /></>);
export const IconMap = make('IconMap', <><path d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></>);
export const IconPlus = make('IconPlus', <path d="M12 5v14M5 12h14" />);
export const IconJourney = make('IconJourney', <><circle cx="5.5" cy="18" r="2" /><circle cx="18.5" cy="6" r="2" /><path d="M7.5 18h6a3.5 3.5 0 0 0 0-7h-3a3.5 3.5 0 0 1 0-7h6" /></>);
export const IconUs = make('IconUs', <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />);
export const IconSearch = make('IconSearch', <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>);
export const IconFilter = make('IconFilter', <><path d="M4 6h16M7 12h10M10 18h4" /></>);
export const IconClose = make('IconClose', <path d="M6 6l12 12M18 6 6 18" />);
export const IconBack = make('IconBack', <path d="M15 5l-7 7 7 7" />);
export const IconChevron = make('IconChevron', <path d="M9 5l7 7-7 7" />);
export const IconCalendar = make('IconCalendar', <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>);
export const IconClock = make('IconClock', <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const IconPin = make('IconPin', <><path d="M12 21s-6.5-6.1-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.3" /></>);
export const IconCamera = make('IconCamera', <><path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z" /><circle cx="12" cy="13" r="3.5" /></>);
export const IconStar = make('IconStar', <path d="m12 3.8 2.5 5.2 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8z" />);
export const IconHeart = make('IconHeart', <path d="M12 19.5S4 14.8 4 9.3A4 4 0 0 1 12 7a4 4 0 0 1 8 2.3c0 5.5-8 10.2-8 10.2z" />);
export const IconShare = make('IconShare', <><path d="M12 4v11M8 8l4-4 4 4" /><path d="M5 12v7h14v-7" /></>);
export const IconSettings = make('IconSettings', <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>);
export const IconLocate = make('IconLocate', <><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></>);
export const IconList = make('IconList', <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></>);
export const IconLayers = make('IconLayers', <><path d="m12 4 8.5 4.5L12 13 3.5 8.5z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" /></>);
export const IconPlay = make('IconPlay', <path d="M7 4.5v15l12-7.5z" />);
export const IconPause = make('IconPause', <path d="M8 5v14M16 5v14" />);
export const IconCompass = make('IconCompass', <><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>);
export const IconHome = make('IconHome', <><path d="M4 11 12 4l8 7v9H4z" /><path d="M12 17.2s-2.6-1.5-2.6-3.3a1.4 1.4 0 0 1 2.6-.7 1.4 1.4 0 0 1 2.6.7c0 1.8-2.6 3.3-2.6 3.3z" /></>);
export const IconKey = make('IconKey', <><path d="M9.5 3.5c3 0 5 2.4 5 5.7 0 3.9-2.4 7.3-5 7.3s-5-3.4-5-7.3c0-3.3 2-5.7 5-5.7z" /><circle cx="9.5" cy="7" r="1.2" /><path d="M13.6 13.5 20 20M17 17l1.8-1.8" /></>);
export const IconSync = make('IconSync', <><path d="M19.5 9A7.5 7.5 0 0 0 6 6.8L4.5 8.5M4.5 15A7.5 7.5 0 0 0 18 17.2l1.5-1.7" /><path d="M4.5 4v4.5H9M19.5 20v-4.5H15" /></>);
export const IconOffline = make('IconOffline', <><path d="M3 3l18 18" /><path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.4M19 13a10 10 0 0 0-3.5-2.2M2 9.5a14.5 14.5 0 0 1 4.2-2.7M22 9.5A14.5 14.5 0 0 0 11 5.6" /><path d="M12 20h.01" /></>);
export const IconCheck = make('IconCheck', <path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconEdit = make('IconEdit', <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>);
export const IconTrash = make('IconTrash', <><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></>);
export const IconUndo = make('IconUndo', <><path d="M9 7 4.5 11.5 9 16" /><path d="M4.5 11.5H15a4.5 4.5 0 0 1 0 9h-3" /></>);
export const IconSound = make('IconSound', <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>);
export const IconMute = make('IconMute', <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></>);
export const IconGlobe = make('IconGlobe', <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.3 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.3-3.5-8.5s1-6 3.5-8.5z" /></>);
export const IconCar = make('IconCar', <><path d="M4 16.5v-4l2-5h12l2 5v4z" /><path d="M4 12.5h16" /><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /></>);
export const IconPlane = make('IconPlane', <path d="M21 12.5 13.5 11 10 3.5H8L9.5 11 5 11.8 3 9.5H2l1 3.5-1 3.5h1l2-2.3 4.5.8L8 22.5h2L13.5 15z" />);
export const IconLink = make('IconLink', <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>);
export const IconQr = make('IconQr', <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h.01M18 14h2" /></>);
export const IconDownload = make('IconDownload', <><path d="M12 4v11M8 11l4 4 4-4" /><path d="M5 19h14" /></>);
export const IconUpload = make('IconUpload', <><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 19h14" /></>);
export const IconSparkle = make('IconSparkle', <><path d="M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5z" /><path d="M18.5 16.5c.2 1.4.8 2 2 2.2-1.2.2-1.8.8-2 2.2-.2-1.4-.8-2-2-2.2 1.2-.2 1.8-.8 2-2.2z" /></>);
