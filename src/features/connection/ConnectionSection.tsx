/** Settings → Connection: the linked Sheet, last sync, Sync now, Demo ↔ Live, and the invite QR. */
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/Chip';
import { IconCheck, IconLink, IconQr, IconShare, IconSync, IconUpload } from '@/components/icons';
import { otherPerson, personName } from '@/config/couple';
import { demoOnlyStays, inviteLink, shortenUrl } from '@/data/connection';
import { activateDemo, activateLive, importData, syncNow, useDemoMode, useDevicePref, useMe, useSyncState } from '@/data/store';
import { formatRelative } from '@/lib/dates';
import { toast } from '@/lib/toast';
import { ConnectionForm } from './ConnectionForm';
import s from './Connection.module.css';

type Mode = 'demo' | 'live';

export function ConnectionSection() {
  const demo = useDemoMode();
  const connection = useDevicePref('connection');
  const [editing, setEditing] = useState(false);
  const [connected, setConnected] = useState<string | null>(null);
  const mode: Mode = demo ? 'demo' : 'live';

  const onMode = (next: Mode | null) => {
    if (!next || next === mode) return;
    if (next === 'demo') void activateDemo();
    else if (connection) void activateLive(connection);
    else setEditing(true);
  };

  return (
    <section className={s.section} aria-labelledby="connection-title">
      <h2 id="connection-title" className={s.title}>Connection</h2>
      <ChipGroup<Mode>
        label="Which diary"
        options={[
          { value: 'demo', label: 'Demo' },
          { value: 'live', label: 'Our Sheet' },
        ]}
        value={mode}
        onChange={(v) => onMode(v as Mode | null)}
      />
      {demo ? (
        <p className={s.note}>Demo mode: sample stays, nothing saved to our Sheet.</p>
      ) : null}
      {!demo && connection && !editing ? <LinkStatus connectedMessage={connected} onChange={() => { setConnected(null); setEditing(true); }} /> : null}
      {demo || !connection || editing ? (
        <div className={s.card}>
          {connection && editing ? <p className={s.meta}>Paste the new link to reconnect. Everything saved on this phone stays and syncs once it works.</p> : null}
          <ConnectionForm onConnected={(r) => { setConnected(r.message); setEditing(false); }} />
        </div>
      ) : null}
      {!demo && connection ? <Invite apiUrl={connection.apiUrl} passphrase={connection.key} /> : null}
      {!demo && connection ? <DemoImport /> : null}
    </section>
  );
}

function LinkStatus({ onChange, connectedMessage }: { onChange(): void; connectedMessage: string | null }) {
  const connection = useDevicePref('connection');
  const sync = useSyncState();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!connection) return null;
  const tone = sync.error ? 'bad' : sync.pending > 0 ? 'wait' : 'ok';
  const status = sync.error
    ? sync.error === 'unauthorized'
      ? "Our Sheet didn't accept the passphrase. Re-enter it below."
      : sync.error === 'unreachable'
        ? "Can't reach our Sheet. Paste the new link in Settings."
        : 'Sync failed'
    : sync.syncing
      ? 'Syncing…'
      : sync.pending > 0
        ? `Saved on this phone, will sync (${sync.pending === 1 ? '1 change waiting to sync' : `${sync.pending} changes waiting to sync`})`
        : sync.lastSyncAt
          ? `Last synced ${formatRelative(sync.lastSyncAt)}`
          : 'Connected';
  return (
    <div className={s.card} data-testid="connection-status">
      {connectedMessage ? (
        <p className={[s.result, s.ok].join(' ')} role="status" data-testid="connection-result" data-outcome="connected">
          <IconCheck size={18} />
          <span>{connectedMessage}</span>
        </p>
      ) : null}
      <div className={s.row}>
        <span className={s.linkText} title={connection.apiUrl}>{shortenUrl(connection.apiUrl)}</span>
        <Button variant="ghost" size="sm" icon={<IconLink size={16} />} onClick={onChange}>Change link</Button>
      </div>
      <div className={s.row}>
        <span className={s.meta} role="status">
          <span className={s.statusDot} data-tone={tone} aria-hidden />
          {status}
        </span>
        <Button variant="secondary" size="sm" icon={<IconSync size={16} />} busy={sync.syncing} onClick={() => void syncNow()}>
          Sync now
        </Button>
      </div>
    </div>
  );
}

function Invite({ apiUrl, passphrase }: { apiUrl: string; passphrase: string }) {
  const me = useMe() ?? 'nirsh';
  const partner = otherPerson(me);
  const name = personName(partner);
  const link = inviteLink({ apiUrl, key: passphrase }, partner);
  const [qr, setQr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void import('qrcode').then(async (QR) => {
      const css = getComputedStyle(document.documentElement);
      const dark = css.getPropertyValue('--color-ink').trim() || '#000000';
      const light = css.getPropertyValue('--color-paper').trim() || '#ffffff';
      const url = await QR.toDataURL(link, { margin: 1, width: 384, errorCorrectionLevel: 'M', color: { dark, light } });
      if (live) setQr(url);
    });
    return () => {
      live = false;
    };
  }, [open, link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.show({ message: 'Invite link copied', tone: 'success' });
    } catch {
      toast.show({ message: "Couldn't copy here. Long-press the QR code instead.", tone: 'error' });
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'Suite Nothings', text: `Join our hotel diary as ${name}`, url: link });
    } catch {
      // Dismissed, or sharing unavailable: copying still works.
    }
  };

  return (
    <div className={s.card}>
      <h3 className={s.subhead}>Invite {name}</h3>
      {open ? (
        <div className={s.invite}>
          {qr ? <img className={s.qr} src={qr} alt={`QR code that connects ${name}'s phone to our Sheet`} /> : <div className={s.qr} aria-hidden />}
          <div className={s.inviteText}>
            <p>Scan to join as {name}</p>
            <p className={s.meta}>It holds our passphrase, so show it only to {name}.</p>
            <div className={s.actions}>
              <Button variant="secondary" size="sm" onClick={() => void copy()}>Copy link</Button>
              {typeof navigator !== 'undefined' && 'share' in navigator ? (
                <Button variant="secondary" size="sm" icon={<IconShare size={16} />} onClick={() => void share()}>Share link</Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className={s.row}>
          <p className={s.meta}>{name}'s phone joins in one scan.</p>
          <Button variant="secondary" size="sm" icon={<IconQr size={16} />} onClick={() => setOpen(true)}>Show invite QR</Button>
        </div>
      )}
    </div>
  );
}

/** Stays added by hand in demo mode can come along, but only when asked. */
function DemoImport() {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void demoOnlyStays()
      .then((r) => live && setCount(r.visits.length))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  if (!count) return null;
  const run = async () => {
    setBusy(true);
    const { hotels, visits } = await demoOnlyStays();
    await importData({ hotels, visits });
    setBusy(false);
    setCount(0);
    toast.show({ message: `${visits.length} ${visits.length === 1 ? 'stay' : 'stays'} brought over from demo mode`, tone: 'success' });
  };
  return (
    <div className={s.card}>
      <p className={s.meta}>
        We added {count} {count === 1 ? 'stay' : 'stays'} while in demo mode. They stay in demo unless you bring them over.
      </p>
      <div className={s.actions}>
        <Button variant="secondary" size="sm" icon={<IconUpload size={16} />} busy={busy} onClick={() => void run()}>
          Bring them to our Sheet
        </Button>
      </div>
    </div>
  );
}

export default ConnectionSection;
