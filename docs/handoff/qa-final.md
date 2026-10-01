# qa-final-2 handoff: release QA completion (main checkout, post-polish)

Picked up where the first `qa-final` pass ran out of budget and after the polish pass that
followed it. Read `int-1.md`, every `w2-*.md`, `CHANGELOG.md`, `DECISIONS.md` and `git log` first;
nothing here repeats what those already cover.

## Verified

- **Housekeeping.** No stray servers on 5420/5430 at session start. Everything ran on 5450.
- **Full matrix.** `typecheck`, `lint`, `test` (561 unit tests, 39 files), `build`, `size`
  (165.2 KB initial JS gzipped, budget 300 KB — map/three/gsap/qrcode excluded as designed) all
  pass clean.
- **Full `npm run e2e`**: **283 passed, 44 skipped, 0 failed.** Skips are the
  `CHECKPOINTS=1`-gated evidence specs (expected) plus this session's viewport-restricted morph/
  price-level tests. The two failures w2-enrich flagged (`settings.spec.ts` ERR_CONNECTION_REFUSED
  ×3, `map.spec.ts`'s boundary-state warning) **no longer reproduce at all** — fixed upstream by
  w2-journey's `style.json` coalesce fix and the wave-2 merge. The one flake qa-final documented
  (`milestones.spec.ts` "first stay slams the stamp", a `modulepreload` console warning under
  parallel-worker contention) reproduced zero times across 3 isolated `--workers=1` reruns and
  zero times in this session's full 3-worker run — confirmed pre-existing CPU-contention noise,
  not a bug.
- **Public-repo hygiene.**
  - Every tracked image under `design/` whose name suggested a reference/comparison/dayuse shot
    was checked (letter/pillow-card images, the maskable safe-zone before/after, the manual-pin
    clipped-buttons shot). All are original app screenshots; nothing new to move. (qa-final had
    already moved the one real Dayuse composite out.)
  - `git grep` for Apps Script URLs / API key patterns: only the two deliberately-fake test
    fixtures in `tests/unit/connection.test.ts` (`AKfycbx1234567890abcdef`, clearly a test
    placeholder, not a real deployment id). No real secrets.
  - Private letter: 4 distinctive phrases, each checked with `git grep -F` on the working tree
    and `git log --all -S` on full history — **zero hits outside `private/`** for all 4, in both
    checks. (Counts only, per instructions — text never printed or committed.)
  - `.gitignore` already covers `private/`, `design/references/`, `.tmp/`, `test-results/`,
    `playwright-report/`, `.env*.local`.
- **Letter hand-off.** `npm run letter:gs` → `private/Letter.gs` generated, defines
  `seedLetters_`, confirmed untracked (`git status` silent on `private/`).
- **SETUP.md.** All 4 required items were already present from the polish pass: personal-Gmail
  vs. Workspace warning + troubleshooting row, "don't pick Shady when testing on Nirsh's phone"
  right before the phone steps, the QR/link passphrase-sharing caution, and the `letter:gs` →
  `Letter.gs` step. No changes needed.
- **Intro timing** (`tests/e2e/qa-final-2.spec.ts`): first launch fully gone in ≤2.5s (measured
  from first-contentful-paint to the intro unmounting, in-page via `performance.now()` — Node-side
  `expect().toBeVisible/Hidden()` round-trips over CDP add 100s of ms of polling latency that
  would otherwise falsely fail a sub-second budget). Repeat launch ≤550ms. 3/3 repeats passed.
  8 key frames + a short clip's worth of evidence at `design/checkpoints/qa/intro/`.
- **Visual QA.** Full-page screenshots across every route/state (`design/checkpoints/qa/screens/`)
  — onboarding (4 screens), Stays home, Stays empty, Map, every add-a-stay step (search +
  manual-pin), Stay detail, Journey, Us, Letters (closed card only), Wishlist, Settings, the
  offline banner, and the error boundary. The spec also builds a per-viewport contact sheet by
  compositing these (stitching `<img>`s into one page and re-screenshotting — avoids adding a PNG
  dependency), but the composited files were 10–96 MB at retina resolution and not worth
  committing; the per-state PNGs are the real evidence and are what I reviewed. Kept the full
  390px set (the primary target) plus a representative subset at 412px/1440px (home, map, stay
  detail, settings, onboarding) rather than tripling the committed weight — no overlaps,
  clipping, or obviously broken spacing
  found. The error-boundary fallback needed a small QA-only test seam (see Decisions) since
  nothing in the app previously had a way to trigger a real React render error on demand.
- **Console.** `tests/e2e/console-clean.spec.ts` (pre-existing, re-run) passes clean across every
  route at both mobile and desktop. Headless SwiftShader's "GPU stall due to ReadPixels" driver
  warning is filtered as allowed noise (`tests/e2e/helpers.ts`'s `watchConsole`), per instructions.
- **Lighthouse (mobile, Stays home).** Accessibility 100, Best Practices 100 — both meet target.
  **Performance 61 — does not meet the ≥90 target**, improved from the prior pass's 56–57 by
  deferring the intro's three.js import off the critical path (see Decisions and
  `design/checkpoints/qa/lighthouse/summary.md` for the full root-cause: ~20 small initial-path JS
  chunks each carry simulated-4G RTT overhead under Lighthouse's throttle profile, even though
  total transferred size is well inside budget). A `vite.config.ts` `manualChunks` consolidation
  would likely close most of the gap but is a broader, riskier change (affects long-term caching
  and what's eager vs. lazy app-wide) than this slice's remaining budget allowed to attempt and
  fully re-verify safely. Installability confirmed manually (valid manifest, icons, service
  worker) since Lighthouse 13 removed the `pwa` category.
- **PWA.** Manifest valid, service worker registers and controls the page, offline reload works
  and a stay can be added offline (all pre-existing, re-run clean), and the "fresh version is
  ready" update toast — previously untested — now has real e2e coverage
  (`tests/e2e/pwa.spec.ts`), bumping the built `sw.js`'s bytes on disk and driving the actual
  workbox-window update path.
- **Card → detail morph.** Recorded frames at 390 (`design/checkpoints/qa/morph/`); the first
  attempt caught the native View Transition mid-cross-fade (a real but harmless capture-timing
  artifact, not a bug) — fixed by waiting for the transition to settle before the "done" shot.
- **Price level.** Screenshot at 390 (`design/checkpoints/qa/price-level/`): ¤ glyphs render
  crisply (no tofu), filled (ink) vs. empty (line colour) are clearly distinct, `role="radio"` +
  `aria-label="Price level N of 4"` confirmed via the DOM, not just visually.

## Fixed this session

- `src/features/intro/Intro.tsx`: deferred the three.js chunk import to `requestIdleCallback`
  (Lighthouse Performance 56→61; see above).
- `src/app/Shell.tsx`: added `CrashProbe`, a QA-only, e2e-flag-gated component so the real error
  boundary fallback can be screenshotted (see Decisions for exact gating).
- `tests/e2e/pwa.spec.ts`: added the update-toast test (the one previously-untested PWA
  requirement).
- `tests/e2e/qa-final-2.spec.ts`: new spec covering intro timing, the visual contact sheets, the
  morph, and the price-level glyphs.

## Still open (honest)

- **Lighthouse Performance is 61, not ≥90.** Root cause identified and documented; the fix
  (chunk consolidation) needs its own slice with budget to re-verify the size check, PWA
  precaching and the full e2e suite afterward. Not attempted here — too broad a change to risk
  without that room.
- Everything in `int-1.md`'s open list that qa-final already deferred to the owner is still
  deferred (map "Locate me" control, add-stay's desktop side panel vs. centred modal, read-only
  photo captions in edit mode, the phone back-button skipping the morph). None block Demo Mode,
  Live Sheet, or the core flows.
- The visual QA pass was a sampled review (representative screens across all 3 viewports, the
  full set at 390), not a pixel-by-pixel audit of all ~70 screenshots at all 3 viewports — nothing
  suspicious turned up in the sample, but a fuller pass could still find something small.

## Manual test checklist for Nirsh (can't be automated here)

- [ ] Real install prompts on Android (Chrome) and the actual "Add to Home Screen" flow on iOS
      Safari — Playwright can't trigger a real browser install prompt.
- [ ] iOS standalone-mode quirks (status bar, safe-area insets, the splash screens) on a real
      iPhone — the 12 splash images are pre-rendered but never visually confirmed on-device here.
- [ ] Haptics (`Celebration`, `MapScreen` chapter change, `MilestoneUnlock`) — no haptic engine in
      a headless browser.
- [ ] Real Apps Script sync between two actual phones (one as Nirsh, one as Shady) once SETUP.md
      is followed for real — this session only exercised the Demo adapter and the Node Apps
      Script harness, never a live Google Sheet round-trip between two devices.
- [ ] Drive photo upload end-to-end (a real photo, a real Apps Script deployment) — the add-stay
      photo pipeline is unit/e2e tested against fixtures, not a live Drive upload.
- [ ] The intro and journey replay's real smoothness on a mid-range Android phone — this
      environment only has software-rendered WebGL (SwiftShader); frame timing on real GPU
      hardware hasn't been profiled by any wave.
- [ ] Lighthouse Performance in the real world (a real phone on a real network) will likely score
      meaningfully better than the simulated-throttle 61 here, since actual HTTP/2 connection
      reuse and real CPU are both far more forgiving than Lighthouse's simulation — worth a real
      PageSpeed Insights check once Pages is live.
