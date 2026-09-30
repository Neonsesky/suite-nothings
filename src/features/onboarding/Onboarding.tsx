/**
 * First launch: "Who's checking in?" (SPEC §8.1). Owned by w1-shell — replaced by the full
 * intro + connect + home base + install flow.
 */
import { Button } from '@/components/Button';
import { navigate } from '@/app/router';
import { COUPLE, type PersonId } from '@/config/couple';
import { setMe } from '@/data/store';
import s from './Onboarding.module.css';

export default function Onboarding() {
  const choose = (id: PersonId) => {
    setMe(id);
    navigate('/', { replace: true });
  };
  return (
    <main className={s.root}>
      <p className={s.eyebrow}>{COUPLE.appName}</p>
      <h1 className={s.title}>Who's checking in?</h1>
      <p className={s.body}>{COUPLE.tagline}</p>
      <div className={s.choices}>
        {Object.values(COUPLE.people).map((p) => (
          <Button key={p.id} size="lg" variant="secondary" block onClick={() => choose(p.id)}>
            {p.name}
          </Button>
        ))}
      </div>
    </main>
  );
}
