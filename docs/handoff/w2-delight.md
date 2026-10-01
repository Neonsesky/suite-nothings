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
