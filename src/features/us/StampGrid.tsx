/** Milestone stamps on Us: earned (inked) and locked (dashed) badges; tap one for its story. */
import { useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Stamp } from '@/components/Stamp';
import type { Stay } from '@/data/types';
import { useMilestoneState, type MilestoneDef } from '@/features/milestones';
import { openStay } from '@/features/stays/transition';
import { formatDate } from '@/lib/dates';
import s from './StampGrid.module.css';

export function StampGrid({ stays }: { stays: readonly Stay[] }) {
  const { defs, earned } = useMilestoneState(stays);
  const [open, setOpen] = useState<MilestoneDef | null>(null);
  const [shown, setShown] = useState<MilestoneDef | null>(null);
  const count = defs.filter((d) => earned.has(d.id)).length;
  const sel = shown ? earned.get(shown.id) ?? null : null;

  return (
    <section className={s.card} aria-labelledby="us-stamps" data-section="stamps">
      <div className={s.head}>
        <h2 id="us-stamps" className={s.h2}>
          Milestone stamps
        </h2>
        <span className={s.count}>
          {count} of {defs.length}
        </span>
      </div>
      <ul className={s.grid} role="list">
        {defs.map((d) => {
          const m = earned.get(d.id);
          return (
            <li key={d.id}>
              <button
                type="button"
                className={s.cell}
                data-milestone={d.id}
                data-earned={m ? 'true' : 'false'}
                aria-label={`${d.name}, ${m ? `earned ${formatDate(m.achievedOn)}` : 'locked'}`}
                onClick={() => {
                  setShown(d);
                  setOpen(d);
                }}
              >
                <Stamp title={d.short} caption={d.caption} tone={m ? d.tone : 'cream'} locked={!m} size={76} className={m ? s.inked : undefined} />
                <span className={s.name}>{d.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <BottomSheet open={!!open} onClose={() => setOpen(null)} title={shown?.name ?? 'Milestone'}>
        {shown ? (
          <div className={s.detail} data-testid="stamp-detail">
            <Stamp title={shown.short} caption={shown.caption} tone={sel ? shown.tone : 'cream'} locked={!sel} size={128} />
            {sel ? (
              <>
                <p className={s.detailLine}>{sel.caption}</p>
                <p className={s.detailMeta}>Earned {formatDate(sel.achievedOn)}</p>
                {sel.visitId ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const id = sel.visitId!;
                      setOpen(null);
                      openStay(id);
                    }}
                  >
                    See the stay that did it
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <p className={s.detailLine}>{shown.locked}</p>
                <p className={s.detailMeta}>Not yet. Ours to earn.</p>
              </>
            )}
          </div>
        ) : null}
      </BottomSheet>
    </section>
  );
}
