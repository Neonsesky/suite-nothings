/** Stay detail (SPEC §8.4). Owned by w1-stays — this stub is replaced entirely. */
import { Button, ButtonLink } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { IconBack, IconTrash } from '@/components/icons';
import { StayCard } from '@/components/StayCard';
import { goBack, navigate, useParams } from '@/app/router';
import { deleteVisitWithUndo, useStay } from '@/data/store';
import s from '../stubs.module.css';

export default function StayDetailScreen() {
  const { visitId } = useParams();
  const stay = useStay(visitId);
  if (!stay || stay.visit.deleted) {
    return (
      <div className="page">
        <EmptyState title="We can't find that stay" body="It may have been deleted, or it's still syncing." action={<ButtonLink href="#/">Back to our stays</ButtonLink>} />
      </div>
    );
  }
  return (
    <div className={`page ${s.screen}`}>
      <div className={s.actions}>
        <Button variant="ghost" icon={<IconBack size={18} />} onClick={() => goBack('/')}>
          Back
        </Button>
      </div>
      <StayCard stay={stay} />
      {stay.visit.note ? <p>{stay.visit.note}</p> : null}
      <div className={s.actions}>
        <Button
          variant="secondary"
          icon={<IconTrash size={18} />}
          onClick={() => {
            void deleteVisitWithUndo(stay.visit.visit_id);
            navigate('/', { replace: true });
          }}
        >
          Delete this stay
        </Button>
      </div>
    </div>
  );
}
