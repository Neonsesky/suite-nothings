import { useSyncState } from '@/data/store';
import { IconOffline, IconSync } from './icons';
import s from './OfflineBanner.module.css';

/** Quiet banner: offline, or can't reach the Sheet. Pending writes are called out as safe. */
export function OfflineBanner() {
  const { online, pending, error } = useSyncState();
  if (online && error !== 'unreachable' && error !== 'unauthorized') return null;
  let text: string;
  if (!online) {
    text = pending > 0 ? `You're offline. ${pending} ${pending === 1 ? 'change is' : 'changes are'} saved on this phone and will sync.` : "You're offline. Everything still works; we'll sync when you're back.";
  } else if (error === 'unauthorized') {
    text = "Our Sheet didn't accept the passphrase. Re-enter it in Settings.";
  } else {
    text = "Can't reach our Sheet. Paste the new link in Settings.";
  }
  return (
    <div className={s.banner} role="status">
      {online ? <IconSync size={18} /> : <IconOffline size={18} />}
      <span>{text}</span>
      {online ? <a href="#/settings" className={s.link}>Settings</a> : null}
    </div>
  );
}
