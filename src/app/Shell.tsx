/**
 * App shell: desktop header, mobile tab bar, offline banner, toast host, demo badge, the route
 * outlet (screens, sheets over screens, fullscreen routes) and first-launch redirect.
 */
import { Suspense, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { ClockLoader } from '@/components/ClockLoader';
import { DemoBadge } from '@/components/DemoBadge';
import { EmptyState } from '@/components/EmptyState';
import { ButtonLink } from '@/components/Button';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ToastHost } from '@/components/Toast';
import { IconJourney, IconKey, IconMap, IconPlus, IconStays, IconUs } from '@/components/icons';
import { COUPLE, personName, otherPerson } from '@/config/couple';
import { onRemoteChange, useBootError, useMe, getState } from '@/data/store';
import { useReducedMotionAttribute } from '@/lib/motion';
import { toast } from '@/lib/toast';
import { PwaHost } from '@/pwa/PwaHost';
import { Intro } from '@/features/intro/Intro';
import { PillowHost } from '@/features/letters/PillowHost';
import { ErrorBoundary } from './ErrorBoundary';
import { getLastScreen, matchRoute, navigate, useRoute, type RouteDef } from './router';
import { useShortcuts } from './shortcuts';
import s from './Shell.module.css';

type Tab = NonNullable<RouteDef['tab']>;
const TABS: { tab: Tab; href: string; label: string; Icon: typeof IconStays }[] = [
  { tab: 'stays', href: '#/', label: 'Stays', Icon: IconStays },
  { tab: 'map', href: '#/map', label: 'Map', Icon: IconMap },
  { tab: 'journey', href: '#/journey', label: 'Journey', Icon: IconJourney },
  { tab: 'us', href: '#/us', label: 'Us', Icon: IconUs },
];

/** `<html data-hero-header="1">`, set by the Stays screen while its hero is at the top of the
 * page (see docs/handoff/w1-shell.md for the contract). Watched with a MutationObserver. */
function subscribeHeroAttr(cb: () => void): () => void {
  const html = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(html, { attributes: true, attributeFilter: ['data-hero-header'] });
  return () => mo.disconnect();
}
function getHeroAttr(): boolean {
  return document.documentElement.dataset.heroHeader === '1';
}

/** True once scrolled past 80% of the `[data-hero]` element's height (falls back to 700px). */
function subscribeScroll(cb: () => void): () => void {
  window.addEventListener('scroll', cb, { passive: true });
  window.addEventListener('resize', cb);
  return () => {
    window.removeEventListener('scroll', cb);
    window.removeEventListener('resize', cb);
  };
}
function getScrolledPastHero(): boolean {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const threshold = (hero?.offsetHeight || 700) * 0.8;
  return window.scrollY > threshold;
}

const HERO_FALSE = () => false;

/**
 * Drives the desktop header's transparent-over-hero state (Dayuse pattern). When the attribute
 * is absent the header is always "solid" (today's sticky behaviour).
 */
function useHeroHeader(): { overHero: boolean; solid: boolean } {
  const overHero = useSyncExternalStore(subscribeHeroAttr, getHeroAttr, HERO_FALSE);
  const scrolledPastHero = useSyncExternalStore(subscribeScroll, getScrolledPastHero, HERO_FALSE);
  return { overHero, solid: !overHero || scrolledPastHero };
}

function Header({ active }: { active?: Tab }) {
  const { overHero, solid } = useHeroHeader();
  return (
    <header className={s.header} data-over-hero={overHero || undefined} data-solid={overHero ? solid : undefined}>
      <div className={s.headerInner}>
        <a href="#/" className={s.brand} aria-label={`${COUPLE.appName}, our stays`}>
          <span className={s.mark} aria-hidden="true">
            <IconKey size={22} />
          </span>
          <span className={s.brandName}>{COUPLE.appName}</span>
        </a>
        <DemoBadge />
        <nav className={s.headerNav} aria-label="Main">
          {TABS.slice(1).map((t) => (
            <a key={t.tab} href={t.href} className={s.headerLink} aria-current={active === t.tab ? 'page' : undefined}>
              {t.label}
            </a>
          ))}
          <a href="#/add" className={s.headerAdd}>
            <IconPlus size={18} /> Add a stay
          </a>
        </nav>
      </div>
    </header>
  );
}

function TabBar({ active }: { active?: Tab }) {
  const item = (t: (typeof TABS)[number]) => (
    <a key={t.tab} href={t.href} className={s.tab} aria-current={active === t.tab ? 'page' : undefined}>
      <t.Icon size={24} />
      <span className={s.tabLabel}>{t.label}</span>
    </a>
  );
  return (
    <nav className={s.tabbar} aria-label="Main">
      {item(TABS[0])}
      {item(TABS[1])}
      <a href="#/add" className={s.plus} aria-label="Add a stay">
        <span className={s.plusDisc}>
          <IconPlus size={26} />
        </span>
      </a>
      {item(TABS[2])}
      {item(TABS[3])}
    </nav>
  );
}

function Loading() {
  return (
    <div className={s.loading}>
      <ClockLoader label="Opening the door" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="page">
      <EmptyState title="This room doesn't exist" body="The link might be old. Our stays are right this way." action={<ButtonLink href="#/">Back to our stays</ButtonLink>} />
    </div>
  );
}

function MobileTopBar() {
  return (
    <div className={s.mobileTop}>
      <DemoBadge />
    </div>
  );
}

export function Shell() {
  const { match, location } = useRoute();
  const me = useMe();
  const bootError = useBootError();
  useReducedMotionAttribute();
  useShortcuts();

  const route = match?.route;
  const background = route?.kind === 'sheet' ? matchRoute(getLastScreen().path) : null;

  // First launch: pick who's checking in.
  const needsWelcome = !me && route != null && !['welcome', 'join', 'gallery'].includes(route.name);
  useEffect(() => {
    if (needsWelcome) navigate('/welcome', { replace: true });
  }, [needsWelcome]);

  // "Shady just checked in at …" when the other phone adds a stay.
  useEffect(
    () =>
      onRemoteChange((change) => {
        if (change.source !== 'pull' || !me) return;
        const other = otherPerson(me);
        for (const v of change.newVisits) {
          if (v.added_by !== other) continue;
          const hotel = getState().hotels.get(v.hotel_id);
          toast.show({ id: `remote-${v.visit_id}`, tone: 'love', message: `${personName(other)} just checked in at ${hotel?.name ?? 'a new hotel'}` });
        }
      }),
    [me],
  );

  if (bootError) {
    return (
      <div className="page">
        <EmptyState title="Our diary can't open here" body={bootError} />
      </div>
    );
  }

  let content: ReactNode;
  let chrome = true;
  if (!route) {
    content = <NotFound />;
  } else if (route.kind === 'fullscreen') {
    chrome = false;
    content = <route.Component />;
  } else if (route.kind === 'sheet') {
    const Bg = background && background.route.kind === 'screen' ? background.route.Component : ROUTE_HOME;
    content = (
      <>
        <Bg />
        <route.Component />
      </>
    );
  } else {
    content = <route.Component />;
  }

  const active = route?.kind === 'sheet' ? background?.route.tab : route?.tab;

  return (
    <div className={s.app} data-chrome={chrome}>
      {chrome ? <Header active={active} /> : null}
      <OfflineBanner />
      {chrome ? <MobileTopBar /> : null}
      <main id="main" className={chrome ? s.main : undefined}>
        <ErrorBoundary resetKey={location.path}>
          <Suspense fallback={<Loading />}>{content}</Suspense>
        </ErrorBoundary>
      </main>
      {chrome ? <TabBar active={active} /> : null}
      <ToastHost />
      <PillowHost />
      <Intro />
      <PwaHost />
    </div>
  );
}

const ROUTE_HOME = matchRoute('/')!.route.Component;
