/** Price level as four ¤ glyphs: the filled ones in ink, the rest in the line colour (SPEC §11.3). */
import type { PriceLevel as Level } from '@/data/types';
import s from './enrichment.module.css';

export function PriceLevel({ value, estimate = false }: { value: Level; estimate?: boolean }) {
  const label = `Price level ${value} of 4${estimate ? ', an estimate' : ''}`;
  return (
    <span className={s.price} role="img" aria-label={label}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} aria-hidden="true" data-on={i <= value || undefined}>
          ¤
        </span>
      ))}
      {estimate ? <span className={s.estimate} aria-hidden="true">estimate</span> : null}
    </span>
  );
}

/** Tap a ¤ to set the level by hand; tap the current one again to clear it. */
export function PricePicker({ value, onChange }: { value: Level | null; onChange(next: Level | null): void }) {
  return (
    <span className={`${s.price} ${s.picker}`} role="radiogroup" aria-label="Price level">
      {([1, 2, 3, 4] as const).map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`Price level ${i} of 4`}
          data-on={(value !== null && i <= value) || undefined}
          onClick={() => onChange(value === i ? null : i)}
        >
          ¤
        </button>
      ))}
    </span>
  );
}
