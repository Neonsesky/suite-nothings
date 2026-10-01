/**
 * "Share our journey" (SPEC §10, phase 3): a 1080×1920 story image of the route and stats, and,
 * where the browser can record a canvas, a 9:16 video of the replay. Both go through the Web
 * Share API with files, falling back to a download.
 */
import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { IconDownload, IconPlay, IconShare } from '@/components/icons';
import type { Stay, Wish } from '@/data/types';
import type { SuiteMap } from '@/map/engine';
import { formatDate, today } from '@/lib/dates';
import { formatKm } from '@/lib/geo';
import { toast } from '@/lib/toast';
import { boardDate, postcardLine, type FinaleStats } from './data';
import type { OverlayState } from './export/overlay';
import type { JourneyPlayer } from './player';
import s from './Share.module.css';

interface Props {
  open: boolean;
  onClose(): void;
  stays: readonly Stay[];
  stats: FinaleStats;
  wishes: readonly Wish[];
  engine: SuiteMap | null;
  player: JourneyPlayer | null;
  /** Switches the screen to its 9:16 recording stage (and back). */
  onRecording(on: boolean): void;
}

type Busy = null | 'image' | 'video';

function canRecord(): boolean {
  try {
    return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  } catch {
    return false;
  }
}

export function ShareJourney({ open, onClose, stays, stats, wishes, engine, player, onRecording }: Props) {
  const [busy, setBusy] = useState<Busy>(null);
  const [videoOk, setVideoOk] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const kmText = formatKm(stats.km).replace(/ km$/, '');
  const caption = `Our journey so far: ${kmText} km, ${stats.hotels} ${stats.hotels === 1 ? 'hotel' : 'hotels'}`;

  useEffect(() => {
    if (!open || !canRecord()) return;
    let live = true;
    void import('./export/video').then((v) => live && setVideoOk(v.canRecordVideo() && Boolean(engine)));
    return () => {
      live = false;
    };
  }, [open, engine]);

  const range = stays.length ? `${formatDate(stays[0].visit.date)} – ${formatDate(stays[stays.length - 1].visit.date)}` : '';

  async function saveImage() {
    setBusy('image');
    try {
      const [{ renderStoryImage }, { shareOrDownload, journeyFilename }] = await Promise.all([import('./export/story'), import('./export/share')]);
      const blob = await renderStoryImage({
        stops: stays.map((x) => ({ lat: x.hotel.lat, lng: x.hotel.lng })),
        wishes: wishes.filter((w) => w.lat != null && w.lng != null && !w.fulfilled_visit_id).map((w) => ({ lat: w.lat!, lng: w.lng! })),
        stats: { hotels: stats.hotels, cities: stats.cities, countries: stats.countries, km: kmText },
        range,
        caption,
      });
      const out = await shareOrDownload(blob, journeyFilename('png', today()), { title: 'Our journey', text: caption });
      if (out === 'downloaded') toast.show({ message: 'Story image saved', tone: 'success' });
      if (out === 'failed') toast.show({ message: "Couldn't share this. Try again.", tone: 'error' });
      if (out !== 'cancelled') onClose();
    } catch {
      toast.show({ message: "Couldn't make the image. Try again.", tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function recordVideo() {
    if (!engine || !player) return;
    setBusy('video');
    onClose();
    try {
      const [{ createJourneyRecorder }, { shareOrDownload, journeyFilename }] = await Promise.all([import('./export/video'), import('./export/share')]);
      // Switch to the 9:16 stage; the screen rebuilds the player for the new viewport.
      onRecording(true);
      const p = await waitForPlayer(player);
      const rec = createJourneyRecorder({ source: engine.map.getCanvas() });
      let cancelled = false;
      cancelRef.current = () => {
        cancelled = true;
        rec.cancel();
      };
      const frame = () => rec.frame(overlayFor(p, stays, stats, kmText));
      engine.map.on('render', frame);
      p.seek(0);
      p.setSpeed(2);
      rec.start();
      p.play();
      await new Promise<void>((resolve) => {
        const check = window.setInterval(() => {
          engine.map.triggerRepaint();
          if (cancelled || p.phase === 'end') {
            window.clearInterval(check);
            resolve();
          }
        }, 100);
      });
      // Let the finale breathe for a moment before cutting.
      if (!cancelled) await new Promise((r) => setTimeout(r, 1500));
      engine.map.off('render', frame);
      if (cancelled) return;
      const blob = await rec.stop();
      onRecording(false);
      const out = await shareOrDownload(blob, journeyFilename(rec.ext, today()), { title: 'Our journey', text: caption });
      if (out === 'downloaded') toast.show({ message: 'Video saved', tone: 'success' });
      if (out === 'failed') toast.show({ message: "Couldn't record this. Try again.", tone: 'error' });
    } catch {
      toast.show({ message: "Couldn't record this. Try again.", tone: 'error' });
    } finally {
      cancelRef.current = null;
      onRecording(false);
      setBusy(null);
    }
  }

  // The player instance changes when the stage resizes; resolve the newest one.
  const playerRef = useRef(player);
  useEffect(() => {
    playerRef.current = player;
  }, [player]);
  function waitForPlayer(prev: JourneyPlayer): Promise<JourneyPlayer> {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        const cur = playerRef.current;
        if (cur && cur !== prev) return resolve(cur);
        if (performance.now() - start > 2500) return resolve(cur ?? prev);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Share our journey" desktop="center">
        <div className={s.body}>
          <p className={s.lead}>{caption}.</p>
          <Button block icon={<IconShare size={18} />} onClick={() => void saveImage()} busy={busy === 'image'} disabled={busy !== null}>
            Share our story image
          </Button>
          {videoOk ? (
            <Button block variant="secondary" icon={<IconPlay size={18} />} onClick={() => void recordVideo()} disabled={busy !== null}>
              Record our journey video
            </Button>
          ) : null}
          <p className={s.hint}>
            <IconDownload size={14} aria-hidden="true" /> {videoOk ? 'The video replays at 2× while it records, about a minute.' : 'Saved as a 1080×1920 image, ready for a story.'}
          </p>
        </div>
      </BottomSheet>
      {busy === 'video' ? (
        <div className={s.recording} role="status">
          <span className={s.dot} aria-hidden="true" />
          <span>Recording our journey…</span>
          <button type="button" className={s.cancel} onClick={() => cancelRef.current?.()}>
            Cancel
          </button>
        </div>
      ) : null}
    </>
  );
}

/** What the recorder paints over the map this frame. */
function overlayFor(p: JourneyPlayer, stays: readonly Stay[], stats: FinaleStats, kmText: string): OverlayState {
  const base = p.overlayState();
  const i = p.stopIndex;
  const st = i >= 0 ? stays[i] : null;
  const phase = p.phase;
  const fin = p.schedule.segments.find((x) => x.kind === 'finale');
  const finP = fin ? Math.min(1, Math.max(0, (p.time - fin.start) / fin.duration)) : 1;
  return {
    ...base,
    date: st ? boardDate(st.visit.date) : boardDate('2026-06-19'),
    postcard:
      phase === 'hold' && st
        ? { name: st.hotel.name, date: formatDate(st.visit.date), stayOf: `Stay ${i + 1} of ${stays.length}`, line: postcardLine(st), image: null, seed: st.hotel.hotel_id }
        : null,
    finale:
      phase === 'finale' || phase === 'end'
        ? { hotels: stats.hotels, cities: stats.cities, countries: stats.countries, km: kmText, progress: finP, title: 'To be continued…' }
        : null,
  };
}
