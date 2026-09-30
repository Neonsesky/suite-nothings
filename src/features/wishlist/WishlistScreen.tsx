/** Next check-ins (wishlist). Later wave replaces this stub entirely. */
import { EmptyState } from '@/components/EmptyState';
import { IconPin, IconSparkle } from '@/components/icons';
import { useWishes } from '@/data/store';
import s from '../stubs.module.css';

export default function WishlistScreen() {
  const wishes = useWishes();
  if (wishes.length === 0) {
    return (
      <div className="page">
        <EmptyState art={<IconSparkle size={32} />} title="Next check-ins" body="Hotels we're dreaming about land here." />
      </div>
    );
  }
  return (
    <div className={`page ${s.screen}`}>
      <h1 className={s.heading}>Next check-ins</h1>
      <ul className={s.list} role="list">
        {wishes.map((w) => (
          <li key={w.wish_id} className={s.row}>
            <IconPin size={18} />
            <span>{w.name}</span>
            <span className={s.muted}>{[w.city, w.country].filter(Boolean).join(', ')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
