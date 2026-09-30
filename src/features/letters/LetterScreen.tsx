/** One letter (SPEC §13). Owned by w1-shell — this stub is replaced by the pillow reveal. */
import { useEffect } from 'react';
import { ButtonLink } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { useParams } from '@/app/router';
import { markLetterRead, useLetters, useMe } from '@/data/store';
import { personName } from '@/config/couple';
import s from '../stubs.module.css';

export default function LetterScreen() {
  const { id } = useParams();
  const me = useMe();
  const letter = useLetters().find((l) => l.letter_id === id);
  useEffect(() => {
    if (letter && me && letter.to === me && !letter.read_at) void markLetterRead(letter.letter_id);
  }, [letter, me]);
  if (!letter) {
    return (
      <div className="page">
        <EmptyState title="This note slipped behind the pillow" body="It may still be syncing. Try again in a moment." action={<ButtonLink href="#/letters">All letters</ButtonLink>} />
      </div>
    );
  }
  return (
    <article className={`page ${s.screen}`}>
      <h1 className={s.heading}>{letter.title}</h1>
      <div style={{ whiteSpace: 'pre-line' }}>{letter.body_md}</div>
      <p className={s.muted}>From {personName(letter.from)}</p>
    </article>
  );
}
