/** The pin card: a Dayuse-style StayCard for the tapped pin, then "Open stay". */
import { ButtonLink } from '@/components/Button';
import { StayCard } from '@/components/StayCard';
import { IconClose } from '@/components/icons';
import { usePhotoUrl } from '@/data/store';
import { parseJsonArray } from '@/data/stays';
import type { Stay } from '@/data/types';
import s from './MapScreen.module.css';

export function StayCardWithPhoto({ stay, className }: { stay: Stay; className?: string }) {
  const cover = parseJsonArray(stay.visit.photo_ids_json)[0] ?? null;
  const url = usePhotoUrl(cover, 'thumb');
  return <StayCard stay={stay} photoUrl={url} href={`#/stay/${stay.visit.visit_id}`} className={className} />;
}

export function PinCard({ stay, visits, onClose }: { stay: Stay; visits: number; onClose?: () => void }) {
  return (
    <div className={s.pinCard} data-testid="pin-card">
      {onClose ? (
        <button type="button" className={s.pinClose} onClick={onClose} aria-label="Close">
          <IconClose size={18} />
        </button>
      ) : null}
      <StayCardWithPhoto stay={stay} />
      <div className={s.pinActions}>
        {visits > 1 ? <span className={s.pinVisits}>{visits} visits here</span> : <span />}
        <ButtonLink href={`#/stay/${stay.visit.visit_id}`} data-autofocus>
          Open stay
        </ButtonLink>
      </div>
    </div>
  );
}
