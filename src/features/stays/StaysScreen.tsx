/**
 * Stays (home), SPEC §3.3 / §8.2: dayuse.ae's homepage anatomy with our content in every slot,
 * in order: hero, stats, our stays, story in three, install, moment, wishlist, FAQ, chains,
 * footer. The shell's OfflineBanner covers the offline state; everything renders from cache.
 */
import { useEffect } from 'react';
import { ButtonLink } from '@/components/Button';
import { KeyTagMark } from '@/components/brand/KeyTagMark';
import { IconPlus } from '@/components/icons';
import { Skeleton, StayCardSkeleton } from '@/components/Skeleton';
import { useStays, useStoreReady } from '@/data/store';
import { Hero } from './Hero';
import { MomentsSlot } from './MomentsSlot';
import { OurStays } from './OurStays';
import { ChainMarquee, Faq, Footer, InstallBanner, StatsRow, StoryThree, WishTeaser } from './Sections';
import s from './Sections.module.css';

/** Lets the shell draw its header transparent over our hero. */
function useHeroHeader(on: boolean) {
  useEffect(() => {
    if (!on) return;
    document.documentElement.dataset.heroHeader = '1';
    return () => {
      delete document.documentElement.dataset.heroHeader;
    };
  }, [on]);
}

function LoadingHome() {
  return (
    <div className={s.screen} aria-busy="true" aria-label="Loading our stays…">
      <div className={s.heroSkeleton} />
      <div className="page">
        <div className={s.statsSection}>
          <Skeleton width="12rem" height="3.5rem" radius="md" />
          <Skeleton height="7rem" radius="lg" />
        </div>
        <div className={s.section}>
          <Skeleton width="10rem" height="2rem" />
          <div className={s.grid}>
            {Array.from({ length: 4 }, (_, i) => (
              <StayCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyHome() {
  return (
    <div className={s.screen}>
      <section className={s.empty} aria-labelledby="empty-title">
        <KeyTagMark size={96} />
        <h1 id="empty-title">Our first check-in is waiting</h1>
        <ButtonLink href="#/add" size="lg" icon={<IconPlus size={20} />}>
          Add our first stay
        </ButtonLink>
      </section>
      <Footer />
    </div>
  );
}

export default function StaysScreen() {
  const ready = useStoreReady();
  const stays = useStays();
  const hasStays = ready && stays.length > 0;
  useHeroHeader(hasStays);

  if (!ready) return <LoadingHome />;
  if (!stays.length) return <EmptyHome />;

  return (
    <div className={s.screen}>
      <Hero stays={stays} />
      <div className="page">
        <StatsRow stays={stays} />
        <OurStays stays={stays} />
        <StoryThree stays={stays} />
        <InstallBanner />
        <MomentsSlot stays={stays} />
        <WishTeaser />
        <Faq stays={stays} />
      </div>
      <ChainMarquee stays={stays} />
      <Footer />
    </div>
  );
}
