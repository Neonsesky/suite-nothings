/** Us (SPEC §8.7). Later wave replaces this stub entirely. */
import { IconChevron } from '@/components/icons';
import { useStays, useSettings } from '@/data/store';
import { summary } from '@/lib/stats';
import s from '../stubs.module.css';

export default function UsScreen() {
  const stays = useStays();
  const home = useSettings().home_base;
  const sum = summary(stays, home);
  const links = [
    { href: '#/letters', label: 'Letters' },
    { href: '#/wishlist', label: 'Next check-ins' },
    { href: '#/settings', label: 'Settings' },
  ];
  return (
    <div className={`page ${s.screen}`}>
      <h1 className={s.heading}>Us</h1>
      <p className={s.muted}>
        {sum.hotels} hotels, {sum.visits} visits, {sum.hours} hours of hotel time together.
      </p>
      <ul className={s.list} role="list">
        {links.map((l) => (
          <li key={l.href}>
            <a className={s.row} href={l.href}>
              <span>{l.label}</span>
              <IconChevron size={18} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
