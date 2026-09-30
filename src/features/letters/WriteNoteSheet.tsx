/** "Write a future note": title, body and the rule that opens it, saved through the store. */
import { useId, useState, type FormEvent } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/Chip';
import { otherPerson, personName } from '@/config/couple';
import { upsertLetter, useMe } from '@/data/store';
import type { UnlockRule } from '@/data/types';
import { useMarkBusy } from '@/lib/busy';
import { addDays, today } from '@/lib/dates';
import { toast } from '@/lib/toast';
import { unlockHint } from './unlock';
import s from './Letters.module.css';

type Kind = 'always' | 'visits' | 'hotels' | 'first_abroad' | 'date';
const KINDS: { value: Kind; label: string }[] = [
  { value: 'always', label: 'Right away' },
  { value: 'hotels', label: 'At N hotels' },
  { value: 'visits', label: 'On stay N' },
  { value: 'first_abroad', label: 'First stay abroad' },
  { value: 'date', label: 'On a date' },
];

export function buildRule(kind: Kind, n: number, date: string): UnlockRule {
  switch (kind) {
    case 'always':
      return 'always';
    case 'first_abroad':
      return 'first_abroad';
    case 'visits':
      return `visits>=${n}`;
    case 'hotels':
      return `hotels>=${n}`;
    case 'date':
      return `date>=${date}`;
  }
}

export function WriteNoteSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const me = useMe() ?? 'nirsh';
  const to = otherPerson(me);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<Kind>('hotels');
  const [n, setN] = useState(25);
  const [date, setDate] = useState(() => addDays(today(), 365));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { title: useId(), body: useId(), n: useId(), date: useId(), err: useId() };
  useMarkBusy(open, 'write-note');

  const rule = buildRule(kind, n, date);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return setError('A note needs a title and a few words inside.');
    if ((kind === 'visits' || kind === 'hotels') && (!Number.isInteger(n) || n < 1)) return setError('Pick a number of 1 or more.');
    if (kind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Pick the day it should open.');
    setSaving(true);
    try {
      await upsertLetter({ title: title.trim(), body_md: body, to, from: me, unlock_rule: rule, written_at: today() });
      toast.show({ tone: 'love', message: `Note tucked away for ${personName(to)}` });
      setTitle('');
      setBody('');
      onClose();
    } catch {
      setError("We couldn't save the note on this phone. Check there's free space and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title="Write a future note"
      desktop="center"
      footer={
        <Button type="submit" form="write-note" block busy={saving}>
          Seal the note
        </Button>
      }
    >
      <form id="write-note" className={s.form} onSubmit={submit} aria-describedby={error ? ids.err : undefined}>
        <p className={s.muted}>For {personName(to)}. It stays sealed until the moment you pick.</p>
        <label className={s.field} htmlFor={ids.title}>
          <span className={s.label}>Title</span>
          <input id={ids.title} className={s.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="For our 25th hotel" data-autofocus />
        </label>
        <label className={s.field} htmlFor={ids.body}>
          <span className={s.label}>The note</span>
          <textarea id={ids.body} className={`${s.input} ${s.textarea}`} value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Blank lines start a new paragraph. *Stars* make italics." data-no-drag />
        </label>
        <ChipGroup label="Opens" options={KINDS} value={kind} onChange={(v) => v && setKind(v as Kind)} />
        {kind === 'visits' || kind === 'hotels' ? (
          <label className={s.field} htmlFor={ids.n}>
            <span className={s.label}>{kind === 'hotels' ? 'Number of hotels' : 'Stay number'}</span>
            <input id={ids.n} className={s.input} type="number" inputMode="numeric" min={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
          </label>
        ) : null}
        {kind === 'date' ? (
          <label className={s.field} htmlFor={ids.date}>
            <span className={s.label}>Opens on</span>
            <input id={ids.date} className={s.input} type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
          </label>
        ) : null}
        <p className={s.rulePreview} aria-live="polite">
          {kind === 'always' ? `Opens as soon as ${personName(to)} checks in.` : unlockHint(rule)}
        </p>
        {error ? (
          <p id={ids.err} className={s.error} role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </BottomSheet>
  );
}
