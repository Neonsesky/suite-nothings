/** Ink-outlined sealed envelope with a ginger heart seal, for letters that haven't opened yet. */
export function SealedEnvelope({ size = 72, open = false }: { size?: number; open?: boolean }) {
  return (
    <svg viewBox="0 0 96 72" width={size} height={(size * 72) / 96} aria-hidden="true">
      <rect x="4" y="10" width="88" height="58" rx="8" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="2.5" />
      {open ? (
        <path d="M6 14 L48 -8 L90 14" fill="var(--color-cream)" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      ) : (
        <path d="M6 14 L48 44 L90 14" fill="var(--color-cream)" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      )}
      <path d="M6 66 L38 38 M90 66 L58 38" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      {open ? null : (
        <>
          <circle cx="48" cy="44" r="11" fill="var(--color-ginger)" stroke="var(--color-ink)" strokeWidth="2.5" />
          <path d="M48 49 C 43 45.5, 43.5 40.5, 46.2 40.5 C 47.2 40.5, 48 41.3, 48 42 C 48 41.3, 48.8 40.5, 49.8 40.5 C 52.5 40.5, 53 45.5, 48 49 Z" fill="var(--color-paper)" />
        </>
      )}
    </svg>
  );
}
