/**
 * Steps 2, 3 and 5: When, What we did, The good part.
 */
import { ChipGroup } from '@/components/Chip';
import { IconCalendar, IconMinus, IconPlus, IconStar } from '@/components/icons';
import { MOODS as STAMPS, MoodStamp } from '@/components/brand/MoodStamps';
import { otherPerson, personName, type PersonId } from '@/config/couple';
import { BOOKED_VIA, VISIT_TYPES, type BookedVia, type Rating, type VisitType } from '@/data/types';
import { addDays, formatDate, isIsoDate, today } from '@/lib/dates';
import { durationLabel, NIGHT_TYPES, PROBLEM_COPY, type AddStayDraft, type StepProblem } from './draft';
import s from './AddStay.module.css';

type Update = (patch: Partial<AddStayDraft>) => void;

/** Display labels. The platform's name stays off-screen (design/copy.md: only the About credit). */
export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  Dayuse: 'Day use',
  Staycation: 'Staycation',
  Overnight: 'Overnight',
  'Pool day': 'Pool day',
  Spa: 'Spa',
  'Brunch or dinner': 'Brunch or dinner',
  Other: 'Something else',
};
export const BOOKED_VIA_LABELS: Record<BookedVia, string> = {
  Dayuse: 'Day-use app',
  Direct: 'Direct',
  'Booking.com': 'Booking.com',
  Other: 'Somewhere else',
};

/** Dayuse-style slots. */
const CHECK_IN_SLOTS = ['10:00', '14:00', '20:00'];
const CHECK_OUT_SLOTS = ['12:00', '18:00', '22:00'];

export function WhenStep({ d, update, problem }: { d: AddStayDraft; update: Update; problem: StepProblem }) {
  const t = today();
  const duration = durationLabel(d.check_in, d.check_out, d.nights);
  const showNights = d.nights > 0 || NIGHT_TYPES.includes(d.visit_type);
  const bumpNights = (n: number) => {
    const nights = Math.max(0, Math.min(30, n));
    const patch: Partial<AddStayDraft> = { nights };
    if (nights > 0 && !NIGHT_TYPES.includes(d.visit_type)) patch.visit_type = 'Overnight';
    if (nights === 0 && NIGHT_TYPES.includes(d.visit_type)) patch.visit_type = 'Dayuse';
    update(patch);
  };
  return (
    <div>
      <p className={s.helper}>Today's fine, or pick another date.</p>
      <div className={s.group}>
        <label className={s.label} htmlFor="stay-date">
          Date
        </label>
        <div className={s.dateField}>
          <span className={s.searchIcon} style={{ position: 'static', transform: 'none' }} aria-hidden="true">
            <IconCalendar size={18} />
          </span>
          <span data-testid="date-display">{isIsoDate(d.date) ? formatDate(d.date) : 'Pick a date'}</span>
          <input
            id="stay-date"
            className={s.dateNative}
            type="date"
            value={d.date}
            max={addDays(t, 1)}
            onChange={(e) => update({ date: e.target.value })}
            aria-invalid={problem === 'dateRequired'}
          />
        </div>
        <div className={s.chips}>
          <ChipGroup
            label="Quick dates"
            options={[
              { value: t, label: 'Today' },
              { value: addDays(t, -1), label: 'Yesterday' },
            ]}
            value={d.date === t || d.date === addDays(t, -1) ? d.date : null}
            onChange={(v) => typeof v === 'string' && update({ date: v })}
          />
        </div>
      </div>
      <div className={`${s.row} ${s.group}`}>
        <TimeField id="check-in" label="Check-in" value={d.check_in} slots={CHECK_IN_SLOTS} onChange={(v) => update({ check_in: v })} invalid={problem === 'badTime' || problem === 'checkOutBeforeCheckIn'} />
        <TimeField id="check-out" label="Check-out" value={d.check_out} slots={CHECK_OUT_SLOTS} onChange={(v) => update({ check_out: v })} invalid={problem === 'badTime' || problem === 'checkOutBeforeCheckIn'} />
      </div>
      {duration ? (
        <div className={s.preview} data-testid="time-preview">
          {d.check_in.trim()} → {d.check_out.trim()} · {duration}
        </div>
      ) : null}
      {showNights ? (
        <div className={s.group}>
          <span className={s.label} id="nights-label">
            Nights
          </span>
          <div className={s.stepper} role="group" aria-labelledby="nights-label">
            <button type="button" className={s.stepperBtn} aria-label="One night fewer" disabled={d.nights <= 0} onClick={() => bumpNights(d.nights - 1)}>
              <IconMinus size={18} />
            </button>
            <span className={s.stepperValue} aria-live="polite">
              {d.nights}
            </span>
            <button type="button" className={s.stepperBtn} aria-label="One more night" onClick={() => bumpNights(d.nights + 1)}>
              <IconPlus size={18} />
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={s.linkBtn} onClick={() => bumpNights(1)}>
          We stayed the night
        </button>
      )}
      {problem ? <p className={s.problem} role="alert">{PROBLEM_COPY[problem]}</p> : null}
    </div>
  );
}

function TimeField({ id, label, value, slots, onChange, invalid }: { id: string; label: string; value: string; slots: string[]; onChange(v: string): void; invalid: boolean }) {
  return (
    <div>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`${s.input} ${s.mono}`}
        inputMode="numeric"
        placeholder="HH:mm"
        maxLength={5}
        autoComplete="off"
        value={value}
        aria-invalid={invalid && !!value}
        onChange={(e) => onChange(autoColon(e.target.value, value))}
      />
      <div className={s.chips}>
        <ChipGroup label={`${label} times`} options={slots.map((v) => ({ value: v, label: v }))} value={slots.includes(value) ? value : null} allowEmpty onChange={(v) => onChange(typeof v === 'string' ? v : '')} />
      </div>
    </div>
  );
}

/** "1430" → "14:30" as you type; deleting keeps working. */
function autoColon(next: string, prev: string): string {
  const digits = next.replace(/[^\d:]/g, '');
  if (next.length < prev.length) return digits;
  if (/^\d{3,4}$/.test(digits)) return `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`;
  if (/^\d{2}$/.test(digits) && +digits <= 23) return `${digits}:`;
  return digits.slice(0, 5);
}

export function WhatStep({ d, update }: { d: AddStayDraft; update: Update }) {
  return (
    <div>
      <div className={s.group}>
        <span className={s.label}>What we did</span>
        <ChipGroup
          label="What we did"
          options={VISIT_TYPES.map((v) => ({ value: v, label: VISIT_TYPE_LABELS[v] }))}
          value={d.visit_type}
          onChange={(v) => {
            if (typeof v !== 'string') return;
            const visit_type = v as VisitType;
            const nights = NIGHT_TYPES.includes(visit_type) ? Math.max(1, d.nights) : 0;
            update({ visit_type, nights });
          }}
        />
      </div>
      <div className={s.group}>
        <span className={s.label}>Booked through</span>
        <ChipGroup
          label="Booked through"
          options={BOOKED_VIA.map((v) => ({ value: v, label: BOOKED_VIA_LABELS[v] }))}
          value={d.booked_via}
          allowEmpty
          onChange={(v) => update({ booked_via: typeof v === 'string' ? (v as BookedVia) : null })}
        />
      </div>
    </div>
  );
}

export function GoodPartStep({ d, update, me }: { d: AddStayDraft; update: Update; me: PersonId }) {
  const other = otherPerson(me);
  return (
    <div>
      <div className={s.group}>
        <label className={s.label} htmlFor="stay-note">
          Note
        </label>
        <textarea id="stay-note" className={s.input} placeholder="What do we want to remember?" value={d.note} onChange={(e) => update({ note: e.target.value })} rows={3} />
      </div>
      <div className={s.group}>
        <label className={s.label} htmlFor="stay-moment">
          Favourite moment
        </label>
        <input id="stay-moment" className={s.input} placeholder="Favourite moment" value={d.favourite_moment} onChange={(e) => update({ favourite_moment: e.target.value })} />
      </div>
      <div className={s.group}>
        <span className={s.label} id="mood-label">
          Mood
        </span>
        <div className={s.moods} role="group" aria-labelledby="mood-label">
          {STAMPS.map((m) => {
            const on = d.mood === m.id;
            return (
              <button key={m.id} type="button" className={s.mood} aria-pressed={on} onClick={() => update({ mood: on ? null : m.id })}>
                <MoodStamp mood={m.id} size={56} selected={on} title="" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className={s.group}>
        <span className={s.label} id="rating-label">
          My rating
        </span>
        <div className={s.stars} role="radiogroup" aria-labelledby="rating-label">
          {([1, 2, 3, 4, 5] as Rating[]).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={d.rating === n}
              aria-label={`${n} of 5`}
              className={s.star}
              data-filled={d.rating != null && n <= d.rating}
              onClick={() => update({ rating: d.rating === n ? null : n })}
            >
              <IconStar size={30} />
            </button>
          ))}
        </div>
        <p className={s.hint}>{personName(other)} can add theirs later.</p>
      </div>
      <div className={s.group}>
        <span className={s.label}>Who picked it</span>
        <ChipGroup
          label="Who picked it"
          options={[
            { value: 'nirsh', label: 'Nirsh' },
            { value: 'shady', label: 'Shady' },
            { value: 'both', label: 'Both of us' },
          ]}
          value={d.picked_by}
          allowEmpty
          onChange={(v) => update({ picked_by: typeof v === 'string' ? (v as AddStayDraft['picked_by']) : null })}
        />
      </div>
    </div>
  );
}
