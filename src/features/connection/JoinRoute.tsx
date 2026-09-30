/** `#/join?api=…&key=…&as=shady` — owned by w1-backend (stub renders a designed state). */
import { ButtonLink } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { IconLink } from '@/components/icons';

export default function JoinRoute() {
  return (
    <div className="page">
      <EmptyState
        art={<IconLink size={32} />}
        title="Joining our Sheet"
        body="Invite links start working with the next update. You can explore our stays in the meantime."
        action={<ButtonLink href="#/">See our stays</ButtonLink>}
      />
    </div>
  );
}
