/**
 * Tiny hash router. Every route is registered here (feature agents never edit this file):
 * each lazy-loads a component from its feature folder. URLs look like `#/map?city=Dubai`.
 */
import { createContext, createElement, lazy, useContext, useSyncExternalStore, type ComponentType, type LazyExoticComponent, type MouseEvent, type ReactNode } from 'react';

export type RouteName =
  | 'stays'
  | 'stay'
  | 'add'
  | 'map'
  | 'journey'
  | 'us'
  | 'letters'
  | 'letter'
  | 'settings'
  | 'join'
  | 'welcome'
  | 'wishlist'
  | 'gallery';

export interface RouteDef {
  name: RouteName;
  pattern: string;
  /** 'sheet' routes render over the last screen route (e.g. #/add). */
  kind: 'screen' | 'sheet' | 'fullscreen';
  Component: LazyExoticComponent<ComponentType>;
  /** Tab to highlight in the tab bar / header. */
  tab?: 'stays' | 'map' | 'journey' | 'us';
}

export const ROUTES: readonly RouteDef[] = [
  { name: 'stays', pattern: '/', kind: 'screen', tab: 'stays', Component: lazy(() => import('@/features/stays/StaysScreen')) },
  { name: 'stay', pattern: '/stay/:visitId', kind: 'screen', tab: 'stays', Component: lazy(() => import('@/features/stay-detail/StayDetailScreen')) },
  { name: 'add', pattern: '/add', kind: 'sheet', Component: lazy(() => import('@/features/add-stay/AddStaySheet')) },
  { name: 'map', pattern: '/map', kind: 'screen', tab: 'map', Component: lazy(() => import('@/features/map/MapScreen')) },
  { name: 'journey', pattern: '/journey', kind: 'screen', tab: 'journey', Component: lazy(() => import('@/features/journey/JourneyScreen')) },
  { name: 'us', pattern: '/us', kind: 'screen', tab: 'us', Component: lazy(() => import('@/features/us/UsScreen')) },
  { name: 'letters', pattern: '/letters', kind: 'screen', tab: 'us', Component: lazy(() => import('@/features/letters/LettersScreen')) },
  { name: 'letter', pattern: '/letters/:id', kind: 'screen', tab: 'us', Component: lazy(() => import('@/features/letters/LetterScreen')) },
  { name: 'settings', pattern: '/settings', kind: 'screen', tab: 'us', Component: lazy(() => import('@/features/settings/SettingsScreen')) },
  { name: 'join', pattern: '/join', kind: 'fullscreen', Component: lazy(() => import('@/features/connection/JoinRoute')) },
  { name: 'welcome', pattern: '/welcome', kind: 'fullscreen', Component: lazy(() => import('@/features/onboarding/Onboarding')) },
  { name: 'wishlist', pattern: '/wishlist', kind: 'screen', tab: 'us', Component: lazy(() => import('@/features/wishlist/WishlistScreen')) },
  // Unlinked component gallery for visual QA (foundation-owned).
  { name: 'gallery', pattern: '/gallery', kind: 'fullscreen', Component: lazy(() => import('./Gallery')) },
];

export interface Location {
  /** Path without query, always starting with "/". */
  path: string;
  query: URLSearchParams;
  /** Raw hash without "#", e.g. "/map?city=Dubai". */
  raw: string;
}

export interface Match {
  route: RouteDef;
  params: Record<string, string>;
}

export function parseHash(hash: string): Location {
  const raw = hash.replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  const path = '/' + p.replace(/^\/+/, '').replace(/\/+$/, '');
  return { path, query: new URLSearchParams(q), raw };
}

export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function matchRoute(path: string): Match | null {
  for (const route of ROUTES) {
    const params = matchPath(route.pattern, path);
    if (params) return { route, params };
  }
  return null;
}

let cachedHash: string | null = null;
let cachedLoc: Location = parseHash('');
let lastScreen: Location = parseHash('');
function snapshot(): Location {
  const h = typeof location === 'undefined' ? '' : location.hash;
  if (h !== cachedHash) {
    cachedHash = h;
    cachedLoc = parseHash(h);
    if (matchRoute(cachedLoc.path)?.route.kind === 'screen') lastScreen = cachedLoc;
  }
  return cachedLoc;
}

/** The most recent 'screen' route location: what a sheet route (e.g. #/add) renders over. */
export function getLastScreen(): Location {
  snapshot();
  return lastScreen;
}
function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

/**
 * Pins the location for a subtree. The shell wraps the screen behind a sheet route in it, so
 * `#/stay/:id` keeps its own params while `#/add` is open over it.
 */
const LocationOverride = createContext<Location | null>(null);
export function LocationProvider({ location: loc, children }: { location: Location; children: ReactNode }) {
  return createElement(LocationOverride.Provider, { value: loc }, children);
}

/** Current hash location (reactive), or the pinned one inside a `LocationProvider`. */
export function useLocation(): Location {
  const live = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useContext(LocationOverride) ?? live;
}

/** Current route match + params + query. */
export function useRoute(): { match: Match | null; location: Location } {
  const loc = useLocation();
  return { match: matchRoute(loc.path), location: loc };
}

/** Route params of the current route, e.g. `useParams().visitId`. */
export function useParams(): Record<string, string> {
  return useRoute().match?.params ?? {};
}

/** One query param from the hash, e.g. `useQueryParam('city')`. */
export function useQueryParam(name: string): string | null {
  return useLocation().query.get(name);
}

/** Build an href for a hash route: `href('/map', { city: 'Dubai' })` → `#/map?city=Dubai`. */
export function href(path: string, query?: Record<string, string | number | null | undefined>): string {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return `#${path.startsWith('/') ? path : '/' + path}${qs ? '?' + qs : ''}`;
}

/** Navigate to a hash path (`'/map'`, `'/stay/01H…'`, or a full `'#/…'`). */
export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const target = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : '/' + to}`;
  if (opts.replace) {
    const url = `${location.pathname}${location.search}${target}`;
    history.replaceState(history.state, '', url);
    inAppDepth -= 1; // a replace is not a new history entry
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (location.hash !== target) {
    location.hash = target;
  }
}

/** Go back if we have in-app history, otherwise to `fallback`. */
export function goBack(fallback = '/'): void {
  if (inAppDepth > 0) {
    inAppDepth -= 2; // the back navigation's own hashchange adds one
    history.back();
  } else navigate(fallback, { replace: true });
}

/** Hash changes seen since load; > 0 means history.back() stays inside the app. */
let inAppDepth = 0;
if (typeof window !== 'undefined') window.addEventListener('hashchange', () => void (inAppDepth = Math.max(0, inAppDepth + 1)));

export function Link({ to, children, className, onClick, ...rest }: { to: string; children: ReactNode; className?: string; onClick?: (e: MouseEvent<HTMLAnchorElement>) => void } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <a href={to.startsWith('#') ? to : `#${to}`} className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
