# name-canonical audit (local-01)

Grep sweep (case-insensitive `nothings` across every tracked file, plus full `git log -S` over
all history) found **zero** non-canonical spellings of the app name. Every user-visible string
already reads exactly `Suite Nothings`: `src/config/couple.ts` `appName`, `index.html` `<title>`,
manifest `name` (via `COUPLE.appName` in `vite.config.ts`; `short_name` stays "Our Suites"), the
iOS splash screens (`design/tools/export-icons.mjs` template), share/journey canvas wordmarks
(`render.ts` line 203, `journey/export/paint.ts` + `overlay.ts`), the footer signature block, the
About screen, and all docs. No `og:`/`twitter:` title tags exist in the PWA.

Screens that render the name ALL-CAPS as design styling (source text correct; styling left as-is):
1. **Onboarding / welcome eyebrow** — `.eyebrow` in `src/features/onboarding/Onboarding.module.css`
   has `text-transform: uppercase` and carries `COUPLE.appName` (Onboarding.tsx:106).
   Evidence: `welcome-eyebrow-390x844.png`.
2. **Share card headers (canvas)** — `src/features/share/render.ts:401` draws
   `COUPLE.appName.toUpperCase()` in the stats-card and journey-card headers; the share PNGs show
   "SUITE NOTHINGS". Mood-stamp arc labels upper case too (their own labels, not the app name).

Verified in the built app (vite preview, computed styles): header brand, hero brand, footer brand,
and About name all report `text-transform: none` and render "Suite Nothings".
