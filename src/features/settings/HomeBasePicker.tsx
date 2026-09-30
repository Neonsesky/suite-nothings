/**
 * City search + pick, used by Settings (home base) and onboarding (first home base).
 * Signature is a contract with onboarding — don't change it.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useSyncState } from '@/data/store';
import type { HomeBase } from '@/data/types';
import { CitySearchError, searchCities } from './citySearch';
import s from './HomeBasePicker.module.css';

export interface HomeBasePickerProps {
  value: HomeBase;
  onChange(next: HomeBase): void;
  autoFocus?: boolean;
}

const DEBOUNCE_MS = 300;

export function HomeBasePicker({ value, onChange, autoFocus }: HomeBasePickerProps) {
  const { online } = useSyncState();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HomeBase[]>([]);
  const [errored, setErrored] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const baseId = useId();
  const listboxId = `${baseId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const searchable = query.trim().length >= 2 && online;

  useEffect(() => {
    if (!searchable) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchCities(query, { signal: ctrl.signal })
        .then((r) => {
          setResults(r);
          setErrored(false);
          setActiveIndex(r.length ? 0 : -1);
        })
        .catch((e) => {
          if (e instanceof CitySearchError && e.code === 'aborted') return;
          setResults([]);
          setErrored(true);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `searchable` is derived from query+online
  }, [query, online]);

  // Derived, not stored: stale `results`/`errored` from a previous query never show once the
  // query is too short or we've gone offline.
  const visibleResults = searchable ? results : [];
  const showError = searchable && errored;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (visibleResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i < 0 ? 0 : i + 1, visibleResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = visibleResults[activeIndex];
      if (pick) onChange(pick);
    }
  };

  return (
    <div className={s.root}>
      <label className={s.label} htmlFor={`${baseId}-input`}>
        Search for a city
      </label>
      <input
        id={`${baseId}-input`}
        ref={inputRef}
        className={s.input}
        type="text"
        role="combobox"
        aria-expanded={visibleResults.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${baseId}-opt-${activeIndex}` : undefined}
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="City name"
        data-autofocus={autoFocus ? true : undefined}
      />
      {!online ? (
        <p className={s.offline} role="status">
          Offline. City search needs a connection. Your current home base stays put.
        </p>
      ) : showError ? (
        <p className={s.error} role="alert">
          Can&rsquo;t reach the internet. We&rsquo;ll keep everything here until it&rsquo;s back.
        </p>
      ) : null}
      <ul className={s.list} role="listbox" id={listboxId} aria-label="City results">
        <li className={s.item}>
          <button type="button" className={`${s.itemButton} ${s.currentButton}`} onClick={() => onChange(value)}>
            Keep {value.city}
            {value.country ? <span className={s.itemCountry}>, {value.country}</span> : null}
          </button>
        </li>
        {visibleResults.map((r, i) => (
          <li key={`${r.city}|${r.country}|${i}`} className={s.item}>
            <button
              type="button"
              id={`${baseId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={[s.itemButton, i === activeIndex ? s.active : ''].join(' ')}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => onChange(r)}
            >
              {r.city}
              <span className={s.itemCountry}>, {r.country}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default HomeBasePicker;
