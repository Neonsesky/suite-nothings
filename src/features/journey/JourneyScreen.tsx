/** Journey replay (SPEC §10). Later wave replaces this stub entirely. */
import { ButtonLink } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { IconJourney } from '@/components/icons';

export default function JourneyScreen() {
  return (
    <div className="page">
      <EmptyState
        art={<IconJourney size={32} />}
        title="Our journey"
        body="The replay of every check-in, in order, starting 19 Jun 2026."
        action={<ButtonLink href="#/map" variant="secondary">Open our map</ButtonLink>}
      />
    </div>
  );
}
