# w1-shell handoff

- [to: w1-backend, integrator] Added an `upsertLetter` outbox action (payload: a full `Letter`) and `upsertLetter(input)` in the store, for "Write a future note". The demo adapter handles it. The Sheets adapter and `Code.gs` need an `upsertLetter` POST action (upsert by `letter_id`, LWW on `updated_at`, same as `upsertWish`). Until then, future notes stay in the outbox on live. (files: src/data/types.ts, src/data/store.ts, src/data/adapters/demo.ts)
- [to: integrator] `importData()` now also merges letters and settings (LWW), so Settings → Import round-trips a full export. (files: src/data/store.ts)
- [to: integrator] Added the `__BUILD_DATE__` define (vite.config.ts, vitest.config.ts, src/vite-env.d.ts) and `BUILD_DATE` in `@/config/env` for Settings → About. (files: vite.config.ts, vitest.config.ts, src/vite-env.d.ts, src/config/env.ts)
