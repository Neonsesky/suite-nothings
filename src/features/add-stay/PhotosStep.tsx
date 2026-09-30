/**
 * Step 4, Photos: pick from the library or the camera, EXIF read first (date + place suggestion),
 * resized on this phone (480 px thumb, 1600 px full, EXIF stripped), reorder, remove, caption.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { ClockLoader } from '@/components/ClockLoader';
import { IconBack, IconCamera, IconChevron, IconClose, IconPlus } from '@/components/icons';
import { getState, useHotel, usePhotoUrl } from '@/data/store';
import { formatDate } from '@/lib/dates';
import { readExif, suggestFromExif, type ExifInfo, type ExifSuggestion } from '@/lib/exif';
import { haversineKm } from '@/lib/geo';
import { reverse } from '@/lib/geocode';
import { processImage } from '@/lib/image';
import { toast } from '@/lib/toast';
import { ulid } from '@/lib/ulid';
import type { AddStayDraft, DraftPhoto } from './draft';
import s from './AddStay.module.css';

type Update = (patch: Partial<AddStayDraft> | ((d: AddStayDraft) => Partial<AddStayDraft>)) => void;

export function PhotosStep({ d, update }: { d: AddStayDraft; update: Update }) {
  const [pending, setPending] = useState<string[]>([]);
  const existingHotel = useHotel(d.hotel?.kind === 'existing' ? d.hotel.hotel_id : null);
  const hotelAt = d.hotel?.kind === 'new' ? d.hotel.hotel : existingHotel;

  const addFiles = async (files: FileList | null) => {
    const list = files ? Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name)) : [];
    if (!list.length) return;
    const keys = list.map(() => ulid());
    setPending((p) => [...p, ...keys]);
    let failed = 0;
    // One at a time keeps memory flat on phones with 12 MP photos.
    for (let i = 0; i < list.length; i++) {
      try {
        const exif: ExifInfo = await readExif(list[i]);
        const out = await processImage(list[i], { exif });
        const photo: DraftPhoto = {
          key: keys[i],
          photo_id: null,
          thumb: out.thumb,
          full: out.full,
          width: out.width,
          height: out.height,
          taken_at: out.taken_at,
          caption: '',
          gps: exif.lat != null && exif.lng != null ? { lat: exif.lat, lng: exif.lng } : null,
        };
        update((cur) => ({ photos: [...cur.photos, photo] }));
      } catch {
        failed += 1;
      } finally {
        setPending((p) => p.filter((k) => k !== keys[i]));
      }
    }
    if (failed) toast.show({ tone: 'error', message: failed === 1 ? "One photo wouldn't open. Try a JPEG or PNG." : `${failed} photos wouldn't open. Try JPEG or PNG.` });
  };

  const move = (i: number, dir: -1 | 1) =>
    update((cur) => {
      const photos = [...cur.photos];
      const j = i + dir;
      if (j < 0 || j >= photos.length) return {};
      [photos[i], photos[j]] = [photos[j], photos[i]];
      return { photos };
    });
  const remove = (key: string) => update((cur) => ({ photos: cur.photos.filter((p) => p.key !== key) }));
  const caption = (key: string, text: string) => update((cur) => ({ photos: cur.photos.map((p) => (p.key === key ? { ...p, caption: text } : p)) }));

  const suggestion = useMemo(() => {
    if (d.exifAnswered) return null;
    const infos: ExifInfo[] = d.photos
      .filter((p) => !p.photo_id)
      .map((p) => ({
        takenAt: p.taken_at,
        date: p.taken_at ? p.taken_at.slice(0, 10) : null,
        time: p.taken_at ? p.taken_at.slice(11, 16) : null,
        lat: p.gps?.lat ?? null,
        lng: p.gps?.lng ?? null,
        orientation: null,
      }));
    return suggestFromExif(infos, { date: d.date, lat: hotelAt?.lat ?? null, lng: hotelAt?.lng ?? null });
  }, [d.photos, d.date, d.exifAnswered, hotelAt?.lat, hotelAt?.lng]);

  const applySuggestion = (sg: ExifSuggestion) => {
    const patch: Partial<AddStayDraft> = { exifAnswered: true };
    if (sg.date) patch.date = sg.date;
    // A hand-dropped pin moves to where the photos were taken; searched hotels keep their spot.
    if (d.hotel?.kind === 'new' && d.hotel.hotel.source === 'manual' && sg.lat != null && sg.lng != null) {
      patch.hotel = { kind: 'new', hotel: { ...d.hotel.hotel, lat: sg.lat, lng: sg.lng } };
    }
    update(patch);
  };

  return (
    <div>
      <p className={s.helper}>Add a few, or skip for now.</p>
      <div className={s.photoGrid}>
        {d.photos.map((p, i) => (
          <div key={p.key} className={s.photoCell} data-testid="photo-cell">
            <div className={s.photoTile}>
              <PhotoThumb photo={p} />
              <button type="button" className={s.photoRemove} aria-label={`Remove photo ${i + 1}`} onClick={() => remove(p.key)}>
                <IconClose size={14} />
              </button>
              <div className={s.photoTools}>
                <button type="button" className={s.photoTool} aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <IconBack size={14} />
                </button>
                <button type="button" className={s.photoTool} aria-label={`Move photo ${i + 1} later`} disabled={i === d.photos.length - 1} onClick={() => move(i, 1)}>
                  <IconChevron size={14} />
                </button>
              </div>
            </div>
            <input className={`${s.input} ${s.caption}`} placeholder="Caption" aria-label={`Caption for photo ${i + 1}`} value={p.caption} onChange={(e) => caption(p.key, e.target.value)} readOnly={!!p.photo_id} />
          </div>
        ))}
        {pending.map((k) => (
          <div key={k} className={s.photoCell}>
            <div className={s.photoTile}>
              <div className={s.photoBusy}>
                <ClockLoader size={32} label="Getting the photo ready" />
              </div>
            </div>
          </div>
        ))}
        <label className={s.photoAdd}>
          <IconPlus size={22} />
          Add photos
          <input className={s.hiddenInput} type="file" accept="image/*" multiple onChange={(e) => void addFiles(e.target.files).finally(() => (e.target.value = ''))} data-testid="photo-input" />
        </label>
        <label className={s.photoAdd}>
          <IconCamera size={22} />
          Camera
          <input className={s.hiddenInput} type="file" accept="image/*" capture="environment" onChange={(e) => void addFiles(e.target.files).finally(() => (e.target.value = ''))} />
        </label>
      </div>
      {suggestion ? <ExifCard suggestion={suggestion} hotelName={hotelAt?.name ?? null} hotelAt={hotelAt ?? null} onUse={() => applySuggestion(suggestion)} onKeep={() => update({ exifAnswered: true })} /> : null}
    </div>
  );
}

function PhotoThumb({ photo }: { photo: DraftPhoto }) {
  const saved = usePhotoUrl(photo.photo_id, 'thumb');
  const local = useObjectUrl(photo.thumb);
  const src = photo.thumb ? local : saved;
  return src ? <img src={src} alt={photo.caption || 'Our photo'} /> : <div className={s.photoBusy} />;
}

/** Object URL for a blob, revoked when the blob changes or the tile unmounts. */
function useObjectUrl(blob: Blob | null): string | null {
  const [entry, setEntry] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    let alive = true;
    void Promise.resolve().then(() => alive && setEntry({ blob, url }));
    return () => {
      alive = false;
      URL.revokeObjectURL(url);
    };
  }, [blob]);
  return entry && entry.blob === blob ? entry.url : null;
}

function ExifCard({ suggestion, hotelName, hotelAt, onUse, onKeep }: { suggestion: ExifSuggestion; hotelName: string | null; hotelAt: { lat: number; lng: number } | null; onUse(): void; onKeep(): void }) {
  const place = usePlaceName(suggestion, hotelName, hotelAt);
  const date = suggestion.date ? formatDate(suggestion.date) : null;
  const text = date && place ? `These photos say ${date} at ${place}. Use that?` : date ? `These photos say ${date}. Use that?` : `These photos say ${place ?? 'somewhere new'}. Use that?`;
  return (
    <div className={s.exif} role="status" data-testid="exif-suggestion">
      <p>{text}</p>
      <div className={s.exifActions}>
        <Button variant="secondary" size="sm" onClick={onUse}>
          Use that
        </Button>
        <Button variant="ghost" size="sm" onClick={onKeep}>
          Keep what I entered
        </Button>
      </div>
    </div>
  );
}

/** A short name for where the photos were taken: our hotel, a hotel we know, or Photon's area. */
function usePlaceName(sg: ExifSuggestion, hotelName: string | null, hotelAt: { lat: number; lng: number } | null): string | null {
  const [remote, setRemote] = useState<{ key: string; name: string } | null>(null);
  const key = sg.lat != null && sg.lng != null ? `${sg.lat.toFixed(4)},${sg.lng.toFixed(4)}` : '';
  const local = useMemo(() => {
    if (sg.lat == null || sg.lng == null) return null;
    const at = { lat: sg.lat, lng: sg.lng };
    if (hotelAt && hotelName && haversineKm(at, hotelAt) < 0.5) return hotelName;
    for (const h of getState().hotels.values()) if (!h.deleted && haversineKm(at, h) < 0.3) return h.name;
    return null;
  }, [sg.lat, sg.lng, hotelAt, hotelName]);
  useEffect(() => {
    if (!key || local || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    const ctrl = new AbortController();
    const [lat, lng] = key.split(',').map(Number);
    reverse(lat, lng, { signal: ctrl.signal, timeoutMs: 5000 })
      .then((r) => {
        const name = r ? r.area ?? r.city ?? r.name : null;
        if (name) setRemote({ key, name });
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [key, local]);
  if (local) return local;
  if (remote && remote.key === key) return remote.name;
  return key ? key.split(',').map((n) => Number(n).toFixed(3)).join(', ') : null;
}
