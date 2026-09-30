# int-1 handoff: wave 1 integration

Merged into `main` in order (`--no-ff`): w1-backend, w1-map, w1-stays, w1-add-stay, w1-shell.
Git reported no textual conflicts. The overlapping `BottomSheet.tsx` fixes from w1-stays
(`data-no-drag` anywhere in the sheet) and w1-add-stay (header/footer buttons never start a drag,
`onDismissAttempt`) auto-merged and are both kept. No new dependencies were added, so
`package-lock.json` stayed as it was after `npm install`.

## Handoff requests: what happened to each

### w1-backend
- Shared edits (`main.tsx`, `store.test.ts`, `tsconfig.node.json`, scripts): kept as they were.
- `useRecentArrivals()` → Stays: **wired.** `OurStays` animated cards off `onRemoteChange`
  `newVisits`, which also fired for our own echoes. It now uses `useRecentArrivals()` (the other
  person's stays only) and calls `acknowledgeArrival()` once the entrance has played. The split-flap
  counter already re-renders from `useStays()`, so it flips on arrival without extra wiring.
- `ConnectionForm` in onboarding / skipping steps after `#/join`: **already done** by w1-shell
  (`Onboarding` starts at `home` when `me` and a connection are set).
- `ConnectionSection` in Settings: **already done** (Settings embeds it, with no second Demo ↔ Live switch).
- `upsertLetter`: **wired.** w1-shell added the `upsertLetter` outbox op, and w1-backend had the
  endpoint plus `SheetsAdapter.upsertLetter`. The op wasn't in the adapter's `apply()` or in
  `opEntity()`, which broke the typecheck after the merge. Both now handle it.
- `env.ts` `ALLOW_LOCAL_API` now accepts `'1'` as well as `'true'`, matching `connection.ts`.

### w1-add-stay
- Router `LocationProvider`, the BottomSheet fix, `onDismissAttempt`, `MOODS`, the vite exifr
  chunk and the milestones no-op: kept.
- Photo payload → Sheets upload: **fixed a WebKit gap.** `sheets.ts` `defaultReadBlob` read only
  `row.blob`, so iOS photos (stored as `bytes`) would have been uploaded with no image. It now
  falls back to `bytes`, the same way `blobOf()` does. The logic is inlined to avoid a
  store ↔ adapter import cycle.
- Edit and Visit again links from stay detail: **already done** by w1-stays.
- MiniMap in add-stay (pin drop, celebration) and in stay detail: **already done.** Both use w1-map's real `MiniMap`.
- `isBusy()`: `AddStaySheet` and `WriteNoteSheet` call `useMarkBusy`. `pwa/register.ts` holds the
  update reload until the app isn't busy. **Already done.**

### w1-map
- `playwright.config.ts` `map-*` projects and the `watchConsole` GL filter: kept.
- The "Locate me" control and the arcs-toggle copy key are still open for wave 2 (see below).

### w1-stays
- Hero header contract: **wired.** Stays set `data-hero-header`, but the hero element was
  missing the bare `data-hero` attribute that `Shell.useHeroHeader()` measures, so the header fell
  back to its 700 px threshold. `Hero.tsx` now sets `data-hero`.
- Install banner on iOS: **wired.** It now opens the shell's illustrated `openIOSInstallSheet()`.
  The banner's own small sheet stays as the fallback for browsers with no install prompt.
- `shareStay`, `openStay`/`closeStay`, and the Moments and Wishlist slots are left for later waves.

### w1-shell
- The Write-a-note footer tap on touch devices was a BottomSheet bug, fixed by the merged
  BottomSheet changes. `shell-flow.spec.ts` "write a future note" now runs on every project
  instead of desktop only.
- The `settings.spec.ts` focus+Enter workaround still works. It was left alone.
- The maskable-icon safe-zone check and the intro video are still open (see below).

## Tests updated for the merged product
- `smoke.spec.ts` first launch now goes through the full onboarding (who → demo → home → install → in).
- `smoke`/`settings` "11 hotels together": Stays added an `aria-live` copy, so the tests take `.first()`.
- `stays.spec.ts` empty state: it now confirms the "Clear demo data?" sheet that Settings added.

## Fixed during the whole-app pass
- Settings no longer unmounts when Demo ↔ Live re-inits the store. The "Connected" result had
  been lost, failing 2 of the 6 `e2e:live` tests after the merge. (`SettingsScreen.tsx`)
- Stay detail no longer shows "Fetching hotel info…" forever for newly added hotels, which
  add-stay saves as `enrichment_status: 'pending'`. **[to: enrichment wave]** set the status to
  `done`, `failed` or `skipped` on the hotel row when a run ends. (`StayDetailScreen.tsx`)

## Open for wave 2 / QA
- The map's "Locate me" control isn't built. The copy key for the arcs toggle is missing (the UI uses "Our route, stay by stay").
- The add-stay sheet on desktop is a centred modal, not the 560 px side panel from the wireframe.
  In edit mode, captions on saved photos are read-only.
- The phone's own back button skips the card ← detail morph.
- The maskable-icon safe-zone check and a real-time recording of the intro are both missing.
- `design/checkpoints/cp2/map/zoom-and-chips-390.webm` is 5.4 MB, just over the ~5 MB target.
- Add a stay, manual pin: on desktop, the "Use this hotel" / "Back to search" buttons sit
  below the fold of the sheet's scroll area, right under the sheet's own Next button, so they read
  as clipped (`design/checkpoints/int-1/desktop/add-manual-pin-clipped-buttons.png`). Either
  scroll them into view when manual mode opens, or merge them with Next. (w1-add-stay, `HotelStep.tsx`)
- In one fast scripted run, the add sheet reopened right after a save showed a ghost frame of the
  previous sheet. It didn't reproduce at human pace.
