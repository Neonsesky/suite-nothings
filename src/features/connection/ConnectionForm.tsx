/**
 * Connection form (Apps Script URL + passphrase + Test connection). Owned by w1-backend, who
 * replaces this stub. Props are the contract.
 */
import { Button } from '@/components/Button';
import { IconLink } from '@/components/icons';
import s from './Connection.module.css';

export interface ConnectionFormProps {
  onConnected?(): void;
  /** Tighter layout for onboarding. */
  compact?: boolean;
}

export function ConnectionForm({ compact }: ConnectionFormProps) {
  return (
    <div className={[s.form, compact ? s.compact : ''].join(' ')}>
      <p className={s.note}>Connecting our Google Sheet arrives with the next update. Until then, everything saves on this phone.</p>
      <Button variant="secondary" icon={<IconLink size={18} />} disabled>
        Connect our Sheet
      </Button>
    </div>
  );
}

export default ConnectionForm;
