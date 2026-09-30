/** The quieter home sections after "Our stays" (SPEC §3.3 rows 3, 6–13). */
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { href } from '@/app/router';
import { KeyTagMark } from '@/components/brand/KeyTagMark';
import { BottomSheet } from '@/components/BottomSheet';
import { Button, ButtonLink } from '@/components/Button';
import { IconArrowRight, IconBed, IconChevron, IconClock, IconGlobe, IconKey, IconPin, IconShare, IconPlus } from '@/components/icons';
import { SplitFlap } from '@/components/SplitFlap';
import { StayArt } from '@/components/StayArt';
import { COUPLE } from '@/config/couple';
import { usePhotoUrl, useSettings, useWishes } from '@/data/store';
import type { Stay } from '@/data/types';
import { formatDate, togetherDuration } from '@/lib/dates';
import { favouriteStay, firstStay, latestStay, summary } from '@/lib/stats';
import { openIOSInstallSheet, useInstallPrompt } from '@/pwa/install';
import { brandsList, buildFaq } from './logic';
import { openStay } from './transition';
import s from './Sections.module.css';

/* ── Stats row, in place of Dayuse's trust badges ─────────────────────────────── */

export function StatsRow({ stays }: { stays: Stay[] }) {
  const home = useSettings().home_base;
  const sum = summary(stays, home);
  const items: { icon: ReactNode; value: number; label: string }[] = [
    { icon: <IconBed size={24} />, value: sum.hotels, label: 'Hotels' },
    { icon: <IconKey size={24} />, value: sum.visits, label: 'Visits' },
    { icon: <IconClock size={24} />, value: sum.hours, label: 'Hours of hotel time together' },
    { icon: <IconPin size={24} />, value: sum.cities, label: 'Cities' },
    { icon: <IconGlobe size={24} />, value: sum.countries, label: 'Countries' },
  ];
  const caption = sum.hotels === 1 ? 'hotel together' : 'hotels together';
  return (
    <section className={s.statsSection} aria-label="Our numbers" data-section="stats">
      <div className={s.counter}>
        <SplitFlap
          value={sum.hotels}
          length={Math.max(2, String(sum.hotels).length)}
          charset=" 0123456789"
          size="var(--flap-size)"
          ariaLabel={`${sum.hotels} ${caption}`}
          live
          className={s.flap}
        />
        <span className={s.counterLabel} aria-hidden="true">
          {caption}
        </span>
      </div>
      <ul className={s.trustCard} role="list">
        {items.map((i) => (
          <li key={i.label} className={s.stat}>
            <span className={s.statIcon} aria-hidden="true">
              {i.icon}
            </span>
            <span className={s.statText}>
              <strong>{i.value.toLocaleString('en-GB')}</strong>
              <span>{i.label}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Our story in three stays (Dayuse "Book in three steps") ─────────────────── */

function StoryPanel({ stay }: { stay: Stay }) {
  const url = usePhotoUrl(stay.photos[0]?.photo_id ?? null, 'thumb');
  return url ? <img src={url} alt="" loading="lazy" /> : <StayArt seed={stay.hotel.hotel_id} />;
}

export function StoryThree({ stays }: { stays: Stay[] }) {
  const first = firstStay(stays);
  const latest = latestStay(stays);
  const fav = favouriteStay(stays);
  const steps = [
    { label: 'First', caption: 'Where it all started', stay: first },
    { label: 'Latest', caption: 'Most recent check-in', stay: latest },
    { label: 'Favourite', caption: 'The one we keep talking about', stay: fav },
  ].filter((x): x is { label: string; caption: string; stay: Stay } => x.stay != null);
  if (!steps.length) return null;
  return (
    <section className={s.section} aria-labelledby="story-three" data-section="story">
      <div className={s.story}>
        <div className={s.storyText}>
          <h2 id="story-three" className={s.storyTitle}>
            Our story in three stays
          </h2>
          <ol className={s.steps}>
            {steps.map((st, i) => (
              <li key={st.label}>
                <a
                  href={`#/stay/${st.stay.visit.visit_id}`}
                  className={s.step}
                  onClick={(e) => {
                    e.preventDefault();
                    openStay(st.stay.visit.visit_id);
                  }}
                >
                  <span className={s.stepNum} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={s.stepBody}>
                    <strong>
                      {st.label} · {st.stay.hotel.name}
                    </strong>
                    <span>
                      {st.caption}, {formatDate(st.stay.visit.date)}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>
        <div className={s.storyPanels} aria-hidden="true">
          {steps.map((st) => (
            <div key={st.label} className={s.storyPanel}>
              <StoryPanel stay={st.stay} />
              <span>{st.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Put us on your home screen ─────────────────────────────────────────────── */

const DISMISS_KEY = 'sn:stays:install-dismissed';

export function InstallBanner() {
  const { canInstall, isIOS, isStandalone, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [help, setHelp] = useState(false);
  if (isStandalone || dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode: dismissal lasts for this visit */
    }
  };
  const install = async () => {
    // iOS gets the shell's illustrated Add to Home Screen sheet; ours is the fallback elsewhere.
    if (isIOS) return openIOSInstallSheet();
    if (canInstall && (await promptInstall()) !== 'unavailable') return;
    setHelp(true);
  };
  return (
    <section className={s.section} aria-labelledby="install-title" data-section="install">
      <div className={s.install}>
        <span className={s.installMark} aria-hidden="true">
          <KeyTagMark size={56} />
        </span>
        <div className={s.installText}>
          <h2 id="install-title">Put us on your home screen</h2>
          <p>One tap and Suite Nothings lives right there, no browser bar.</p>
        </div>
        <div className={s.installActions}>
          <Button onClick={() => void install()} icon={<IconPlus size={18} />}>
            Add to home screen
          </Button>
          <Button variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
      <BottomSheet open={help} onClose={() => setHelp(false)} title="Add us to your home screen" snapPoints={[0.6]}>
        <ol className={s.installSteps} data-no-drag>
          <li>
            <span className={s.stepNum}>1</span>
            <span>
              <strong>Tap Share</strong> <IconShare size={18} aria-hidden="true" />
              <br />
              {isIOS ? 'Look for the square with an arrow, at the bottom of Safari.' : 'Or open your browser menu.'}
            </span>
          </li>
          <li>
            <span className={s.stepNum}>2</span>
            <strong>Tap Add to Home Screen</strong>
          </li>
        </ol>
      </BottomSheet>
    </section>
  );
}

/* ── Next check-ins (wishlist teaser) ───────────────────────────────────────── */

export function WishTeaser() {
  const wishes = useWishes().filter((w) => !w.fulfilled_visit_id).slice(0, 3);
  return (
    <section className={s.section} aria-labelledby="next-checkins" data-section="wishlist">
      <div className={s.headRow}>
        <h2 id="next-checkins" className={s.h2}>
          Next check-ins
        </h2>
        {wishes.length ? (
          <ButtonLink href={href('/wishlist', { surprise: 1 })} variant="secondary" size="sm">
            Surprise me
          </ButtonLink>
        ) : null}
      </div>
      {wishes.length ? (
        <ul className={s.wishes} role="list">
          {wishes.map((w) => (
            <li key={w.wish_id}>
              <a className={s.wish} href="#/wishlist">
                <strong>{w.name}</strong>
                <span>{[w.city, w.country].filter(Boolean).join(', ')}</span>
                {w.note ? <em>{w.note}</em> : null}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className={s.wishEmpty}>
          <strong>No wishes yet</strong>
          <span>Add a hotel we're dreaming about.</span>
          <ButtonLink href="#/wishlist" variant="secondary" size="sm">
            Add a wish
          </ButtonLink>
        </div>
      )}
    </section>
  );
}

/* ── Frequently asked by us ─────────────────────────────────────────────────── */

export function Faq({ stays }: { stays: Stay[] }) {
  const settings = useSettings();
  const items = useMemo(() => buildFaq(stays, settings.home_base, settings.units), [stays, settings.home_base, settings.units]);
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  const uid = useId().replace(/:/g, '');
  return (
    <section className={s.section} aria-labelledby="faq" data-section="faq">
      <div className={s.faqCard}>
        <h2 id="faq" className={s.faqTitle}>
          Frequently asked by us
        </h2>
        <div className={s.faqList}>
          {items.map((it) => {
            const isOpen = open === it.id;
            return (
              <div key={it.id} className={s.faqItem} data-open={isOpen || undefined}>
                <h3>
                  <button
                    type="button"
                    className={s.faqQ}
                    aria-expanded={isOpen}
                    aria-controls={`${uid}-${it.id}`}
                    id={`${uid}-${it.id}-q`}
                    onClick={() => setOpen(isOpen ? null : it.id)}
                  >
                    <span>{it.question}</span>
                    <IconChevron size={20} className={s.chevron} aria-hidden="true" />
                  </button>
                </h3>
                <div id={`${uid}-${it.id}`} role="region" aria-labelledby={`${uid}-${it.id}-q`} className={s.faqA} hidden={!isOpen}>
                  <p>{it.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── The chain marquee (text only, from `brand`) ────────────────────────────── */

export function ChainMarquee({ stays }: { stays: Stay[] }) {
  const brands = useMemo(() => brandsList(stays), [stays]);
  if (!brands.length) return null;
  const row = (hidden: boolean) => (
    <ul className={s.marqueeRow} role="list" aria-hidden={hidden || undefined}>
      {brands.map((b) => (
        <li key={b}>{b}</li>
      ))}
    </ul>
  );
  return (
    <section className={s.chains} aria-labelledby="chains" data-section="chains">
      <h2 id="chains" className={s.chainsTitle}>
        Hotels we keep choosing
      </h2>
      <div className={s.marquee} style={{ ['--marquee-dur' as string]: `${Math.max(18, brands.length * 4)}s` }}>
        <div className={s.marqueeTrack}>
          {row(false)}
          {row(true)}
        </div>
      </div>
    </section>
  );
}

/* ── Footer ─────────────────────────────────────────────────────────────────── */

function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let t = 0;
    const schedule = () => {
      t = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, 60_000 - (Date.now() % 60_000) + 50);
    };
    schedule();
    return () => window.clearTimeout(t);
  }, []);
  return now;
}

export function Footer() {
  const now = useMinuteClock();
  const d = togetherDuration(now);
  return (
    <footer className={s.footer} data-section="footer">
      <div className={`page ${s.footerInner}`}>
        <div className={s.footerBrand}>
          <KeyTagMark size={32} variant="mono" />
          <strong>{COUPLE.appName}</strong>
        </div>
        <p className={s.credit}>Made by Nirsh for Shady</p>
        <p className={s.together} aria-live="off">
          <time dateTime={COUPLE.togetherSince}>
            {d.days} days, {d.hours} h, {d.minutes} min together
          </time>
        </p>
        <nav className={s.footerNav} aria-label="Footer">
          <a href="#/">Stays</a>
          <a href="#/map">Map</a>
          <a href="#/journey">Journey</a>
          <a href="#/us">Us</a>
          <a href="#/settings">Settings</a>
          <a href="#/settings" className={s.about}>
            About
            <IconArrowRight size={14} aria-hidden="true" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
