# w2-journey handoff

## What's here

- `src/features/journey/camera.ts` — pure camera maths, unit-tested in `camera.test.ts` (22 tests,
  including continuity at every leg boundary and the seed timeline's total duration, 85.15 s).
- `src/features/journey/player.ts` — `JourneyPlayer`: one paused GSAP timeline, one `jumpTo` per
  frame, never `flyTo`. Owns the route lines, the stay/wish markers and the traveller icon.
- `src/features/journey/data.ts` — filter/sort/stats helpers, tested in
  `tests/unit/journey-data.test.ts` (13 tests), following the `tests/unit/factories.ts` convention
  used by `tests/unit/stats.test.ts` rather than a colocated test file.
- `src/features/journey/music.ts` — optional soundtrack via a HEAD request for
  `/public/audio/journey.{mp3,m4a,ogg}`.
- `src/features/journey/export/` — Phase 3 share: `overlay.ts` (canvas drawing), `video.ts`
  (`captureStream` + `MediaRecorder`), `story.ts` (1080×1920 poster), `share.ts` (Web Share +
  download fallback). 20 unit tests across the three `.test.ts` files.
- `JourneyScreen.tsx`, `Postcard.tsx`, `Finale.tsx`, `ShareJourney.tsx`, `Journey.module.css`,
  `Share.module.css`.
- `tests/e2e/map-journey.spec.ts` (15 tests × 3 WebGL projects) and
  `tests/e2e/map-journey-checkpoint.spec.ts` (cp3 evidence, `CHECKPOINTS=1` only).

## Additive edits outside `src/features/journey/**`

- `src/map/style.json`: `boundary-state`'s filter now wraps `admin_level` in `coalesce(…, 0)`.
  Some OpenMapTiles boundary features have a null `admin_level`, which MapLibre logged as a
  runtime warning whenever the journey's globe camera panned over them. Ran the full `map-*` e2e
  suite (`map.spec.ts`, `map-checkpoint.spec.ts`) afterwards — no regressions, warning gone.
- `src/features/journey/JourneyScreen.tsx`'s zero-stays empty state reuses the app-wide
  `states.empty.title`/`cta` copy ("Our first check-in is waiting" / "Add our first stay"),
  matching `StaysScreen`'s `EmptyHome`, instead of journey-specific copy.

## Open items / known gaps

- **`journey.empty.*` in copy.md is unused.** Its copy ("Need two stays to make a journey…") reads
  like it was meant to block the 1-stay case, but SPEC §10 point 9 explicitly says "1 stay gets a
  short single-stop replay" — the architecture already supports this with zero legs, so I kept it
  playable and left those two keys unused. Flagging for design review: either drop the keys or
  confirm the 1-stay auto-play is right and update copy.md's note.
- **No `ffmpeg` in this environment.** The spec asks to "extract frames with ffmpeg (about 2 fps)"
  from a recording. Instead, `map-journey-checkpoint.spec.ts` pauses the player and seeks to exact
  moments for each key frame — strictly more precise than sampling a recording — and separately
  records a short *real* 2×-speed video (`replay-2x-390.webm`, 724 KB) so the actual tweened motion
  gets reviewed too, not just stills. If a later wave has ffmpeg available, re-point that spec's
  video step at the full 1× replay and extract frames from it instead.
- **Share video recording** depends on `HTMLCanvasElement.captureStream` + `MediaRecorder`, both
  checked at runtime (`canRecordVideo()`); the button is hidden when unsupported, and only the
  story image is offered. I verified the happy path in Chromium (software GL); I did not get to
  cross-browser testing of the actual MediaRecorder output (WebM/MP4 codec negotiation) beyond the
  `pickVideoMime()` unit tests, since that needs real browser engines Playwright's software-GL
  profile doesn't exercise meaningfully. Flagging for QA to spot-check in a real Safari/iOS build.
- **Sound**: `src/lib/sound.ts` was not modified (its `beep`/`whoosh`/`flap` cover the journey's
  needs already — key-card beep on arrival, whoosh on hop/flight departures, and `SplitFlap`'s own
  flap click for the date board). `music.ts` is new and additive, for an optional owner-supplied
  track only.
- **Performance**: no React re-render happens per animation frame; the scrubber fill, tick marks
  and route/marker updates are all written through refs or direct MapLibre/GSAP calls inside
  `JourneyPlayer.render()`. I did not profile frame time on a real mid-range Android device (no
  such device in this environment) — only confirmed smooth motion visually in the checkpoint video
  and frames.
- **GSAP time precision**: `stopIndexAt`/`segmentAt` compare against a `1e-4` epsilon because
  `timeline.time()`'s read-back value can round below an exact seek target. If GSAP's internal
  precision model ever changes, re-check `camera.test.ts`'s `stopIndexAt` boundary tests.

## For the QA/integrator

- Journey is reachable at `#/journey` (already wired in `router.tsx`'s `journey` route and the
  shell's tab bar / desktop nav from wave 1).
- `window.__sn.journey` (the `JourneyPlayer`) and `window.__sn.journeyMap` are exposed only when
  `localStorage['sn:e2e'] === '1'`, same convention as `window.__sn.map` on the map screen.
- Ran the full `npm run typecheck && npm run lint && npm run test && npm run build` and the whole
  `map-*` Playwright project set (`map.spec.ts`, `map-checkpoint.spec.ts`, `map-journey.spec.ts`)
  plus a `smoke`/`shell-flow` spot-check on `iphone-390` — all green, no regressions from the
  `style.json` edit.
