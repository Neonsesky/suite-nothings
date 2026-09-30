/** Letters list (SPEC §13). Owned by w1-shell — this stub is replaced entirely. */
import { EmptyState } from '@/components/EmptyState';
import { IconChevron, IconHeart } from '@/components/icons';
import { useLetters, useMe, useSettings, useStays } from '@/data/store';
import { today } from '@/lib/dates';
import { countriesAbroad, hotelCount, visitCount } from '@/lib/stats';
import { isUnlocked, unlockHint } from './unlock';
import s from '../stubs.module.css';

export default function LettersScreen() {
  const me = useMe();
  const letters = useLetters().filter((l) => !me || l.to === me || l.from === me);
  const stays = useStays();
  const home = useSettings().home_base;
  const stats = { visits: visitCount(stays), hotels: hotelCount(stays), countriesAbroad: countriesAbroad(stays, home).length };
  if (letters.length === 0) {
    return (
      <div className="page">
        <EmptyState art={<IconHeart size={32} />} title="No notes yet" body="Notes we leave each other show up here." />
      </div>
    );
  }
  return (
    <div className={`page ${s.screen}`}>
      <h1 className={s.heading}>Letters</h1>
      <ul className={s.list} role="list">
        {letters.map((l) => {
          const open = isUnlocked(l, stats, today());
          return (
            <li key={l.letter_id}>
              <a className={s.row} href={open ? `#/letters/${l.letter_id}` : undefined} aria-disabled={!open}>
                <span>{l.title}</span>
                <span className={s.muted}>{open ? (l.read_at ? 'Read' : 'New') : unlockHint(l.unlock_rule)}</span>
                <IconChevron size={18} />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
