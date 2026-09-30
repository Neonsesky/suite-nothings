# Changelog

## [w0-foundation] 2026-09-30
- Scaffold: Vite 8, React 19.3, TypeScript 6.0 (strict), ESLint 10 and typescript-eslint 8 (zero warnings), Vitest 5 with happy-dom and fake-indexeddb, Playwright 1.63 (WebKit 390, Chromium 412, desktop 1440), vite-plugin-pwa (generateSW, prompt; runtime caching for OpenFreeMap and Photon). Every dependency is pinned and the lockfile is committed.
- Hash router with every route pre-registered and lazy-loaded; shell with the mobile tab bar, desktop header, N/M/J// shortcuts, global and per-route error boundary, toast host, offline banner and Demo badge; first-launch redirect to `#/welcome`.
- Data layer: typed domain model, namespaced IndexedDB (`demo`/`live`), reactive store with an outbox on every write, LWW merge and soft delete/undo, a minimal sync engine (backoff, online/offline), a demo adapter backed by its own IDB, and a seed of 11 Photon-geocoded hotels and 12 visits covering glide, hop and flight legs.
- The private letter is served through `virtual:private-letter` (build-time only; `null` in CI), and `tools/check-private.mjs` guards against leaks.
- Core components: SplitFlap, BottomSheet, Button, Chip/ChipGroup, Badge, TimestampChip, Toast, Skeleton, ClockLoader, EmptyState, ErrorState, OfflineBanner, Stamp, DemoBadge, StayCard, StayArt, and provisional icons. `#/gallery` shows them all.
- Lib: dates, geo, geocode (Photon), ulid, stats, motion, haptics, sound, busy, toast and useMediaQuery, all unit-tested (191 Vitest tests in total).
- Stays v1 (hero, split-flap counter, stats, city tabs, search, card grid) and working stubs for every other route.
- CI: `.github/workflows/deploy.yml` deploys to GitHub Pages and copies `404.html`; `npm run size` checks the initial JS (128.1 KB gzipped).
## [w0-design] Phase 0: design

- Measured dayuse.ae tokens (CSS bundles + computed styles); `design/tokens.md`, `src/styles/tokens.css` with WCAG AA table.
- Self-hosted Manrope + JetBrains Mono (`public/fonts/`, `src/styles/fonts.css`).
- Key-tag mark (`KeyTagMark`, full/mono/outline), favicon, PWA icons (any, maskable, monochrome), apple-touch icon, 12 iOS splash screens (`design/icons.md`).
- Ink-outline icon set (55 icons), mood stamps (8), map pin SVGs (stay, wishlist, home, cluster).
- Design plan with wireframes for every screen + critique (`design/plan.md`), copy deck (`design/copy.md`).
- Static clickable prototype (`design/prototype/`) and Checkpoint 1 artifacts (`design/checkpoints/cp1/`).
## [w1-backend] 2026-10-01
- `apps-script/Code.gs` + `appsscript.json`: every SPEC §6 endpoint plus `upsertLetter`, APP_KEY auth (constant-time), script lock, LWW idempotent upserts, header-name reads that survive hand edits, Drive photos, `Maps` geocoder, Log tab, re-runnable `setup()`, `selfTest()`, and an `onEdit` stamp for hand edits. The wire contract is in `apps-script/PROTOCOL.md`.
- `tools/gas-harness/`: a Node harness of the Apps Script services that runs Code.gs in Vitest, including messy-sheet cases. `tools/mock-apps-script.mjs` serves the real Code.gs over HTTP with Google's 302 hop, for e2e. `npm run letter:gs` builds the private `Letter.gs`.
- Sheets adapter: simple-request POSTs, timeouts, typed errors (`not_apps_script`, `unauthorized`, `network`, `server`), tolerant row parsing, base64 photo upload and a cached photo download.
- Sync: polls every 20 s while visible, and on focus, `online` and after writes; an overlap watermark; per-entity outbox ordering; broken-link detection; and `onArrival` / `useRecentArrivals()`.
- Connection: validation, a copy in IndexedDB that survives cache clears, Test connection with the four plain results, the Settings section (link, last sync, Sync now, Demo ↔ Live, invite QR and share link, explicit demo import) and `#/join`.
- SETUP.md (for a designer) and README.md.
