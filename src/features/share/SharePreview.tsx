/** The share preview sheet: renders the card, shows it, then shares the PNG or saves it. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ClockLoader } from '@/components/ClockLoader';
import { ErrorState } from '@/components/ErrorState';
import { IconDownload, IconShare } from '@/components/icons';
import { toast } from '@/lib/toast';
import { downloadBlob, renderShareCard, type ShareJob } from './index';
import type { ShareOutcome } from './types';
import s from './SharePreview.module.css';

type Phase = { kind: 'loading' } | { kind: 'ready'; blob: Blob; url: string } | { kind: 'error' };

function canShareFile(file: File): boolean {
  try {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function SharePreview({ job, onDone }: { job: ShareJob; onDone(o: ShareOutcome): void }) {
  const [open, setOpen] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [sharing, setSharing] = useState(false);
  const failed = useRef(false);

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    void (async () => {
      try {
        const data = await job.data();
        const blob = await renderShareCard(job.kind, data);
        if (!alive) return;
        url = URL.createObjectURL(blob);
        failed.current = false;
        setPhase({ kind: 'ready', blob, url });
      } catch {
        if (!alive) return;
        failed.current = true;
        setPhase({ kind: 'error' });
      }
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [job, attempt]);

  const file = useMemo(() => (phase.kind === 'ready' ? new File([phase.blob], job.fileName, { type: 'image/png' }) : null), [phase, job.fileName]);
  const shareable = file ? canShareFile(file) : false;

  const finish = (o: ShareOutcome) => {
    setOpen(false);
    onDone(o);
  };

  const share = async () => {
    if (!file) return;
    setSharing(true);
    try {
      await navigator.share({ files: [file], title: job.title, text: job.text });
      finish('shared');
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        toast.show({ message: "Couldn't share from this browser. Save the image instead.", tone: 'error' });
      }
    } finally {
      setSharing(false);
    }
  };

  const save = () => {
    if (phase.kind !== 'ready') return;
    downloadBlob(phase.blob, job.fileName);
    toast.show({ message: 'Card saved', tone: 'success' });
    finish('copied');
  };

  const retry = () => {
    setPhase({ kind: 'loading' });
    setAttempt((n) => n + 1);
  };

  const footer =
    phase.kind === 'ready' ? (
      <div className={s.actions}>
        {shareable ? (
          <Button variant="primary" size="lg" icon={<IconShare size={20} />} onClick={() => void share()} busy={sharing} data-autofocus>
            Share
          </Button>
        ) : null}
        <Button variant={shareable ? 'secondary' : 'primary'} size="lg" icon={<IconDownload size={20} />} onClick={save} data-autofocus={shareable ? undefined : true}>
          Save image
        </Button>
      </div>
    ) : undefined;

  return (
    <BottomSheet open={open} onClose={() => finish(failed.current ? 'unavailable' : 'cancelled')} title={job.title} footer={footer} className={s.sheet}>
      <div className={s.body}>
        {phase.kind === 'loading' ? (
          <div className={s.stage} data-share-state="loading">
            <ClockLoader size={56} label="Making our card" />
            <p className={s.hint}>Making our card…</p>
          </div>
        ) : null}
        {phase.kind === 'error' ? (
          <div className={s.stage} data-share-state="error">
            <ErrorState title="Couldn't make the card. Try again." body="Your stays are safe. The card just needs another go." onRetry={retry} />
          </div>
        ) : null}
        {phase.kind === 'ready' ? (
          <figure className={s.figure} data-share-state="ready">
            <img className={s.card} src={phase.url} alt={job.text} width={1080} height={1920} />
            <figcaption className={s.caption}>{job.text}</figcaption>
          </figure>
        ) : null}
      </div>
    </BottomSheet>
  );
}
