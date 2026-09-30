/** Letters (#/letters): every note that's open for me, sealed ones as envelopes, and "Write a future note". */
import { useState } from 'react';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { IconBack, IconChevron, IconEdit } from '@/components/icons';
import { goBack } from '@/app/router';
import { otherPerson, personName } from '@/config/couple';
import { useMe, useStoreReady } from '@/data/store';
import { formatDate } from '@/lib/dates';
import { SealedEnvelope } from './SealedEnvelope';
import { WriteNoteSheet } from './WriteNoteSheet';
import { useLetterViews, type LetterView } from './access';
import { unlockHint } from './unlock';
import s from './Letters.module.css';

function status(v: LetterView): string {
  const { letter } = v;
  if (v.mine) {
    if (letter.read_at) return `${personName(letter.to)} read your note on ${formatDate(letter.read_at.slice(0, 10))}`;
    return v.unlocked ? `Waiting on ${personName(letter.to)}'s pillow` : `Sealed. ${unlockHint(letter.unlock_rule)}`;
  }
  if (!v.unlocked) return unlockHint(letter.unlock_rule);
  return letter.read_at ? `From ${personName(letter.from)} · Read ${formatDate(letter.read_at.slice(0, 10))}` : `From ${personName(letter.from)} · New`;
}

export default function LettersScreen() {
  const me = useMe();
  const ready = useStoreReady();
  const views = useLetterViews();
  const [writing, setWriting] = useState(false);
  const canWrite = me === 'nirsh';

  const list = [...views].sort((a, b) => Number(b.unlocked || b.mine) - Number(a.unlocked || a.mine) || b.letter.created_at.localeCompare(a.letter.created_at));

  return (
    <div className={`page ${s.screen}`}>
      <button type="button" className={s.back} onClick={() => goBack('/us')}>
        <IconBack size={20} /> Us
      </button>
      <header className={s.listHeader}>
        <div>
          <h1 className={s.pageTitle}>A note on your pillow</h1>
          <p className={s.muted}>Notes we leave each other. Some wait for the right stay to open.</p>
        </div>
        {canWrite ? (
          <Button icon={<IconEdit size={18} />} onClick={() => setWriting(true)}>
            Write a future note
          </Button>
        ) : null}
      </header>

      {!ready ? (
        <div className={s.list} aria-label="Loading our letters">
          <Skeleton height="5.5rem" radius="lg" />
          <Skeleton height="5.5rem" radius="lg" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          art={<SealedEnvelope size={96} />}
          title="No notes yet"
          body={canWrite ? `Leave one for ${personName(otherPerson(me))}. It can wait for a milestone before it opens.` : 'Notes we leave each other show up here.'}
          action={canWrite ? <Button onClick={() => setWriting(true)}>Write a future note</Button> : undefined}
        />
      ) : (
        <ul className={s.list} role="list">
          {list.map((v) => {
            const readable = v.unlocked || v.mine;
            const inner = (
              <>
                <span className={s.rowArt}>
                  <SealedEnvelope size={56} open={readable} />
                </span>
                <span className={s.rowText}>
                  <span className={s.rowTitle}>{readable ? v.letter.title : 'A sealed note'}</span>
                  <span className={s.rowMeta}>{status(v)}</span>
                </span>
                {readable ? <IconChevron size={18} /> : null}
              </>
            );
            return (
              <li key={v.letter.letter_id}>
                {readable ? (
                  <a className={`${s.row} ${!v.mine && !v.letter.read_at ? s.rowNew : ''}`} href={`#/letters/${v.letter.letter_id}`} data-letter-id={v.letter.letter_id}>
                    {inner}
                  </a>
                ) : (
                  <div className={`${s.row} ${s.rowSealed}`} data-letter-id={v.letter.letter_id} aria-label={`A sealed note. ${status(v)}`}>
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canWrite ? <WriteNoteSheet open={writing} onClose={() => setWriting(false)} /> : null}
    </div>
  );
}
