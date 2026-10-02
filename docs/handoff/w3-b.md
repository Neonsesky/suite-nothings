# w3-b: seamless return, the letter always available, "already done" for A2HS

## What changed
1. **Seamless return.** Audited the first-launch flow end to end. Return visits were already
   gated correctly by two existing device prefs: `sn:device:introSeen` (intro plays full once,
   ~400ms short replay after) and `sn:device:me` (onboarding's who/connect/home/install steps only
   show while `me` is unset). No remaining first-time-only gate found, so no production code
   changed for this part — added regression coverage instead (`shell-flow.spec.ts`: "return visit
   skips every first-time gate…", which also dispatches a `pageshow(persisted:true)` to simulate
   iOS Safari's back-from-background bfcache resume).
2. **The letter, always reachable.** New `LetterButton` (sealed-envelope icon, ink-outline style)
   lives in the persistent chrome: `Header`'s nav on desktop, `MobileTopBar` next to the demo
   badge on mobile. It deep-links straight to the most relevant readable letter for whoever's on
   this device (`usePrimaryLetterHref` in `src/features/letters/access.ts`), falling back to the
   `#/letters` list if nothing's unlocked yet or letters haven't loaded from IndexedDB yet (a
   brief window right at boot — graceful, not a dead end). The pillow-note first-read easter egg
   (`PillowHost`) is untouched and still fires independently.
3. **A2HS "Already done".** `InstallBanner` (`src/features/stays/Sections.tsx`) gained a third
   button next to "Add to home screen" / "Not now". Dismissal now lives in a new
   `installDismissed` field on `src/data/device.ts`'s `DevicePrefs` (reactive via
   `useDevicePref`/`setDevice`, replacing an ad-hoc raw `localStorage` key), and the banner also
   self-dismisses once `isStandalone` is true so it won't resurface if she later opens a shared
   link in a plain browser tab on the same device.

## Verification
- `npm run typecheck && npm run lint && npm run test && npm run build` — all pass (561 unit tests,
  clean build, initial JS chunk unchanged at ~176 KB gzip).
- `npm run e2e` (full suite, `PREVIEW_PORT=5493`): 251/255 runnable specs pass at `--workers=2`;
  the only failures are a pre-existing webkit-only flake (`iphone-390` project) where a
  `modulepreload`/font-preload "resource preloaded but not used" console warning shows up under
  load — confirmed non-deterministic (different unrelated spec fails each rerun: `add-stay`,
  `components`, `milestones`, `smoke`, `stays`, `us`, or `shell-flow`'s pre-existing "Shady's first
  launch" test) and reproduces even at `--workers=1` in isolation specifically on the webkit lane,
  never on `pixel-412`/`desktop-1440`. Not caused by this task's changes — none of the failing
  specs' assertions relate to the letter button, A2HS banner, or launch flow, and my own new tests
  pass 100% in every isolated rerun across all three projects.
- New/updated e2e: `tests/e2e/shell-flow.spec.ts` ("return visit skips every first-time gate…",
  "the letter button opens the letter from every main screen") and `tests/e2e/pwa.spec.ts`
  ('"Already done" permanently hides it, even across a reload'). Also fixed a latent strict-mode
  ambiguity the new "Already done" button exposed in the existing iOS install sheet test (its
  `getByRole('button', { name: 'Done' })` now substring-matched two buttons; made it `exact: true`).
- Screenshots: `docs/review/w3-b/` — letter button on the Stays home hero, A2HS banner shown and
  hidden, at 390×844 (plus bonus 412×915/1440×900 captures).

## Risks / known gaps
- Right at cold boot, before letters finish loading from IndexedDB (typically well under a
  second), the letter button briefly points at the `#/letters` list rather than the specific
  letter — a harmless one-extra-tap degrade, not a dead link. Tests wait for the real deep link
  before asserting, since clicking during that window is not the behaviour under test.
- The webkit font-preload flake above is pre-existing and out of this task's scope; worth a
  dedicated look if it starts blocking CI reliably (likely related to the font-preload work in the
  `perf-1` commit).
