# Changelog

## [w1-add-stay] 2026-10-01
- Add a stay (`#/add`): draggable five-step sheet (Hotel, When, What we did, Photos, The good part) with a progress bar, Back/Next in the thumb zone, draft autosave with "Pick up where we left off?", and a "Discard this stay?" confirm on swipe-down, Esc or close.
- Hotel step: previous hotels first (one-tap revisit straight to When), debounced Photon autocomplete biased to GPS/home base with keyboard navigation and loading/empty/error/offline states, the server geocoder as a fallback, "We're here now" (nearest first, denied/unavailable states) and a manual pin drop.
- Photos: library + camera, EXIF read first ("These photos say 12 Jul 2026 at … Use that?"), on-device resize to 480/1600 px WebP (JPEG fallback) with orientation applied and EXIF stripped, reorder, remove, captions.
- Save: hotel → visit → photos through the store/outbox; "Stay saved" or "Saved on this phone, will sync"; save celebration (key card, green light, split-flap, pin drop, haptic, sound; tap to skip; reduced-motion crossfade), then the stay detail or home. Edit mode via `?edit=`.
- Router: sheet routes keep the background screen's params (`LocationProvider`). BottomSheet: `onDismissAttempt`, footer taps no longer swallowed. exifr no longer preloaded (initial JS 130 KB).
- Tests: draft/save-plan/saveStay units, EXIF + image units with fixture JPEGs, real-browser image pipeline spec (dev), nine add-stay e2e flows incl. a timed revisit (< 30 s), offline, manual pin, draft reload, edit mode and the stay-detail background. Checkpoint 2: `design/checkpoints/cp2/save-celebration/`.

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
