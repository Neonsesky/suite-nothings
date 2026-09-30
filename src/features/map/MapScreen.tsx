/** Map (SPEC §9). Owned by w1-map — this stub is replaced entirely. */
import { ButtonLink } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { IconMap } from '@/components/icons';
import { useQueryParam } from '@/app/router';

export default function MapScreen() {
  const city = useQueryParam('city');
  return (
    <div className="page">
      <EmptyState
        art={<IconMap size={32} />}
        title={city ? `Our ${city} map` : 'Our map'}
        body="Every pin we've dropped, from Dubai to the whole world, unfolds right here."
        action={<ButtonLink href="#/" variant="secondary">See our stays</ButtonLink>}
      />
    </div>
  );
}
