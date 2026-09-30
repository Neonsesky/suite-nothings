import type { ButtonHTMLAttributes, ReactNode } from 'react';
import s from './Chip.module.css';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  selected?: boolean;
  icon?: ReactNode;
}

/** Selectable pill (city tabs, filters, visit types). */
export function Chip({ selected = false, icon, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button type={type} className={[s.chip, selected ? s.selected : '', className ?? ''].join(' ')} aria-pressed={selected} {...rest}>
      {icon ? <span className={s.icon} aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
}

export interface ChipOption<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export interface ChipGroupProps<V extends string> {
  options: readonly ChipOption<V>[];
  /** Single select: V | null. Multi: V[]. */
  value: V | null | readonly V[];
  onChange(next: V | null | V[]): void;
  multiple?: boolean;
  /** Allow deselecting in single mode (value → null). */
  allowEmpty?: boolean;
  label: string;
  /** Horizontal scroll row (city tabs) vs wrapping. */
  scroll?: boolean;
  className?: string;
}

/** Group of chips with single or multi select. Arrow keys move focus in scroll mode. */
export function ChipGroup<V extends string>({ options, value, onChange, multiple, allowEmpty, label, scroll, className }: ChipGroupProps<V>) {
  const selected = (v: V) => (Array.isArray(value) ? value.includes(v) : value === v);
  const toggle = (v: V) => {
    if (multiple) {
      const arr = Array.isArray(value) ? [...(value as V[])] : [];
      onChange(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    } else {
      onChange(value === v && allowEmpty ? null : v);
    }
  };
  return (
    <div
      role="group"
      aria-label={label}
      className={[s.group, scroll ? s.scroll : '', className ?? ''].join(' ')}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const buttons = Array.from(e.currentTarget.querySelectorAll('button'));
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (i < 0) return;
        const next = buttons[(i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
        next?.focus();
        e.preventDefault();
      }}
    >
      {options.map((o) => (
        <Chip key={o.value} selected={selected(o.value)} icon={o.icon} onClick={() => toggle(o.value)}>
          {o.label}
          {o.count != null ? <span className={s.count}>{o.count}</span> : null}
        </Chip>
      ))}
    </div>
  );
}
