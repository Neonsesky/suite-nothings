/**
 * Us (SPEC §8.7): together-since counter, our numbers, whose picks rate higher, milestone stamps,
 * and the way into Letters, Next check-ins, Journey and Settings. Desktop is two columns.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ButtonLink } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { SplitFlap } from '@/components/SplitFlap';
import { IconBed, IconChevron, IconClock, IconGlobe, IconHeart, IconJourney, IconKey, IconMail, IconPin, IconPlus, IconSettings, IconSparkle } from '@/components/icons';
import { COUPLE } from '@/config/couple';
import { useSettings, useStays, useStoreReady, useSyncState, useWishes } from '@/data/store';
import { useLetterViews } from '@/features/letters/access';
import { openStay } from '@/features/stays/transition';
import { formatDate, nowTime, today, togetherDuration } from '@/lib/dates';
import { highlights, pickBoard, statTiles, type StatTile } from './logic';
import { StampGrid } from './StampGrid';
import s from './Us.module.css';

const STAT_ICONS: Record<StatTile['key'], ReactNode> = {
  hotels: <IconBed size={22} />,
  visits: <IconKey size={22} />,
  hours: <IconClock size={22} />,
  cities: <IconPin size={22} />,
  countries: <IconGlobe size={22} />,
  km: <IconJourney size={22} />,
};

function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let t = 0;
    const tick = () => {
      setNow(new Date());
      t = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    t = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    return () => window.clearTimeout(t);
  }, []);
  return now;
}

function TogetherCounter() {
  const now = useMinuteClock();
  const d = togetherDuration(now);
  const since = new Date(COUPLE.togetherSince);
  const label = `${d.days} days, ${d.hours} h, ${d.minutes} min together`;
  const cells: { value: number; unit: string; len: number }[] = [
    { value: d.days, unit: d.days === 1 ? 'day' : 'days', len: Math.max(3, String(d.days).length) },
    { value: d.hours, unit: 'h', len: 2 },
    { value: d.minutes, unit: 'min', len: 2 },
  ];
  return (
    <section className={s.counter} aria-labelledby="us-together" data-section="together">
      <h2 id="us-together" className={s.counterLabel}>
        Together since
      </h2>
      <div className={s.counterRow} role="img" aria-label={label}>
        {cells.map((c) => (
          <span key={c.unit} className={s.counterCell}>
            <SplitFlap value={c.value} length={c.len} charset=" 0123456789" size="var(--us-flap)" ariaLabel={`${c.value} ${c.unit}`} />
            <span className={s.counterUnit} aria-hidden="true">
              {c.unit}
            </span>
          </span>
        ))}
      </div>
      <p className={s.counterSince}>
        <time dateTime={COUPLE.togetherSince}>
          {formatDate(today(COUPLE.timezone, since))}, {nowTime(COUPLE.timezone, since)}
        </time>{' '}
        in Dubai · {d.months > 0 ? `${d.months} ${d.months === 1 ? 'month' : 'months'} and counting` : 'and counting'}
      </p>
    </section>
  );
}

function Stats({ stays }: { stays: ReturnType<typeof useStays> }) {
  const { home_base: home, units } = useSettings();
  const tiles = useMemo(() => statTiles(stays, home, units), [stays, home, units]);
  const hl = useMemo(() => highlights(stays, home, units), [stays, home, units]);
  return (
    <section className={s.card} aria-labelledby="us-stats" data-section="stats">
      <h2 id="us-stats" className={s.h2}>
        Us, in numbers
      </h2>
      <ul className={s.tiles} role="list">
        {tiles.map((t) => (
          <li key={t.key} className={s.tile} data-stat={t.key}>
            <span className={s.tileIcon} aria-hidden="true">
              {STAT_ICONS[t.key]}
            </span>
            <strong className={s.tileValue}>{t.value}</strong>
            <span className={s.tileLabel}>{t.label}</span>
          </li>
        ))}
      </ul>
      {hl.length ? (
        <ul className={s.highlights} role="list">
          {hl.map((h) => (
            <li key={h.key}>
              <a
                className={s.highlight}
                href={h.visitId ? `#/stay/${h.visitId}` : '#/'}
                data-highlight={h.key}
                onClick={(e) => {
                  if (!h.visitId) return;
                  e.preventDefault();
                  openStay(h.visitId);
                }}
              >
                <span className={s.hlLabel}>{h.label}</span>
                <strong className={s.hlValue}>{h.value}</strong>
                <span className={s.hlDetail}>{h.detail}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Picks({ stays }: { stays: ReturnType<typeof useStays> }) {
  const board = useMemo(() => pickBoard(stays), [stays]);
  return (
    <section className={s.card} aria-labelledby="us-picks" data-section="picks">
      <h2 id="us-picks" className={s.h2}>
        Whose picks rate higher
      </h2>
      <ul className={s.picks} role="list">
        {board.rows.map((r) => (
          <li key={r.person} className={s.pick} data-leader={r.leader || undefined}>
            <span className={s.pickName}>
              {r.name}
              {r.leader ? <IconHeart size={14} className={s.pickHeart} aria-label="leading" /> : null}
            </span>
            <span className={s.pickBar} aria-hidden="true">
              <span style={{ transform: `scaleX(${r.fill})` }} />
            </span>
            <span className={s.pickScore}>
              <strong>{r.average == null ? '–' : (Math.round(r.average * 10) / 10).toFixed(1)}</strong>
              <span>
                {r.picks} {r.picks === 1 ? 'pick' : 'picks'}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className={s.pickLine} data-state={board.state}>
        {board.line}
      </p>
    </section>
  );
}

function Links() {
  const views = useLetterViews();
  const unread = views.filter((v) => !v.mine && v.unlocked && !v.letter.read_at).length;
  const wishes = useWishes().filter((w) => !w.fulfilled_visit_id).length;
  const rows: { href: string; icon: ReactNode; label: string; hint: string; dot?: boolean }[] = [
    {
      href: '#/letters',
      icon: <IconMail size={22} />,
      label: 'Letters',
      hint: unread ? (unread === 1 ? 'A new note is waiting' : `${unread} new notes are waiting`) : 'Notes we leave each other',
      dot: unread > 0,
    },
    { href: '#/wishlist', icon: <IconSparkle size={22} />, label: 'Next check-ins', hint: wishes ? `${wishes} ${wishes === 1 ? 'hotel' : 'hotels'} on our wishlist` : 'Hotels we’re dreaming about' },
    { href: '#/journey', icon: <IconJourney size={22} />, label: 'Journey', hint: 'Replay our stays, stop by stop' },
    { href: '#/settings', icon: <IconSettings size={22} />, label: 'Settings', hint: 'Who am I, home base, sync' },
  ];
  return (
    <nav className={s.card} aria-label="More of us" data-section="links">
      <ul className={s.links} role="list">
        {rows.map((r) => (
          <li key={r.href}>
            <a className={s.link} href={r.href} data-link={r.href.slice(2)}>
              <span className={s.linkIcon} aria-hidden="true">
                {r.icon}
                {r.dot ? <span className={s.dot} data-testid="letters-unread" /> : null}
              </span>
              <span className={s.linkText}>
                <strong>{r.label}</strong>
                <span>{r.hint}</span>
              </span>
              {r.dot ? <span className="sr-only">, unread</span> : null}
              <IconChevron size={18} className={s.chev} />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function LoadingUs() {
  return (
    <div className={`page ${s.screen}`} aria-busy="true" aria-label="Loading our numbers">
      <Skeleton height="2rem" width="6rem" />
      <Skeleton height="9rem" radius="lg" />
      <div className={s.grid}>
        <div className={s.col}>
          <Skeleton height="16rem" radius="lg" />
          <Skeleton height="9rem" radius="lg" />
        </div>
        <div className={s.col}>
          <Skeleton height="14rem" radius="lg" />
        </div>
      </div>
    </div>
  );
}

export default function UsScreen() {
  const ready = useStoreReady();
  const stays = useStays();
  const sync = useSyncState();
  if (!ready) return <LoadingUs />;
  const empty = stays.length === 0;
  return (
    <div className={`page ${s.screen}`} data-screen="us">
      <header className={s.head}>
        <h1 className={s.title}>Us</h1>
      </header>
      {!sync.online ? (
        <p className={s.offline} role="status">
          Offline. Everything here is on this phone, so it's all still ours.
        </p>
      ) : null}
      <TogetherCounter />
      {empty ? (
        <section className={`${s.card} ${s.empty}`} aria-labelledby="us-empty">
          <span className={s.emptyArt} aria-hidden="true">
            <IconKey size={30} />
          </span>
          <h2 id="us-empty" className={s.h2}>
            Our first check-in is waiting
          </h2>
          <p>Our numbers, stamps and scores start with one stay.</p>
          <ButtonLink href="#/add" icon={<IconPlus size={18} />}>
            Add our first stay
          </ButtonLink>
        </section>
      ) : null}
      <div className={s.grid}>
        <div className={s.col}>
          {empty ? null : <Stats stays={stays} />}
          {empty ? null : <Picks stays={stays} />}
        </div>
        <div className={s.col}>
          <StampGrid stays={stays} />
          <Links />
        </div>
      </div>
    </div>
  );
}
