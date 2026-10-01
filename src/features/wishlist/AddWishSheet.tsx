/** Add a wish: Photon search (or by hand), a note, priority and whose wish it is. */
import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { IconPin, IconSearch } from '@/components/icons';
import { PEOPLE, personName, type PersonId } from '@/config/couple';
import { upsertWish, useMe, useSettings } from '@/data/store';
import { GeocodeError, searchPlaces, type PlaceResult } from '@/lib/geocode';
import { toast } from '@/lib/toast';
import { PRIORITY_LABELS } from './logic';
import s from './Wishlist.module.css';

type Status = 'idle' | 'loading' | 'done' | 'error' | 'offline';

export function AddWishSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const me = useMe();
  const home = useSettings().home_base;
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [manual, setManual] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [by, setBy] = useState<PersonId | null>(me);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || manual || place) return;
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setStatus('loading');
      try {
        const r = await searchPlaces(term, { near: home, signal: ctrl.signal, limit: 8 });
        if (!ctrl.signal.aborted) {
          setResults(r);
          setStatus('done');
        }
      } catch (e) {
        if (ctrl.signal.aborted || (e instanceof GeocodeError && e.code === 'aborted')) return;
        setStatus(navigator.onLine === false ? 'offline' : 'error');
      }
    }, 350);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [q, open, manual, place, home]);

  const searching = q.trim().length >= 2;
  const finalName = place ? place.name : name.trim();
  const canSave = finalName.length > 0;

  const save = async () => {
    setTried(true);
    if (!canSave) return;
    setSaving(true);
    try {
      await upsertWish({
        name: finalName,
        lat: place?.lat ?? null,
        lng: place?.lng ?? null,
        city: (place ? place.city ?? place.region : city.trim()) || null,
        country: (place ? place.country : country.trim()) || null,
        note: note.trim() || null,
        priority,
        added_by: by,
      });
      toast.show({ message: 'Added to Next check-ins', tone: 'success' });
      onClose();
    } catch {
      toast.show({ message: "We couldn't save that wish. It's still here, so try again.", tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Add a wish"
      footer={
        <Button block onClick={() => void save()} busy={saving} disabled={saving} data-testid="save-wish">
          Add to our wishlist
        </Button>
      }
    >
      <div className={s.form}>
        {place ? (
          <div className={s.picked} data-testid="wish-picked">
            <IconPin size={20} />
            <span>
              <strong>{place.name}</strong>
              <span>{[place.city ?? place.region, place.country].filter(Boolean).join(', ')}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={() => setPlace(null)}>
              Change
            </Button>
          </div>
        ) : manual ? (
          <>
            <label className={s.label}>
              Hotel name
              <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={tried && !canSave} autoComplete="off" placeholder="Where we'd love to stay" />
            </label>
            {tried && !canSave ? <p className={s.problem}>Give the hotel a name so we know what we're wishing for.</p> : null}
            <div className={s.row}>
              <label className={s.label}>
                City
                <input className={s.input} value={city} onChange={(e) => setCity(e.target.value)} autoComplete="off" />
              </label>
              <label className={s.label}>
                Country
                <input className={s.input} value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="off" />
              </label>
            </div>
            <button type="button" className={s.textLink} onClick={() => setManual(false)}>
              Search instead
            </button>
          </>
        ) : (
          <>
            <label className={s.label}>
              Find the hotel
              <span className={s.search}>
                <IconSearch size={18} aria-hidden="true" />
                <input
                  ref={inputRef}
                  className={s.searchInput}
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Hotel name or city"
                  autoComplete="off"
                  enterKeyHint="search"
                  aria-invalid={tried && !canSave}
                />
              </span>
            </label>
            {tried && !canSave ? <p className={s.problem}>Pick a hotel from the list, or add it by hand.</p> : null}
            <div className={s.results} aria-live="polite" aria-busy={status === 'loading'} hidden={!searching}>
              {status === 'loading' ? <p className={s.hint}>Looking around…</p> : null}
              {status === 'offline' ? <p className={s.hint}>We're offline, so search is napping. Add it by hand and we'll keep it.</p> : null}
              {status === 'error' ? <p className={s.hint}>Hotel search didn't answer. Try again in a moment, or add it by hand.</p> : null}
              {status === 'done' && !results.length ? <p className={s.hint}>Nothing by that name. Try the city too, or add it by hand.</p> : null}
              {results.length ? (
                <ul className={s.resultList} role="list">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button type="button" className={s.result} onClick={() => setPlace(r)}>
                        <IconPin size={18} aria-hidden="true" />
                        <span>
                          <strong>{r.name}</strong>
                          <span>{r.address ?? [r.city, r.country].filter(Boolean).join(', ')}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button
              type="button"
              className={s.textLink}
              onClick={() => {
                setName(q.trim());
                setManual(true);
              }}
            >
              Add it by hand
            </button>
          </>
        )}

        <label className={s.label}>
          Why this one?
          <textarea className={`${s.input} ${s.textarea}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The rooftop pool, obviously" rows={2} />
        </label>

        <fieldset className={s.fieldset}>
          <legend className={s.legend}>How soon</legend>
          <div className={s.chips}>
            {([1, 2, 3] as const).map((p) => (
              <Chip key={p} selected={priority === p} onClick={() => setPriority(p)}>
                {PRIORITY_LABELS[p]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className={s.fieldset}>
          <legend className={s.legend}>Whose wish</legend>
          <div className={s.chips}>
            {PEOPLE.map((p) => (
              <Chip key={p} selected={by === p} onClick={() => setBy(p)}>
                {personName(p)}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>
    </BottomSheet>
  );
}
