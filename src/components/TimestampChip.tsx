import { formatTimeRange } from '@/lib/dates';
import { IconClock } from './icons';
import s from './TimestampChip.module.css';

export interface TimestampChipProps {
  checkIn: string | null;
  checkOut: string | null;
  /** Shown when both times are missing (e.g. "2 nights"). Nothing renders if absent. */
  fallback?: string;
  className?: string;
}

/** Check-in → check-out chip, e.g. `14:00 → 20:00`. Sits where Dayuse shows the struck price. */
export function TimestampChip({ checkIn, checkOut, fallback, className }: TimestampChipProps) {
  const text = formatTimeRange(checkIn, checkOut) ?? fallback;
  if (!text) return null;
  const label = checkIn && checkOut ? `Checked in ${checkIn}, out ${checkOut}` : text;
  return (
    <span className={[s.chip, className ?? ''].join(' ')} aria-label={label}>
      <IconClock size={14} />
      <span className={s.text}>{text}</span>
    </span>
  );
}
