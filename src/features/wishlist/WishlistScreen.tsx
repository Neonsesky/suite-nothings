/** Next check-ins (SPEC §12): our wishlist with dashed pins, "Surprise me" and one-tap → stay. */
import { useMemo, useState } from 'react';
import { href, navigate, useQueryParam } from '@/app/router';
import { Button, ButtonLink } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { IconCheck, IconDice, IconKey, IconPlus, IconSparkle, IconTrash } from '@/components/icons';
import { personName } from '@/config/couple';
import { upsertWish, useStoreReady, useWishes } from '@/data/store';
import type { Wish } from '@/data/types';
import { formatDate } from '@/lib/dates';
import { toast } from '@/lib/toast';
import { AddWishSheet } from './AddWishSheet';
import { PRIORITY_LABELS, fulfilledWishes, openWishes, placeLine } from './logic';
import { SurpriseSheet } from './SurpriseSheet';
import s from './Wishlist.module.css';

async function removeWish(w: Wish) {
  await upsertWish({ ...w, deleted: true });
  toast.show({
    message: 'Wish removed',
    action: { label: 'Undo', onClick: () => void upsertWish({ ...w, deleted: false }) },
  });
}

function DashedPin() {
  return (
    <svg className={s.pin} viewBox="0 0 32 40" width="32" height="40" aria-hidden="true">
      <path
        d="M16 38c-1.2-1.6-12-13.4-12-22a12 12 0 0 1 24 0c0 8.6-10.8 20.4-12 22Z"
        fill="var(--color-paper)"
        stroke="var(--color-ink)"
        strokeWidth="2"
        strokeDasharray="4 3"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="4.5" fill="var(--color-honey)" stroke="var(--color-ink)" strokeWidth="1.5" />
    </svg>
  );
}

function WishCard({ w }: { w: Wish }) {
  return (
    <li className={s.wish} data-wish-id={w.wish_id}>
      <DashedPin />
      <div className={s.wishBody}>
        <div className={s.wishTop}>
          <h3 className={s.wishName}>{w.name}</h3>
          {w.priority ? (
            <span className={s.priority} data-priority={w.priority}>
              {PRIORITY_LABELS[w.priority]}
            </span>
          ) : null}
        </div>
        {placeLine(w) ? <p className={s.wishPlace}>{placeLine(w)}</p> : null}
        {w.note ? <p className={s.wishNote}>{w.note}</p> : null}
        <p className={s.wishMeta}>
          {w.added_by ? `${personName(w.added_by)}'s wish · ` : ''}added {formatDate(w.created_at.slice(0, 10))}
        </p>
        <div className={s.wishActions}>
          <ButtonLink href={href('/add', { wish: w.wish_id })} size="sm" icon={<IconKey size={16} />}>
            Turn into a stay
          </ButtonLink>
          <Button variant="ghost" size="sm" icon={<IconTrash size={16} />} onClick={() => void removeWish(w)} aria-label={`Remove ${w.name}`}>
            Remove
          </Button>
        </div>
      </div>
    </li>
  );
}

export default function WishlistScreen() {
  const ready = useStoreReady();
  const all = useWishes();
  const wishes = useMemo(() => openWishes(all), [all]);
  const done = useMemo(() => fulfilledWishes(all), [all]);
  const surpriseParam = useQueryParam('surprise') === '1';
  const [adding, setAdding] = useState(false);
  // Arriving from the home teaser's "Surprise me" (`?surprise=1`) opens the board straight away.
  const [surprise, setSurprise] = useState(surpriseParam);
  // Fresh keys remount the sheets' contents, so each open starts clean (and spins anew).
  const [addKey, setAddKey] = useState(0);
  const [spinKey, setSpinKey] = useState(0);
  const openAdd = () => {
    setAddKey((k) => k + 1);
    setAdding(true);
  };
  const openSurprise = () => {
    setSpinKey((k) => k + 1);
    setSurprise(true);
  };

  const closeSurprise = () => {
    setSurprise(false);
    if (surpriseParam) navigate('/wishlist', { replace: true });
  };

  if (!ready) {
    return (
      <div className={`page ${s.screen}`} aria-busy="true" aria-label="Loading our wishlist">
        <Skeleton height="2rem" width="12rem" />
        <Skeleton height="8rem" radius="lg" />
        <Skeleton height="8rem" radius="lg" />
      </div>
    );
  }

  return (
    <div className={`page ${s.screen}`} data-screen="wishlist">
      <header className={s.head}>
        <div>
          <h1 className={s.title}>Next check-ins</h1>
          <p className={s.sub}>Hotels we're dreaming about. Dashed pins on our map until we check in.</p>
        </div>
        <div className={s.headActions}>
          {wishes.length ? (
            <Button variant="secondary" icon={<IconDice size={18} />} onClick={openSurprise} data-testid="surprise-me">
              Surprise me
            </Button>
          ) : null}
          <Button icon={<IconPlus size={18} />} onClick={openAdd} data-testid="add-wish">
            Add a wish
          </Button>
        </div>
      </header>

      {wishes.length ? (
        <ul className={s.list} role="list">
          {wishes.map((w) => (
            <WishCard key={w.wish_id} w={w} />
          ))}
        </ul>
      ) : (
        <EmptyState
          className={s.empty}
          art={<IconSparkle size={32} />}
          title={done.length ? 'Every wish came true' : 'No wishes yet'}
          body={done.length ? 'Time to dream up the next one.' : 'Add a hotel we’re dreaming about.'}
          action={
            <Button icon={<IconPlus size={18} />} onClick={openAdd}>
              Add a wish
            </Button>
          }
        />
      )}

      {done.length ? (
        <section className={s.doneSection} aria-labelledby="wishes-done">
          <h2 id="wishes-done" className={s.h2}>
            Wishes that came true
          </h2>
          <ul className={s.doneList} role="list">
            {done.map((w) => (
              <li key={w.wish_id}>
                <a className={s.done} href={`#/stay/${w.fulfilled_visit_id}`}>
                  <span className={s.doneIcon} aria-hidden="true">
                    <IconCheck size={16} />
                  </span>
                  <strong>{w.name}</strong>
                  <span>{placeLine(w)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AddWishSheet key={`add-${addKey}`} open={adding} onClose={() => setAdding(false)} />
      <SurpriseSheet key={`spin-${spinKey}`} open={surprise && wishes.length > 0} wishes={wishes} onClose={closeSurprise} />
    </div>
  );
}
