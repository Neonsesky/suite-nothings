/** "Surprise me": a random wish revealed on a split-flap departures board. */
import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { Button, ButtonLink } from '@/components/Button';
import { SplitFlap } from '@/components/SplitFlap';
import { IconDice, IconKey } from '@/components/icons';
import { personName } from '@/config/couple';
import type { Wish } from '@/data/types';
import { href } from '@/app/router';
import { useReducedMotion } from '@/lib/motion';
import { flapText, placeLine, pickSurprise } from './logic';
import s from './Wishlist.module.css';

const BOARD = 14;

export function SurpriseSheet({ open, wishes, onClose }: { open: boolean; wishes: readonly Wish[]; onClose(): void }) {
  const reduced = useReducedMotion();
  const [pick, setPick] = useState<Wish | null>(() => pickSurprise(wishes));
  const [spin, setSpin] = useState(0);
  const [settled, setSettled] = useState(false);

  // Safety net: reveal the card even if a flap never reports back.
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), 2600);
    return () => window.clearTimeout(t);
  }, [spin]);

  const again = () => {
    setPick((prev) => pickSurprise(wishes, prev?.wish_id ?? null));
    setSettled(false);
    setSpin((n) => n + 1);
  };

  const text = pick ? flapText(pick.name, BOARD) : '';
  const shown = settled || reduced;

  return (
    <BottomSheet open={open} onClose={onClose} title="Surprise me">
      <div className={s.surprise} data-testid="surprise">
        <p className={s.boardLabel}>Next departure</p>
        <div className={s.board}>
          {pick ? (
            <SplitFlap
              key={spin}
              value={' '.repeat(Math.floor((BOARD - text.length) / 2)) + text.padEnd(BOARD - Math.floor((BOARD - text.length) / 2), ' ')}
              length={BOARD}
              size="var(--board-flap)"
              ariaLabel={pick.name}
              animateOnMount={!reduced}
              riffle={7}
              sound
              onSettled={() => setSettled(true)}
            />
          ) : null}
        </div>
        <div className={s.reveal} data-shown={shown || undefined} aria-live="polite">
          {pick && shown ? (
            <>
              <h3 className={s.revealName} data-testid="surprise-name">
                {pick.name}
              </h3>
              {placeLine(pick) ? <p className={s.revealPlace}>{placeLine(pick)}</p> : null}
              {pick.note ? <p className={s.revealNote}>“{pick.note}”</p> : null}
              {pick.added_by ? <p className={s.revealBy}>{personName(pick.added_by)}'s wish</p> : null}
            </>
          ) : null}
        </div>
        <div className={s.surpriseActions}>
          {pick ? (
            <ButtonLink href={href('/add', { wish: pick.wish_id })} icon={<IconKey size={18} />} block>
              Turn into a stay
            </ButtonLink>
          ) : null}
          <Button variant="secondary" icon={<IconDice size={18} />} onClick={again} block>
            Spin again
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
