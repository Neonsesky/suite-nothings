/**
 * Add a stay (SPEC §8.3). Owned by w1-add-stay — this stub is replaced entirely.
 * Route `#/add` renders as a sheet over the current screen; `?hotel=<hotel_id>` = revisit.
 */
import { useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/Chip';
import { goBack, useQueryParam } from '@/app/router';
import { upsertVisit, useHotels } from '@/data/store';
import { VISIT_TYPES, type VisitType } from '@/data/types';
import { today } from '@/lib/dates';
import { toast } from '@/lib/toast';
import { useMarkBusy } from '@/lib/busy';
import s from '../stubs.module.css';

export default function AddStaySheet() {
  const [open, setOpen] = useState(true);
  const hotels = useHotels();
  const preset = useQueryParam('hotel');
  const [hotelId, setHotelId] = useState<string | null>(preset);
  const [type, setType] = useState<VisitType>('Dayuse');
  useMarkBusy(open, 'add-stay');
  const close = () => setOpen(false);
  const save = async () => {
    if (!hotelId) return;
    await upsertVisit({ hotel_id: hotelId, date: today(), visit_type: type });
    toast.show({ message: 'Stay saved', tone: 'success' });
    close();
  };
  return (
    <BottomSheet
      open={open}
      onClose={close}
      title="Add a stay"
      snapPoints={[0.6, 0.92]}
      initialSnap={1}
      footer={
        <Button block size="lg" disabled={!hotelId} onClick={() => void save()}>
          Save our stay
        </Button>
      }
    >
      <OnExit open={open} />
      <div className={s.section}>
        <h3 className={s.sectionTitle}>Somewhere we've been</h3>
        <ChipGroup
          label="Hotel"
          options={hotels.slice(0, 8).map((h) => ({ value: h.hotel_id, label: h.name }))}
          value={hotelId}
          onChange={(v) => setHotelId(v as string | null)}
        />
        <h3 className={s.sectionTitle}>What we did</h3>
        <ChipGroup label="Visit type" options={VISIT_TYPES.map((t) => ({ value: t, label: t }))} value={type} onChange={(v) => v && setType(v as VisitType)} />
      </div>
    </BottomSheet>
  );
}

/** Leaves the #/add route once the sheet has animated closed. */
function OnExit({ open }: { open: boolean }) {
  const [left, setLeft] = useState(false);
  if (!open && !left) {
    setLeft(true);
    setTimeout(() => goBack('/'), 320);
  }
  return null;
}
