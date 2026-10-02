/**
 * `#/join?api=…&key=…&as=shady`: stores the connection, strips the secret from the URL, preselects
 * the person, tests the link, then continues onboarding (or goes home when it's done).
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { KeyTagMark } from '@/components/brand/KeyTagMark';
import { Avatar } from '@/components/brand/Avatar';
import { IconAlert, IconCheck } from '@/components/icons';
import { otherPerson, personName, type PersonId } from '@/config/couple';
import { parseJoinParams, saveConnection, testConnection, type JoinParse, type TestResult } from '@/data/connection';
import { getDevice } from '@/data/device';
import { activateLive, setMe } from '@/data/store';
import { navigate, useLocation } from '@/app/router';
import { ConnectionForm } from './ConnectionForm';
import s from './Connection.module.css';

function finish() {
  navigate(getDevice('introSeen') ? '/' : '/welcome', { replace: true });
}

export default function JoinRoute() {
  const location = useLocation();
  // Read the invite once, before the URL is cleaned.
  const [parsed] = useState<JoinParse>(() => parseJoinParams(location.query));
  const [as, setAs] = useState<PersonId>(() => (parsed.ok ? parsed.params.as : parsed.partial.as) ?? 'shady');
  const [test, setTest] = useState<TestResult | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    // Keep the passphrase out of history and screenshots of the address bar.
    history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}#/join`);
  }, []);

  useEffect(() => {
    if (!parsed.ok) return;
    const { api, key } = parsed.params;
    void saveConnection({ apiUrl: api, key, connectedAt: null, lastSyncAt: null });
    let live = true;
    void testConnection(api, key).then((r) => live && setTest(r));
    return () => {
      live = false;
    };
  }, [parsed]);

  const name = personName(as);

  if (!parsed.ok) {
    return (
      <main className={s.join}>
        <div className={s.joinCard}>
          <KeyTagMark size={56} />
          <h1 className={s.joinTitle}>You've been invited</h1>
          <p className={s.joinBody} role="alert">{parsed.message}</p>
          <ConnectionForm
            initialUrl={parsed.partial.api}
            initialKey={parsed.partial.key}
            as={as}
            onConnected={finish}
          />
        </div>
      </main>
    );
  }

  const join = async () => {
    setJoining(true);
    const { api, key } = parsed.params;
    const now = new Date().toISOString();
    const config = { apiUrl: api, key, connectedAt: now, lastSyncAt: test?.ok ? now : null };
    await saveConnection(config);
    setMe(as);
    await activateLive(config);
    finish();
  };

  const blocked = test && (test.outcome === 'wrong_passphrase' || test.outcome === 'not_apps_script' || test.outcome === 'bad_url');

  return (
    <main className={s.join}>
      <div className={s.joinCard}>
        <KeyTagMark size={56} />
        <Avatar person={as} size={48} />
        <h1 className={s.joinTitle}>You've been invited</h1>
        <p className={s.joinBody}>This connects you as {name}.</p>
        <p className={[s.result, test ? (test.ok ? s.ok : s.bad) : ''].join(' ')} role="status" aria-live="polite" data-testid="connection-result" data-outcome={test?.outcome}>
          {test ? (test.ok ? <IconCheck size={18} /> : <IconAlert size={18} />) : null}
          <span>{test ? (test.outcome === 'unreachable' ? "Can't reach Google right now. You can join anyway; we'll sync when it's back." : test.message) : 'Checking our connection…'}</span>
        </p>
        {blocked ? (
          <ConnectionForm initialUrl={parsed.params.api} as={as} onConnected={finish} />
        ) : (
          <Button variant="primary" size="lg" block busy={joining || !test} onClick={() => void join()}>
            Join as {name}
          </Button>
        )}
        <button type="button" className={s.switch} onClick={() => setAs(otherPerson(as))}>
          Not {name}? Switch
        </button>
      </div>
    </main>
  );
}
