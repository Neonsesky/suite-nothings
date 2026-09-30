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

## [w1-stays] Stays home and Stay detail
- Home, in the order of SPEC §3.3: full-bleed hero (latest photo or the illustrated `HeroArt` scene, which follows the time of day in Dubai), a headline picked from our data, Dayuse-style search with live results (names, areas, notes; `/` focuses it), "We're at a hotel right now"; a hero-grade split-flap counter with a 5-stat trust card; "Our stays" with city tabs, a filters sheet (city, year, type, rating, who picked it) and `DiaryCard`s that animate in when a stay arrives from the other phone; "See all our {city} stays"; "Our story in three stays"; the install banner; `MomentsSlot`; the "Next check-ins" teaser; the live FAQ; the brand marquee; the footer with a together-since counter that updates every minute. Loading skeletons and the zero-stays state are designed too.
- Stay detail: shared-element header, ink-outlined photo patchwork with a full-screen viewer (pinch-zoom, swipe, keyboard), notes with inline editing, mood stamp, both ratings (rate in place), our visits here plus "Visit again", hotel info with enrichment skeletons and "Refresh info", MiniMap, Google/Apple/Waze links, edit/share/soft delete with undo, and a not-found state.
- Archivo is now the display face; the `src/features/share` fallback (Web Share, then clipboard) is in place.
- Tests: `tests/unit/stays-logic.test.ts` (headline, FAQ, filters, moments), `tests/unit/photo-viewer.test.tsx`, `tests/e2e/stays.spec.ts` (24 passing across 3 projects).
