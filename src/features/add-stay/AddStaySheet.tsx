/**
 * Add a stay (SPEC §8.3): the most important flow, under 30 seconds on a phone.
 * Route `#/add` renders as a sheet over the last screen.
 *   ?hotel=<hotel_id>  one-tap revisit (hotel preselected, straight to When)
 *   ?here=1            start with "We're here now"
 *   ?edit=<visit_id>   edit an existing stay with the same steps
 * Every change autosaves to the `drafts` store; reopening offers to pick up where we left off.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ClockLoader } from '@/components/ClockLoader';
import { EmptyState } from '@/components/EmptyState';
import { IconBack } from '@/components/icons';
import { getLastScreen, goBack, navigate, useQueryParam } from '@/app/router';
import { deleteDraft, getState, loadDraft, saveDraft, setPhotoProcessor, useHotel, useMe, useStay, useStoreReady, useSyncState } from '@/data/store';
import { parseJsonArray } from '@/data/stays';
import type { Photo } from '@/data/types';
import { checkMilestones, showMilestoneUnlock } from '@/features/milestones';
import { useMarkBusy } from '@/lib/busy';
import { today } from '@/lib/dates';
import { photoProcessor } from '@/lib/image';
import { toast } from '@/lib/toast';
import { Celebration, type CelebrationProps } from './Celebration';
import {
  draftFromVisit,
  editDraftId,
  emptyDraft,
  isDirty,
  NEW_DRAFT_ID,
  reviveDraft,
  revisitDefaults,
  STEP_TITLES,
  stepProblem,
  STEPS,
  type AddStayDraft,
  type HotelChoice,
  type StepProblem,
} from './draft';
import { HotelStep } from './HotelStep';
import { PhotosStep } from './PhotosStep';
import { saveStay } from './save';
import { GoodPartStep, WhatStep, WhenStep } from './Steps';
import s from './AddStay.module.css';

// Photos added anywhere through the store get the real resize + EXIF-strip pipeline.
setPhotoProcessor(photoProcessor);

type Patch = Partial<AddStayDraft> | ((d: AddStayDraft) => Partial<AddStayDraft>);
const LAST = STEPS.length - 1;
const EXIT_MS = 320;

export default function AddStaySheet() {
  const presetHotelId = useQueryParam('hotel');
  const here = useQueryParam('here') === '1';
  const editId = useQueryParam('edit');
  const me = useMe() ?? 'nirsh';
  const ready = useStoreReady();
  const sync = useSyncState();
  const editStay = useStay(editId);
  const presetHotel = useHotel(presetHotelId);
  const draftId = editId ? editDraftId(editId) : NEW_DRAFT_ID;
  const [background] = useState(() => getLastScreen().path);

  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState<AddStayDraft | null>(null);
  const [base, setBase] = useState<AddStayDraft | null>(null);
  const [resume, setResume] = useState<AddStayDraft | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<StepProblem>(null);
  const [celebration, setCelebration] = useState<Omit<CelebrationProps, 'onDone'> & { finish(): void } | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  useMarkBusy(open || celebration != null, 'add-stay');

  const missingEdit = ready && editId != null && !editStay;

  // Build the starting draft once the store is ready, and look for a saved one.
  useEffect(() => {
    if (!ready || draft || missingEdit || (editId && !editStay)) return;
    let alive = true;
    const fresh = (() => {
      if (editStay) {
        const order = parseJsonArray(editStay.visit.photo_ids_json);
        const byId = new Map(editStay.photos.map((p) => [p.photo_id, p]));
        const photos = order.map((id) => byId.get(id)).filter((p): p is Photo => !!p && !p.deleted);
        return draftFromVisit(editStay.visit, photos, me);
      }
      const d = emptyDraft(today());
      if (presetHotel) {
        const last = [...getState().visits.values()].filter((v) => v.hotel_id === presetHotel.hotel_id && !v.deleted).sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null;
        return { ...d, ...revisitDefaults(last), hotel: { kind: 'existing', hotel_id: presetHotel.hotel_id } as HotelChoice, step: 1, reached: 1 };
      }
      return d;
    })();
    void loadDraft(draftId)
      .catch(() => null)
      .then((rec) => {
        if (!alive) return;
        const stored = reviveDraft(rec?.data);
        setBase(fresh);
        if (stored && isDirty(stored, fresh)) {
          if (editId) setDraft(stored);
          else {
            setDraft(fresh);
            setResume(stored);
          }
        } else setDraft(fresh);
      });
    return () => {
      alive = false;
    };
  }, [ready, draft, missingEdit, editId, editStay, presetHotel, draftId, me]);

  const dirty = !!draft && !!base && isDirty(draft, base);

  // Autosave (debounced). A pending "pick up where we left off?" keeps the old draft untouched.
  useEffect(() => {
    if (!draft || !base || resume || celebration || saving) return;
    const t = setTimeout(() => {
      if (isDirty(draft, base)) {
        void saveDraft(draftId, draft).then(() => setSavedFlash(true));
      } else void deleteDraft(draftId).catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [draft, base, resume, celebration, saving, draftId]);
  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 1600);
    return () => clearTimeout(t);
  }, [savedFlash]);

  const update = useCallback((patch: Patch) => {
    setDraft((d) => (d ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d));
    setProblem(null);
    setResume(null);
  }, []);

  const goTo = (i: number) => {
    update((d) => ({ step: i, reached: Math.max(d.reached, i) }));
    bodyRef.current?.scrollIntoView({ block: 'start' });
  };

  // Leave the route after the sheet's close animation.
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => goBack('/'), EXIT_MS);
    return () => clearTimeout(t);
  }, [leaving]);
  const close = (discard: boolean) => {
    if (discard && !resume) void deleteDraft(draftId).catch(() => undefined);
    setConfirm(false);
    setOpen(false);
    setLeaving(true);
  };

  const pickHotel = (choice: HotelChoice) => {
    const last =
      choice.kind === 'existing' && !editId
        ? [...getState().visits.values()].filter((v) => v.hotel_id === choice.hotel_id && !v.deleted).sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null
        : null;
    update((d) => ({ hotel: choice, ...revisitDefaults(last), step: 1, reached: Math.max(d.reached, 1) }));
  };

  const next = () => {
    if (!draft) return;
    const p = stepProblem(draft, STEPS[draft.step]);
    if (p) return setProblem(p);
    goTo(Math.min(LAST, draft.step + 1));
  };

  const save = async () => {
    if (!draft || saving) return;
    for (let i = 0; i < STEPS.length; i++) {
      const p = stepProblem(draft, STEPS[i]);
      if (p) {
        goTo(i);
        setProblem(p);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await saveStay(draft, me, editStay?.visit ?? null);
      await deleteDraft(draftId).catch(() => undefined);
      const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || !sync.online;
      const message = offline ? 'Saved on this phone, will sync' : 'Stay saved';
      if (editId) {
        toast.show({ message, tone: 'success' });
        close(false);
        return;
      }
      const prev = checkMilestones(res.before, []);
      const reached = checkMilestones(res.after, prev);
      const stay = res.after.find((x) => x.visit.visit_id === res.visit.visit_id);
      const hotels = new Set(res.after.map((x) => x.hotel.hotel_id)).size;
      const visitId = res.visit.visit_id;
      setOpen(false);
      setCelebration({
        from: res.hotelIsNew ? hotels - 1 : res.after.length - 1,
        to: res.hotelIsNew ? hotels : res.after.length,
        unit: res.hotelIsNew ? (hotels === 1 ? 'hotel together' : 'hotels together') : 'stays together',
        stayNumber: stay?.stayNumber ?? res.after.length,
        hotelName: stay?.hotel.name ?? '',
        lat: stay?.hotel.lat ?? 0,
        lng: stay?.hotel.lng ?? 0,
        finish: () => {
          toast.show({ message, tone: 'success' });
          if (reached.length) showMilestoneUnlock(reached);
          if (background === '/') goBack('/');
          else navigate(`/stay/${encodeURIComponent(visitId)}`, { replace: true });
        },
      });
    } catch {
      setSaving(false);
      toast.show({ tone: 'error', message: "We couldn't save that stay. It's still here, so try again." });
    }
  };

  const step = draft?.step ?? 0;
  const stepId = STEPS[step];
  const title = editId ? 'Edit our stay' : 'Add a stay';

  let body: ReactNode;
  if (missingEdit) {
    body = <EmptyState title="Can't find that stay" body="It may have been deleted on the other phone. Our other stays are safe." action={<Button onClick={() => close(false)}>Back to our stays</Button>} />;
  } else if (!draft) {
    body = (
      <div className={s.state} style={{ justifyContent: 'center', padding: 'var(--space-10) 0' }}>
        <ClockLoader label="Opening our diary" />
      </div>
    );
  } else {
    body = (
      <>
        {resume ? <ResumeCard draft={resume} onContinue={() => (setDraft(resume), setResume(null))} onFresh={() => (setResume(null), void deleteDraft(draftId))} /> : null}
        {stepId === 'hotel' ? <HotelStep choice={draft.hotel} onPick={pickHotel} onClear={() => update({ hotel: null })} autoHere={here && !draft.hotel} /> : null}
        {stepId === 'when' ? <WhenStep d={draft} update={update} problem={problem} /> : null}
        {stepId === 'what' ? <WhatStep d={draft} update={update} /> : null}
        {stepId === 'photos' ? <PhotosStep d={draft} update={update} /> : null}
        {stepId === 'good' ? <GoodPartStep d={draft} update={update} me={me} /> : null}
        {problem && stepId !== 'when' ? (
          <p className={s.problem} role="alert">
            {problem === 'hotelRequired' ? 'Add a hotel to continue.' : null}
          </p>
        ) : null}
      </>
    );
  }

  const footer =
    draft && !missingEdit ? (
      <div className={s.footer}>
        {step > 0 ? (
          <Button variant="secondary" icon={<IconBack size={18} />} onClick={() => goTo(step - 1)}>
            Back
          </Button>
        ) : null}
        {step < LAST ? (
          <Button onClick={next} data-testid="step-next">
            {stepId === 'photos' && draft.photos.length === 0 ? 'Skip' : 'Next'}
          </Button>
        ) : (
          <Button busy={saving} onClick={() => void save()} data-testid="save-stay">
            {editId ? 'Save changes' : 'Save our stay'}
          </Button>
        )}
      </div>
    ) : null;

  return (
    <>
      <BottomSheet
        open={open}
        onClose={() => close(true)}
        onDismissAttempt={() => setConfirm(true)}
        dismissible={!dirty}
        title={title}
        hideTitle
        className={s.sheetPanel}
        headerExtra={
          <div className={s.stepHead}>
            <span className={s.stepTitle}>{missingEdit || !draft ? title : STEP_TITLES[stepId]}</span>
            {draft && !missingEdit ? (
              <span className={s.stepCount} data-testid="step-count">
                {step + 1}/{STEPS.length}
              </span>
            ) : null}
            <span className={s.saved} style={{ opacity: savedFlash ? 1 : 0 }} aria-hidden={!savedFlash}>
              Draft saved
            </span>
          </div>
        }
        footer={footer}
      >
        <div className={s.body} ref={bodyRef} data-step={stepId}>
          {draft && !missingEdit ? (
            <div className={s.progress} role="group" aria-label="Steps">
              {STEPS.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  className={s.progressSeg}
                  data-done={i <= step}
                  disabled={i > draft.reached || i === step}
                  aria-label={`${STEP_TITLES[id]}, step ${i + 1} of ${STEPS.length}`}
                  aria-current={i === step ? 'step' : undefined}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
          ) : null}
          {body}
        </div>
      </BottomSheet>
      {confirm ? <DiscardConfirm onKeep={() => setConfirm(false)} onDiscard={() => close(true)} /> : null}
      {celebration ? <Celebration {...celebration} onDone={celebration.finish} /> : null}
    </>
  );
}

function ResumeCard({ draft, onContinue, onFresh }: { draft: AddStayDraft; onContinue(): void; onFresh(): void }) {
  const existing = useHotel(draft.hotel?.kind === 'existing' ? draft.hotel.hotel_id : null);
  const name = draft.hotel?.kind === 'new' ? draft.hotel.hotel.name : existing?.name;
  return (
    <div className={s.card} style={{ marginBottom: 'var(--space-5)' }} data-testid="resume-draft">
      <h3 className={s.cardTitle}>Pick up where we left off?</h3>
      {name ? <p className={s.cardBody}>We saved a draft stay at {name}.</p> : null}
      <div className={s.cardActions}>
        <Button onClick={onContinue}>Continue</Button>
        <Button variant="ghost" onClick={onFresh}>
          Start fresh
        </Button>
      </div>
    </div>
  );
}

function DiscardConfirm({ onKeep, onDiscard }: { onKeep(): void; onDiscard(): void }) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    keepRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onKeep();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onKeep]);
  return (
    <div className={s.confirmLayer} onClick={onKeep}>
      <div className={s.confirm} role="alertdialog" aria-modal="true" aria-labelledby="discard-title" aria-describedby="discard-body" onClick={(e) => e.stopPropagation()}>
        <h3 id="discard-title" className={s.cardTitle}>
          Discard this stay?
        </h3>
        <p id="discard-body" className={s.cardBody}>
          We'll lose everything entered so far.
        </p>
        <div className={s.cardActions}>
          <Button variant="secondary" onClick={onDiscard}>
            Discard
          </Button>
          <Button ref={keepRef} onClick={onKeep}>
            Keep editing
          </Button>
        </div>
      </div>
    </div>
  );
}
