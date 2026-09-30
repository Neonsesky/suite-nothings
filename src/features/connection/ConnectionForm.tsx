/**
 * Connection form: Apps Script URL + passphrase + Test connection (SPEC §6). A successful test
 * saves the link on this phone and switches to our live Sheet.
 */
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { IconAlert, IconCheck, IconLink } from '@/components/icons';
import type { PersonId } from '@/config/couple';
import { defaultApiUrl, saveConnection, testConnection, validateApiUrl, type TestResult } from '@/data/connection';
import { activateLive, setMe } from '@/data/store';
import { getDevice } from '@/data/device';
import { useMarkBusy } from '@/lib/busy';
import s from './Connection.module.css';

export interface ConnectionFormProps {
  onConnected?(): void;
  /** Tighter layout for onboarding. */
  compact?: boolean;
  /** Prefill (e.g. from a partial invite link). */
  initialUrl?: string;
  initialKey?: string;
  /** Person to check in as once connected (invite links). */
  as?: PersonId | null;
}

export function ConnectionForm({ onConnected, compact, initialUrl, initialKey, as }: ConnectionFormProps) {
  const id = useId();
  const [url, setUrl] = useState(() => initialUrl ?? defaultApiUrl());
  const [key, setKey] = useState(() => initialKey ?? getDevice('connection')?.key ?? '');
  const [show, setShow] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const dirty = url !== (initialUrl ?? defaultApiUrl()) || key !== (initialKey ?? getDevice('connection')?.key ?? '');
  useMarkBusy(dirty, 'connection-form');

  const checkUrl = () => {
    if (!url.trim()) return setUrlError(null);
    const c = validateApiUrl(url);
    setUrlError(c.ok ? null : c.message);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const c = validateApiUrl(url);
    if (!c.ok) {
      setUrlError(c.message);
      setResult(null);
      return;
    }
    setUrlError(null);
    setTesting(true);
    setResult(null);
    const r = await testConnection(c.url, key);
    setResult(r);
    setTesting(false);
    if (!r.ok) return;
    const config = { apiUrl: c.url, key: key.trim(), connectedAt: new Date().toISOString(), lastSyncAt: new Date().toISOString() };
    await saveConnection(config);
    if (as) setMe(as);
    await activateLive(config);
    setUrl(c.url);
    onConnected?.();
  }

  return (
    <form className={[s.form, compact ? s.compact : ''].join(' ')} onSubmit={submit} noValidate>
      <div className={s.field}>
        <label htmlFor={`${id}-url`} className={s.label}>Apps Script URL</label>
        <input
          id={`${id}-url`}
          className={s.input}
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="https://script.google.com/macros/s/…/exec"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={checkUrl}
          aria-invalid={urlError ? true : undefined}
          aria-describedby={`${id}-url-help`}
        />
        <p id={`${id}-url-help`} className={urlError ? s.error : s.helper}>
          {urlError ?? 'Should end in /exec. Paste the whole link.'}
        </p>
      </div>
      <div className={s.field}>
        <label htmlFor={`${id}-key`} className={s.label}>Passphrase</label>
        <div className={s.secret}>
          <input
            id={`${id}-key`}
            className={s.input}
            type={show ? 'text' : 'password'}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Our passphrase"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button type="button" className={s.reveal} onClick={() => setShow((v) => !v)} aria-pressed={show} aria-controls={`${id}-key`}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <div className={s.actions}>
        <Button type="submit" variant="primary" icon={<IconLink size={18} />} busy={testing} disabled={!url.trim() || !key.trim()}>
          {testing ? 'Checking our connection…' : 'Test connection'}
        </Button>
      </div>
      <p className={[s.result, result ? (result.ok ? s.ok : s.bad) : ''].join(' ')} role="status" aria-live="polite" data-testid="connection-result" data-outcome={result?.outcome}>
        {result ? (
          <>
            {result.ok ? <IconCheck size={18} /> : <IconAlert size={18} />}
            <span>{result.message}</span>
          </>
        ) : null}
      </p>
    </form>
  );
}

export default ConnectionForm;
