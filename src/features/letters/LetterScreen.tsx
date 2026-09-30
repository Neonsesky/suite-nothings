/** One letter, re-readable any time (#/letters/:id). */
import { useEffect, useId } from 'react';
import { ButtonLink } from '@/components/Button';
import { ClockLoader } from '@/components/ClockLoader';
import { EmptyState } from '@/components/EmptyState';
import { IconBack } from '@/components/icons';
import { goBack, useParams } from '@/app/router';
import { markLetterRead, useMe, useStoreReady } from '@/data/store';
import { useReducedMotion } from '@/lib/motion';
import { LetterPaper } from './LetterPaper';
import { markPillowShown } from './PillowNote';
import { SealedEnvelope } from './SealedEnvelope';
import { useLetterViews } from './access';
import { unlockHint } from './unlock';
import s from './Letters.module.css';

export default function LetterScreen() {
  const { id } = useParams();
  const me = useMe();
  const ready = useStoreReady();
  const reduced = useReducedMotion();
  const titleId = useId();
  const view = useLetterViews().find((v) => v.letter.letter_id === id);
  const letter = view?.letter;
  const canRead = !!view && (view.unlocked || view.mine);
  const forMe = !!letter && letter.to === me;

  useEffect(() => {
    if (letter && forMe && canRead) markPillowShown(letter.letter_id);
  }, [letter, forMe, canRead]);

  const back = (
    <button type="button" className={s.back} onClick={() => goBack('/letters')}>
      <IconBack size={20} /> Letters
    </button>
  );

  if (!ready) {
    return (
      <div className={`page ${s.screen}`}>
        {back}
        <div className={s.center}>
          <ClockLoader label="Fetching the note" />
        </div>
      </div>
    );
  }
  if (!letter) {
    return (
      <div className={`page ${s.screen}`}>
        {back}
        <EmptyState
          title="This note slipped behind the pillow"
          body="It may still be syncing from the other phone. Try again in a moment."
          action={<ButtonLink href="#/letters">All our letters</ButtonLink>}
        />
      </div>
    );
  }
  if (!canRead) {
    return (
      <div className={`page ${s.screen}`}>
        {back}
        <div className={s.sealedHero}>
          <SealedEnvelope size={160} />
          <h1 className={s.pageTitle}>Still sealed</h1>
          <p className={s.muted}>{unlockHint(letter.unlock_rule)}. We'll open it together when it's time.</p>
        </div>
      </div>
    );
  }
  // Re-reads are calmer: a first read reveals line by line, later reads show it all.
  const firstRead = forMe && !letter.read_at;
  return (
    <article className={`page ${s.screen}`} aria-labelledby={titleId}>
      {back}
      <div className={s.readerWrap}>
        <LetterPaper
          letter={letter}
          reveal
          instant={reduced || !firstRead}
          titleId={titleId}
          onRevealed={forMe ? () => void markLetterRead(letter.letter_id) : undefined}
        />
      </div>
    </article>
  );
}
