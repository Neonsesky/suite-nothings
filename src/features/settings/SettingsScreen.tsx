/** Settings (SPEC §8.8). Owned by w1-shell (connection section by w1-backend). Stub. */
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/Chip';
import { ConnectionSection } from '@/features/connection/ConnectionSection';
import { COUPLE, type PersonId } from '@/config/couple';
import { setDevice } from '@/data/device';
import { clearDemo, resetDemo, setMe, useDemoMode, useDevicePref, useMe } from '@/data/store';
import { setMuted } from '@/lib/sound';
import { toast } from '@/lib/toast';
import s from '../stubs.module.css';

export default function SettingsScreen() {
  const me = useMe();
  const demo = useDemoMode();
  const muted = useDevicePref('muted');
  const reduced = useDevicePref('reducedMotion');
  return (
    <div className={`page ${s.screen}`}>
      <h1 className={s.heading}>Settings</h1>
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Who's on this phone</h2>
        <ChipGroup
          label="Who am I"
          options={Object.values(COUPLE.people).map((p) => ({ value: p.id, label: p.name }))}
          value={me}
          onChange={(v) => v && setMe(v as PersonId)}
        />
      </section>
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Sound and motion</h2>
        <ChipGroup label="Sound" options={[{ value: 'on', label: 'Sound on' }, { value: 'off', label: 'Sound off' }]} value={muted ? 'off' : 'on'} onChange={(v) => setMuted(v === 'off')} />
        <ChipGroup
          label="Motion"
          options={[
            { value: 'auto', label: 'Match my phone' },
            { value: 'reduced', label: 'Less motion' },
            { value: 'full', label: 'Full motion' },
          ]}
          value={reduced == null ? 'auto' : reduced ? 'reduced' : 'full'}
          onChange={(v) => setDevice('reducedMotion', v === 'auto' ? null : v === 'reduced')}
        />
      </section>
      <ConnectionSection />
      {demo ? (
        <section className={s.section}>
          <h2 className={s.sectionTitle}>Demo stays</h2>
          <div className={s.actions}>
            <Button variant="secondary" onClick={() => void resetDemo().then(() => toast.show({ message: 'Demo stays are back' }))}>
              Reset demo stays
            </Button>
            <Button variant="ghost" onClick={() => void clearDemo().then(() => toast.show({ message: 'Demo stays cleared' }))}>
              Clear demo data
            </Button>
          </div>
        </section>
      ) : null}
      <p className={s.muted}>Designed as a love letter to Dayuse, where our first check-in happened.</p>
    </div>
  );
}
