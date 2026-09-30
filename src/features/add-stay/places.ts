/** Offline helpers for hand-entered hotels. */

let names: Map<string, string> | null = null;

/** ISO alpha-2 code for an English country name ("Oman" → "OM"), using the browser's own region names. */
export function countryCodeFor(country: string): string | null {
  const wanted = country.trim().toLowerCase();
  if (!wanted) return null;
  if (/^[a-z]{2}$/.test(wanted)) return wanted.toUpperCase();
  if (!names) {
    names = new Map();
    try {
      const dn = new Intl.DisplayNames(['en'], { type: 'region' });
      const A = 65;
      for (let i = 0; i < 26; i++)
        for (let j = 0; j < 26; j++) {
          const code = String.fromCharCode(A + i, A + j);
          const name = dn.of(code);
          if (name && name !== code) names.set(name.toLowerCase(), code);
        }
    } catch {
      // No Intl.DisplayNames: callers fall back to the home country.
    }
    names.set('uae', 'AE');
    names.set('uk', 'GB');
    names.set('usa', 'US');
  }
  return names.get(wanted) ?? null;
}
