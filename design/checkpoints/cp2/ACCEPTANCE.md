# Phase 1 acceptance (SPEC §19): checkpoint 2

Checked on `main` after int-1 merged wave 1. Every test below ran against the production
preview (`npm run e2e`) on the `iphone-390`, `pixel-412` and `desktop-1440` projects. Map specs
ran on the `map-390`, `map-412` and `map-1440` projects.

## 1. A stay in under 30 s on a phone, and a revisit in one tap: **pass**
- **Test:** `tests/e2e/add-stay.spec.ts` → "one-tap revisit with a photo takes under 30 seconds".
  - The stopwatch includes a 700 ms human pause between taps.
  - One tap on a past hotel preselects it and jumps to step 2/5 (When).
  - Then: Next, Next, add a photo, Next, rate 4 of 5, Save, skip the celebration, "Stay saved".
  - It asserts `< 30 s`. Measured with int-1: **6.4 s** (iphone-390), **6.0 s** (pixel-412) and **6.0 s** (desktop-1440).
- **A new hotel end to end:** "new stay through Photon search, every step, then celebration" in the same spec.
  "offline search falls back to adding by hand with a pin" covers adding without a network.
- **Celebration recording:** `cp2/save-celebration/save-celebration-390.webm`, with frames in `cp2/save-celebration/frames/`.

## 2. The map zooms Dubai → UAE → globe with continuous crossfades and a flipping title: **pass**
- **Frames:** `cp2/map/frames/01-z11.00.png` … `12-z1.20.png`. Each frame is named after its zoom.
  - The city → country flip lands at z 9.48, between frames 04 (z 9.53) and 05 (z 9.28).
  - The country → world flip lands at z 5.49, between frames 09 (z 5.54) and 10 (z 5.19).
  - The frames on either side of each breakpoint show the layers partly blended, so the crossfade is continuous rather than a cut.
- **Video:** `cp2/map/zoom-and-chips-390.webm`.
- **Stills:** city, country and world, day and night, at 390, 412 and 1440 (`cp2/map/*-day-*.png`, `*-night-*.png`).
- **Tests:** `tests/e2e/map.spec.ts` has three that cover this:
  - "zooming from the city to the globe flips through all three chapters";
  - "the flip lands on the computed breakpoints";
  - "zooming keeps a reasonable frame rate" (about 32 fps on software GL).

## 3. Installable, and works in airplane mode: **pass (emulated)**
- **Manifest:** `tests/e2e/pwa.spec.ts` "is linked, valid, and every icon resolves" (name, start_url, display, maskable icons).
- **Service worker:** "registers and controls the page after a reload".
- **Airplane mode:** "the app shell and stays still render offline (IndexedDB), then comes back online".
  The test sets the context offline, reloads, and checks the stays render from IndexedDB and the precached shell.
- **Offline save:** `add-stay.spec.ts` "offline save says it will sync".
- **Offline map:** `map.spec.ts` "renders the offline fallback globe when tiles fail".
- **iOS:** `pwa.spec.ts` "iOS install sheet …" covers Add to Home Screen. Installing on a real
  Android or iOS device can't be tested here; the owner should check it on their phones.

## 4. Shady's first launch shows the pillow note: **pass**
- **Test:** `tests/e2e/shell-flow.spec.ts` "Shady's first launch shows the pillow note, and reading it sets read_at".
  It needs `private/letter.md`, which is present in the main checkout. In CI, where the file is missing, the test is skipped.
- **Screenshot:** `design/checkpoints/w1-shell/letter/` has only the sealed envelope. Screenshots of the letter body are kept out of the repo.

## Suite status at sign-off
See the "Integration wave 1" entry in `CHANGELOG.md` for the command results.
