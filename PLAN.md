# Suite Nothings — build plan

## Architecture
```
React UI (hash router, lazy feature routes)
   │ hooks (useStays, useSettings, …)            src/data/store.ts
   ▼
Store ── IndexedDB (idb), namespaced demo|live   src/data/db.ts
   │ every write: IDB → outbox → flush
   ▼
Sync engine (outbox, backoff, online listener)   src/data/sync.ts
   ▼
DataAdapter ─┬─ DemoAdapter (seeded, IDB only)   src/data/adapters/demo.ts
             └─ SheetsAdapter (Apps Script)      src/data/adapters/sheets.ts (w1-backend)
```
- IndexedDB is the UI's source of truth. The adapter is swappable at runtime; switching adapters
  switches the IDB namespace (`suite-nothings-demo` vs `suite-nothings-live`), so demo rows can
  never leak into the real Sheet.
- Device prefs (me, connection, mute, reduced-motion override, intro seen) live in localStorage
  (`sn:device:*`) and survive namespace switches.
- The private letter comes from a build-time virtual module (`virtual:private-letter`) that reads
  `private/letter.md` if present, else `null` (CI).

## File tree (owners in docs/contracts.md → Ownership)
```
build/private-letter.ts        Vite plugin for virtual:private-letter
tools/size.mjs, postbuild.mjs  JS budget check; 404.html copy
src/main.tsx, App.tsx          entry, providers, shell
src/app/                       router.tsx (every route), Shell (TabBar, Header), ErrorBoundary, shortcuts
src/config/                    couple.ts, env.ts
src/styles/                    tokens.css, fonts.css (design), global.css
src/lib/                       dates, geo, ulid, haptics, sound, motion, stats, geocode, busy, toast
src/data/                      types, db, store, sync, seed, adapters/{types,demo,sheets}
src/components/                SplitFlap, BottomSheet, Button, Chip, Badge, TimestampChip, Toast,
                               Skeleton, ClockLoader, EmptyState, ErrorState, OfflineBanner, Stamp,
                               DemoBadge, StayCard, StayArt, icons/
src/features/<feature>/        one folder per route (stubs now; feature agents replace)
src/map/MiniMap.tsx            stub (w1-map)
src/pwa/install.ts             minimal (w1-shell)
src/enrichment/index.ts        no-op API (later wave)
tests/unit, tests/e2e          Vitest, Playwright
```

## Waves
- **Wave 0:** w0-foundation (this), w0-design (tokens, mark, icons, prototype). Merge.
- **Wave 1 (parallel):** w1-stays, w1-add-stay, w1-map, w1-shell, w1-backend. **Merged by int-1 (2026-10-01).**
- **Later waves:** journey, us/stats, milestones, wishlist, share, moments, enrichment.

## Phases (SPEC §19)
0 design → 1 demo-mode app → 2 live Sheet → 3 journey & delight → 4 enrichment.
Checkpoint artifacts go in `design/checkpoints/<task>/` without pausing.

| Phase | Status (after int-1, 2026-10-01) |
|---|---|
| 0 Design | Done (w0-design). Checkpoint 1 evidence is in `design/checkpoints/cp1/`. |
| 1 Demo-mode app | **Accepted.** Every §19 item is checked in `design/checkpoints/cp2/ACCEPTANCE.md`. Only a real-device install is left for the owner. |
| 2 Live Sheet | Built and green against the local mock (`npm run e2e:live`, 6/6). The owner still has to deploy Apps Script and run a real Google check by following `SETUP.md`. |
| 3 Journey and delight | Not started. The engine hooks (`createSuiteMap`, `addLine`, `addMarker`), `MomentsSlot`, the milestones no-op, `shareStay` and the wishlist teaser are ready for wave 2. |
| 4 Enrichment | Not started. `requestEnrichment` is a no-op, and hotels are saved as `pending`. |

## Open risks
- TypeScript 7 (native) not supported by typescript-eslint yet → pinned TS 6.0.3.
- Vite 8 (rolldown) plugin compatibility (vite-plugin-pwa 1.3 claims ^8).
- MapLibre v6 globe performance on mid-range Android; three.js intro on low-end devices.
- Apps Script redirect/CORS quirks (backend agent).
- iOS PWA storage eviction: IDB may be cleared after long inactivity; the Sheet is the backup.
