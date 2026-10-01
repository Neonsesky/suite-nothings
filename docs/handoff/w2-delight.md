# w2-delight handoff

## Edits outside owned paths (milestones agent)

- `src/lib/sound.ts`: additive `'stamp'` sound (soft low thud + paper tick, respects mute) for the unlock.
- `src/features/add-stay/AddStaySheet.tsx`: one line in the celebration `finish` — `notifyNewLetters(res.before, res.after)` after `showMilestoneUnlock(reached)` (shows "A new note is waiting in Letters", deferred until the stamps are dismissed). Already committed with the coordinator's wishlist change.
- `DECISIONS.md`: four `[w2-delight milestones]` lines (five-star rule, outside-home-city rule, backfill/never re-award, overlay above toasts).

## Milestones API (src/features/milestones)

- `checkMilestones(stays, prev, opts?)` (index version defaults `opts.home` to Settings home base; engine version to `COUPLE.defaultHomeBase`), `allMilestones(stays, opts?)`, `milestoneDefs(opts?)`, `MILESTONE_DEFS`, `milestoneDef(id)`, `milestoneToast(m)`.
- `useMilestoneState(stays) → { defs, earned: Map<MilestoneId, Milestone & { awardedAt }> }`, `useAwardedMilestones()`, `recordAwarded(ms)`, `backfillMilestones()`.
- `showMilestoneUnlock(ms)`: own React root on `<body>`; skips already-awarded ids, records the rest. `data-testid="milestone-unlock"`, `data-milestone-id`.
- `notifyNewLetters(before, after)`.
- Evidence: design/checkpoints/cp3/delight/milestone-*.png (6 frames at 390, one at 1440, reduced motion).

## Us, wishlist, moments (lead)
Edits outside owned paths:
- `src/data/store.ts`: added `readMeta(key)` / `writeMeta(key, value)` (per-namespace IndexedDB meta), used by milestones persistence.
- `src/features/add-stay/AddStaySheet.tsx`: `?wish=<id>` handler. Prefills the hotel through `hotelChoiceForWish()` (starts at step 2/5), and on save calls `fulfilWish(wish, visitId)` before the milestone check.
- `src/features/stays/StaysScreen.tsx`: renders `features/moments/Moments` instead of `MomentsSlot`. `stays/MomentsSlot.tsx` and `stays/logic/moments.ts` are now unused (left for stays/QA to delete along with their tests).

Notes for QA:
- `src/features/stubs.module.css` has no importers now and can be deleted (contracts.md says so).
- Haptics audit: only `Celebration` (save), `MapScreen` (chapter) and `MilestoneUnlock` (milestone) call `haptic()`, so it complies with SPEC §12.
- The map's dashed wish pins already skip fulfilled and deleted wishes (`map/pins.ts`).
- Year in review isn't built (stretch goal).
- Run e2e with `--output .tmp/<name>`. Parallel runs wipe the shared `test-results/`, which shows up as false ENOENT failures.
