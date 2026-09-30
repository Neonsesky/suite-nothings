/**
 * `#/gallery` — unlinked gallery of the core components with demo data, for visual QA
 * (Playwright screenshots, the design agent, feature agents). Not part of the product flows.
 */
import { useState } from 'react';
import { Badge } from '@/components/Badge';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/Chip';
import { ClockLoader } from '@/components/ClockLoader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton, StayCardSkeleton } from '@/components/Skeleton';
import { SplitFlap } from '@/components/SplitFlap';
import { Stamp } from '@/components/Stamp';
import { StayArt } from '@/components/StayArt';
import { StayCard } from '@/components/StayCard';
import { TimestampChip } from '@/components/TimestampChip';
import { ToastHost } from '@/components/Toast';
import * as Icons from '@/components/icons';
import { useStays } from '@/data/store';
import { toast } from '@/lib/toast';
import s from './Gallery.module.css';

const BOARD_WORDS = ['DUBAI', 'UNITED ARAB EMIRATES', 'THE WORLD'];

export default function Gallery() {
  const stays = useStays();
  const [count, setCount] = useState(11);
  const [word, setWord] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [chips, setChips] = useState<string | null>('Dubai');
  return (
    <main className={s.root}>
      <h1 className={s.h1}>Component gallery</h1>

      <section className={s.section} aria-labelledby="g-flap">
        <h2 id="g-flap">Split-flap</h2>
        <div className={s.row} data-testid="flap-counter">
          <SplitFlap value={count} length={2} charset=" 0123456789" size="xl" ariaLabel={`${count} hotels together`} />
          <Button onClick={() => setCount((c) => (c >= 99 ? 1 : c + 1))}>Flip the board</Button>
        </div>
        <div className={s.row} data-testid="flap-chapter">
          <SplitFlap value={BOARD_WORDS[word]} length={20} size="sm" ariaLabel={BOARD_WORDS[word]} />
          <Button variant="secondary" onClick={() => setWord((w) => (w + 1) % BOARD_WORDS.length)}>
            Next chapter
          </Button>
        </div>
      </section>

      <section className={s.section} aria-labelledby="g-buttons">
        <h2 id="g-buttons">Buttons, chips, badges</h2>
        <div className={s.row}>
          <Button>Save our stay</Button>
          <Button variant="secondary">See all our stays</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="celebrate" icon={<Icons.IconHeart size={18} />}>
            Open the note
          </Button>
          <Button disabled>Saving</Button>
        </div>
        <ChipGroup
          label="City"
          scroll
          value={chips}
          onChange={(v) => setChips(v as string | null)}
          options={['Dubai', 'Sharjah', 'Abu Dhabi', 'Ras Al Khaimah', 'Abroad'].map((c) => ({ value: c, label: c }))}
        />
        <div className={s.row}>
          <Badge tone="ginger">First</Badge>
          <Badge>Visit 2</Badge>
          <Badge tone="cream" icon={<Icons.IconHeart size={12} />}>
            5
          </Badge>
          <Badge tone="ink">Our regular</Badge>
          <Badge tone="outline">Demo</Badge>
          <TimestampChip checkIn="14:00" checkOut="20:00" />
          <TimestampChip checkIn={null} checkOut={null} fallback="2 nights" />
        </div>
      </section>

      <section className={s.section} aria-labelledby="g-cards">
        <h2 id="g-cards">Stay cards</h2>
        <div className={s.grid}>
          {stays.slice(0, 3).map((st) => (
            <StayCard key={st.visit.visit_id} stay={st} />
          ))}
          <StayCardSkeleton />
        </div>
      </section>

      <section className={s.section} aria-labelledby="g-art">
        <h2 id="g-art">Stay art</h2>
        <div className={s.grid}>
          {(['window', 'pool', 'skyline'] as const).map((m, i) => (
            <div key={m} className={s.art}>
              <StayArt seed={`gallery-${i}`} motif={m} label={`${m} scene`} />
            </div>
          ))}
        </div>
      </section>

      <section className={s.section} aria-labelledby="g-stamps">
        <h2 id="g-stamps">Stamps and loaders</h2>
        <div className={s.row}>
          <Stamp title="1st" caption="stay" />
          <Stamp title="5" caption="hotels" tone="ginger" />
          <Stamp title="Abroad" caption="first trip" tone="cream" />
          <Stamp title="10" caption="hotels" locked />
          <ClockLoader />
          <Skeleton width="8rem" height="1rem" />
        </div>
      </section>

      <section className={s.section} aria-labelledby="g-icons">
        <h2 id="g-icons">Icons</h2>
        <div className={s.icons}>
          {Object.entries(Icons).map(([name, Icon]) =>
            typeof Icon === 'function' ? (
              <span key={name} className={s.icon} title={name}>
                <Icon size={24} />
              </span>
            ) : null,
          )}
        </div>
      </section>

      <section className={s.section} aria-labelledby="g-states">
        <h2 id="g-states">States</h2>
        <div className={s.grid}>
          <EmptyState art={<Icons.IconKey size={32} />} title="Our first check-in is waiting" body="Every hotel we visit lands here." action={<Button>Add our first stay</Button>} />
          <ErrorState title="Can't reach our Sheet" body="Your stays are safe on this phone. We'll try again shortly." onRetry={() => undefined} />
        </div>
      </section>

      <section className={s.section} aria-labelledby="g-overlays">
        <h2 id="g-overlays">Overlays</h2>
        <div className={s.row}>
          <Button onClick={() => setSheet(true)} data-testid="open-sheet">
            Open the sheet
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.show({ message: 'Stay deleted', action: { label: 'Undo', onClick: () => toast.show({ message: 'Stay restored', tone: 'success' }) } })}
          >
            Show a toast
          </Button>
        </div>
      </section>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Somewhere we've been" snapPoints={[0.5, 0.9]} initialSnap={0} footer={<Button block onClick={() => setSheet(false)}>Done</Button>}>
        <div className={s.sheetBody}>
          {stays.map((st) => (
            <p key={st.visit.visit_id}>{st.hotel.name}</p>
          ))}
        </div>
      </BottomSheet>
      <ToastHost />
    </main>
  );
}
