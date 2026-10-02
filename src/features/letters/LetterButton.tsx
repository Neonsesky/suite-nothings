/** Discreet sealed-envelope button in the persistent chrome: the letter is always one tap away. */
import { useMe } from '@/data/store';
import { SealedEnvelope } from './SealedEnvelope';
import { usePrimaryLetterHref } from './access';
import s from './LetterButton.module.css';

export function LetterButton({ className }: { className?: string }) {
  const me = useMe();
  const href = usePrimaryLetterHref();
  if (!me) return null;
  return (
    <a href={href} className={`${s.btn} ${className ?? ''}`} aria-label="Read our letter">
      <SealedEnvelope size={22} />
    </a>
  );
}
