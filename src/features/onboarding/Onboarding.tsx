/**
 * First launch (SPEC §8.1): who's checking in → connect (skipped after an invite link) → home
 * base → install → in. Each step focuses its heading so screen readers hear the new step.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { KeyTagMark } from '@/components/brand/KeyTagMark';
import { IconBack, IconCheck } from '@/components/icons';
import { navigate } from '@/app/router';
import { COUPLE, type PersonId } from '@/config/couple';
import { activateDemo, setMe, updateSettings, useDevicePref, useMe, useSettings } from '@/data/store';
import type { HomeBase } from '@/data/types';
import { ConnectionForm } from '@/features/connection/ConnectionForm';
import { HomeBasePicker } from '@/features/settings/HomeBasePicker';
import { MiniMap } from '@/map/MiniMap';
import { IOSInstallSteps } from '@/pwa/IOSInstallSteps';
import { useInstallPrompt } from '@/pwa/install';
import s from './Onboarding.module.css';

type Step = 'who' | 'connect' | 'home' | 'install' | 'done';

export default function Onboarding() {
  const connection = useDevicePref('connection');
  const install = useInstallPrompt();
  const me = useMe();
  const [step, setStep] = useState<Step>(() => (me ? (connection ? 'home' : 'connect') : 'who'));
  const [history, setHistory] = useState<Step[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);

  const steps: Step[] = ['who', ...(connection && step !== 'connect' ? [] : (['connect'] as Step[])), 'home', ...(install.isStandalone ? [] : (['install'] as Step[]))];
  const index = steps.indexOf(step);
  const go = (next: Step) => {
    setHistory((h) => [...h, step]);
    setStep(next);
  };
  const after = (cur: Step): Step => steps[steps.indexOf(cur) + 1] ?? 'done';
  const back = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setStep(prev);
  };

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  return (
    <main className={s.root} data-step={step}>
      <div className={s.card}>
        <div className={s.top}>
          {history.length > 0 && step !== 'done' ? (
            <button type="button" className={s.back} onClick={back} aria-label="Back">
              <IconBack size={22} />
            </button>
          ) : (
            <span className={s.backSpacer} />
          )}
          <KeyTagMark size={44} title={COUPLE.appName} />
          <span className={s.backSpacer} />
        </div>

        {step === 'who' ? (
          <Who headingRef={heading} onPick={(id) => {
            setMe(id);
            go(connection ? 'home' : 'connect');
          }} />
        ) : step === 'connect' ? (
          <Connect headingRef={heading} onDone={() => go(after('connect'))} />
        ) : step === 'home' ? (
          <Home headingRef={heading} onDone={() => go(after('home'))} />
        ) : step === 'install' ? (
          <Install headingRef={heading} install={install} onDone={() => go('done')} />
        ) : (
          <section className={s.step} aria-labelledby="ob-done">
            <span className={s.doneBadge} aria-hidden="true">
              <IconCheck size={28} />
            </span>
            <h1 id="ob-done" ref={heading} tabIndex={-1} className={s.title}>
              Check-in complete
            </h1>
            <p className={s.body}>Let's see our stays.</p>
            <Button size="lg" block onClick={() => navigate('/', { replace: true })}>
              Take me in
            </Button>
          </section>
        )}

        {step !== 'done' && index >= 0 ? (
          <ol className={s.dots} aria-label={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((st, i) => (
              <li key={st} className={s.dot} data-active={i === index || undefined} data-past={i < index || undefined} />
            ))}
          </ol>
        ) : null}
      </div>
    </main>
  );
}

type HeadingRef = React.RefObject<HTMLHeadingElement | null>;

function Who({ headingRef, onPick }: { headingRef: HeadingRef; onPick(id: PersonId): void }) {
  return (
    <section className={s.step} aria-labelledby="ob-who">
      <p className={s.eyebrow}>{COUPLE.appName}</p>
      <h1 id="ob-who" ref={headingRef} tabIndex={-1} className={s.title}>
        Who's checking in?
      </h1>
      <div className={s.people}>
        {Object.values(COUPLE.people).map((p) => (
          <button key={p.id} type="button" className={s.person} onClick={() => onPick(p.id)}>
            <span className={s.initial} aria-hidden="true">
              {p.name[0]}
            </span>
            <span className={s.personName}>{p.name}</span>
          </button>
        ))}
      </div>
      <p className={s.helper}>This sets how the app greets you, and whose name goes on new stays.</p>
    </section>
  );
}

function Connect({ headingRef, onDone }: { headingRef: HeadingRef; onDone(): void }) {
  const [busy, setBusy] = useState(false);
  return (
    <section className={s.step} aria-labelledby="ob-connect">
      <h1 id="ob-connect" ref={headingRef} tabIndex={-1} className={s.title}>
        Connect our stays
      </h1>
      <div className={s.demoBox}>
        <Button
          size="lg"
          block
          busy={busy}
          onClick={async () => {
            setBusy(true);
            await activateDemo();
            setBusy(false);
            onDone();
          }}
        >
          Try demo
        </Button>
        <p className={s.helper}>Explore with sample stays. Nothing saves to our real Sheet.</p>
      </div>
      <p className={s.divider}>
        <span>Or connect with our link</span>
      </p>
      <ConnectionForm compact onConnected={onDone} />
    </section>
  );
}

function Home({ headingRef, onDone }: { headingRef: HeadingRef; onDone(): void }) {
  const current = useSettings().home_base;
  const [value, setValue] = useState<HomeBase>(current);
  const [changing, setChanging] = useState(false);
  return (
    <section className={s.step} aria-labelledby="ob-home">
      <h1 id="ob-home" ref={headingRef} tabIndex={-1} className={s.title}>
        Where's home base?
      </h1>
      {changing ? (
        <HomeBasePicker
          value={value}
          autoFocus
          onChange={(hb) => {
            setValue(hb);
            setChanging(false);
          }}
        />
      ) : (
        <>
          <div className={s.map}>
            <MiniMap lat={value.lat} lng={value.lng} label={`${value.city}, ${value.country}`} interactive={false} />
          </div>
          <p className={s.summary}>
            {value.city}, {value.country}
          </p>
          <Button
            size="lg"
            block
            onClick={async () => {
              await updateSettings({ home_base: value });
              onDone();
            }}
          >
            That's home
          </Button>
          <Button variant="ghost" block onClick={() => setChanging(true)}>
            Change city
          </Button>
        </>
      )}
    </section>
  );
}

function Install({ headingRef, install, onDone }: { headingRef: HeadingRef; install: ReturnType<typeof useInstallPrompt>; onDone(): void }) {
  const android = !install.isIOS && install.canInstall;
  return (
    <section className={s.step} aria-labelledby="ob-install">
      <h1 id="ob-install" ref={headingRef} tabIndex={-1} className={s.title}>
        Add us to your home screen
      </h1>
      {install.isIOS ? (
        <IOSInstallSteps compact />
      ) : (
        <p className={s.body}>One tap and Suite Nothings lives right there, no browser bar.</p>
      )}
      {android ? (
        <Button
          size="lg"
          block
          onClick={async () => {
            await install.promptInstall();
            onDone();
          }}
        >
          Add to home screen
        </Button>
      ) : install.isIOS ? (
        <Button size="lg" block onClick={onDone}>
          Done
        </Button>
      ) : (
        <p className={s.helper}>Look for Install or Add to home screen in your browser's menu.</p>
      )}
      <Button variant="ghost" block onClick={onDone}>
        Maybe later
      </Button>
    </section>
  );
}
