# Changelog

## [w2-journey] Journey mode, the "Indiana Jones" replay (2026-10-01)
- `src/features/journey/camera.ts`: pure camera maths (unit-tested, 22 tests) — great-circle interpolation and `line-progress`, the `z(t)` bell curve, bearing easing across ±180°, per-style leg duration/height, a van-Wijk-style "rise, travel, descend" centre LUT so flights don't crawl along the ground, and `planJourney`/`buildSchedule`/`stopIndexAt` tying legs into one scrubbable timeline (opening → hold → leg → hold → … → finale).
- `src/features/journey/player.ts`: one paused GSAP timeline drives every leg; each frame reads the active segment's `0–1` progress, computes the camera with `cameraAt()` and calls `map.jumpTo` — never `flyTo` — so play, pause, scrub, next/previous and the 0.5×/1×/2× speeds are all just timeline operations. The route draws as a ginger line with an ink casing (`line-progress`), a faded trail behind the active leg; the traveller (heart/car/plane) rides the tip, rotated to the heading, with bearing damped on hops and flights so the camera doesn't spin on every leg. Stay pins use the shared brand key-tag art and drop in with a bounce; wishlist pins pulse once the finale starts pulling back.
- `JourneyScreen.tsx`: the split-flap date board, postcard ("Stay 7 of 27", a line from the note, tap to pause and open the stay), the scrubber with month ticks, play/pause, prev/next, 0.5×/1×/2× speed, the all-time/this-year/home-city filter, and keyboard shortcuts (space, arrows, 1/2/3). Opens on 19 Jun 2026 flipping in, ends pulling back to the globe with the route, stats rolling in and "To be continued…". Reduced motion crossfades between stops instead of flying (a cream veil covers the cut) and keeps the postcards and date board. 0 stays gets the app's own "Our first check-in is waiting" empty state; 1 stay auto-plays a short single-stop replay (SPEC §10 is explicit about this, overriding copy.md's "need two stays" key — see DECISIONS.md); offline shows the map's Natural-Earth fallback style and still plays.
- `src/lib/sound.ts` is unchanged; a new `src/features/journey/music.ts` looks for an optional `/public/audio/journey.{mp3,m4a,ogg}` with a HEAD request and fails silently if there's none, looping it softly while playing and respecting the shared mute toggle.
- Phase 3 share, in `src/features/journey/export/`: `overlay.ts` draws the date board/postcard/pins/traveller/finale onto a 2D canvas; `video.ts` composes the WebGL map canvas plus that overlay into an offscreen 1080×1920 canvas, `captureStream()`s it and records with `MediaRecorder` (WebM, or MP4 on Safari via `isTypeSupported`); `story.ts` renders a 1080×1920 poster of the route and stats without needing a live map; `share.ts` goes through the Web Share API with files, falling back to a download. `ShareJourney.tsx` wires both into a sheet reachable from the finale, replaying at 2× while it records (about a minute) and hiding the video option where recording isn't supported.
- Map engine seam: `src/map/style.json`'s `boundary-state` filter is now null-safe (`coalesce(admin_level, 0)`), which silenced a MapLibre runtime warning the journey's globe camera triggered over certain OpenMapTiles boundary features.
- Tests: 55 unit tests across `camera.test.ts`, the `export/` module and `tests/unit/journey-data.test.ts`; `tests/e2e/map-journey.spec.ts` (15 e2e tests across the three WebGL projects) — plays start to finish at 20× through the `sn:e2e` hook, scrubbing, pause/play, opening a stay from a postcard, the home-city filter, and reduced motion — plus `tests/e2e/map-journey-checkpoint.spec.ts` for the committed cp3 evidence.
- Fixed along the way: `stopIndexAt`/`segmentAt` now tolerate a small epsilon, because GSAP's `timeline.time()` getter rounds its return value and a seek to an exact stop/segment boundary could read back a hair short and misreport the stop or phase.

## [int-1] Integration wave 1 (2026-10-01)
- Merged w1-backend, w1-map, w1-stays, w1-add-stay and w1-shell into `main` (`--no-ff`, in that order). There were no textual conflicts, and the overlapping BottomSheet fixes from w1-stays and w1-add-stay are both kept.
- Seams:
  - The `upsertLetter` outbox op now goes through the Sheets adapter and `opEntity`. It was a typecheck break after the merge.
  - Stays cards animate in from `useRecentArrivals()`, so only the other person's stays animate, not our own echoes.
  - The stays hero sets `data-hero`, so the desktop header stays transparent over the whole hero.
  - On iOS the install banner opens the shell's illustrated Add to Home Screen sheet.
  - Photo uploads read WebKit's `bytes` fallback, so iOS photos are no longer uploaded empty.
  - `VITE_ALLOW_LOCAL_API=1` is accepted everywhere.
- Fixes found in the whole-app pass:
  - Settings stays mounted when Demo ↔ Live re-inits the store. The "Connected" result used to vanish, which failed 2 of the 6 live-sync e2e tests.
  - New hotels no longer show an endless "Fetching hotel info…" skeleton while enrichment is still a no-op.
- Tests: the foundation smoke, settings and stays specs now follow the merged UI (full onboarding, the combobox search, the Clear demo data confirm, the delete confirm, tabs). Write a future note now runs on touch viewports too.
- Phase 1 acceptance is recorded in `design/checkpoints/cp2/ACCEPTANCE.md`. The one-tap revisit takes 6.0–6.4 s. The visual pass evidence is in `design/checkpoints/int-1/`.

## [w1-map] 2026-10-01
- The 3D map (SPEC §9): one MapLibre 6 adaptive globe with City / Country / World chapters whose breakpoints come from the home base (Dubai 9.48 / 5.49; London and Singapore are tested). Every chapter change is a zoom-interpolated crossfade (pins → city bubbles → country bubbles, 3D buildings, arcs), and a gentle settle after gestures stops as soon as you touch the map again.
- HUD: a split-flap chapter title on a contrast plate (light or dark with the lighting), a debounced "n stays in view" count, one-line chips that scroll sideways (City, Country, World, List view), a lighting and route menu, a compass, and an always-visible OSM/OpenFreeMap attribution in the reserved bottom-left corner.
- Pins: rasterised brand key-tag pins with revisit counts, a ginger glow for favourites, dashed wishlist pins and the home marker. The selected pin and its neighbours become labelled HTML buttons. Tapping a pin opens a StayCard (a sheet on mobile, a floating card on desktop) that links to `#/stay/:id`. `?city=` and `?focus=` work, and the list view groups stays by chapter and then city.
- Daylight lighting from a solar-position model (dawn, day, golden hour, sunset, night) drives the sky, light, land, water, roads, buildings and labels. It refreshes every 5 minutes and Settings can override it. The World chapter has an idle spin, which reduced motion turns off.
- Fallbacks: Natural Earth 110m land (86 KB) lets the globe, pins and arcs render offline, and home-city tiles for z9–14 are pre-warmed politely (at most 300).
- `createSuiteMap` engine API for the journey (lines with `line-progress`, markers, project/unproject), and a real lazy `MiniMap` (pin drop, pin picker, StayArt fallback).
- Tests: 46 new unit tests (chapters, lighting, pins, list grouping, prewarm) and 22 map e2e runs across 390, 412 and 1440 (about 32 fps zooming with software GL). Checkpoint 2 evidence is in `design/checkpoints/cp2/map/`.
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
## [w1-backend] 2026-10-01
- `apps-script/Code.gs` + `appsscript.json`: every SPEC §6 endpoint plus `upsertLetter`, APP_KEY auth (constant-time), script lock, LWW idempotent upserts, header-name reads that survive hand edits, Drive photos, `Maps` geocoder, Log tab, re-runnable `setup()`, `selfTest()`, and an `onEdit` stamp for hand edits. The wire contract is in `apps-script/PROTOCOL.md`.
- `tools/gas-harness/`: a Node harness of the Apps Script services that runs Code.gs in Vitest, including messy-sheet cases. `tools/mock-apps-script.mjs` serves the real Code.gs over HTTP with Google's 302 hop, for e2e. `npm run letter:gs` builds the private `Letter.gs`.
- Sheets adapter: simple-request POSTs, timeouts, typed errors (`not_apps_script`, `unauthorized`, `network`, `server`), tolerant row parsing, base64 photo upload and a cached photo download.
- Sync: polls every 20 s while visible, and on focus, `online` and after writes; an overlap watermark; per-entity outbox ordering; broken-link detection; and `onArrival` / `useRecentArrivals()`.
- Connection: validation, a copy in IndexedDB that survives cache clears, Test connection with the four plain results, the Settings section (link, last sync, Sync now, Demo ↔ Live, invite QR and share link, explicit demo import) and `#/join`.
- SETUP.md (for a designer) and README.md.

## [w1-stays] Stays home and Stay detail
- Home, in the order of SPEC §3.3: full-bleed hero (latest photo or the illustrated `HeroArt` scene, which follows the time of day in Dubai), a headline picked from our data, Dayuse-style search with live results (names, areas, notes; `/` focuses it), "We're at a hotel right now"; a hero-grade split-flap counter with a 5-stat trust card; "Our stays" with city tabs, a filters sheet (city, year, type, rating, who picked it) and `DiaryCard`s that animate in when a stay arrives from the other phone; "See all our {city} stays"; "Our story in three stays"; the install banner; `MomentsSlot`; the "Next check-ins" teaser; the live FAQ; the brand marquee; the footer with a together-since counter that updates every minute. Loading skeletons and the zero-stays state are designed too.
- Stay detail: shared-element header, ink-outlined photo patchwork with a full-screen viewer (pinch-zoom, swipe, keyboard), notes with inline editing, mood stamp, both ratings (rate in place), our visits here plus "Visit again", hotel info with enrichment skeletons and "Refresh info", MiniMap, Google/Apple/Waze links, edit/share/soft delete with undo, and a not-found state.
- Archivo is now the display face; the `src/features/share` fallback (Web Share, then clipboard) is in place.
- Tests: `tests/unit/stays-logic.test.ts` (headline, FAQ, filters, moments), `tests/unit/photo-viewer.test.tsx`, `tests/e2e/stays.spec.ts` (24 passing across 3 projects).

## w1-shell
- Intro: a lazy Three.js first-launch scene (toon-shaded door, card reader and the 619 key tag on its ring, with ink edge lines). The card taps the lock, the light goes green and the door opens. There's a 2D SVG/CSS fallback for reduced motion, low-end devices and slow chunk loads, and a 400 ms version on later launches. Tap or any key skips.
- Onboarding: Who's checking in → Connect (Try demo or ConnectionForm; skipped after an invite) → Home base (mini map plus a Photon city picker) → Install (Android prompt, iOS illustrated steps, Maybe later) → Check-in complete.
- The letter: "A note on your pillow" slides in on the reader's first launch, lifts and flips in CSS 3D, and reveals line by line with a mask sweep. It's signed, with "Written in Dubai, September 2026" beneath. The markdown is rendered safely and `read_at` is written on open. Nirsh gets a one-time "Shady read your note" toast. The Letters list shows sealed envelopes with hints, and "Write a future note" saves through `upsertLetter`.
- Settings, export/import, PWA manifest, service worker and install wiring (see the helper commits).
