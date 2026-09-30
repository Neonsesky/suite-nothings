# Decisions

- TypeScript pinned to 6.0.3, not 7.x — typescript-eslint 8.71 peers `typescript <6.1.0` — bump TS once typescript-eslint supports 7.
- wouter 3 with `useHashLocation` for routing — tiny, hooks-based, hash support built in — replace `src/app/router.tsx` only.
- Device prefs in localStorage (`sn:device:*`), data in IndexedDB namespaces `suite-nothings-demo` / `suite-nothings-live` — prefs must survive a namespace switch — move to a `device` IDB store in `src/data/device.ts`.
- happy-dom for Vitest DOM — faster than jsdom, enough for hooks/components — switch `environment` in vitest.config.ts.
- Own ~150-line hash router (`src/app/router.tsx`) instead of wouter — wouter's `useHashLocation` keeps `?query` inside the path, which breaks `#/map?city=` matching; wouter was uninstalled — reinstall wouter and wrap it behind the same exports.
- Demo adapter is a fake server in its own IDB (`suite-nothings-demo-server`) and fails with `network` while `navigator.onLine` is false — offline/outbox flows can be tested without Google — make `apply` a no-op for a simpler demo.
- Seed swaps "Atlantis The Palm" for Atlantis The Royal (Palm Jumeirah) — Photon had no Dubai match for The Palm with the hotel tag; The Royal geocoded cleanly — re-geocode and edit `HOTEL_SEEDS` in src/data/seed.ts.
- The seed's short-haul abroad stay is Muscat (a ~340 km hop from Dubai; Abu Dhabi → Muscat is a flight) and the long-haul one is Istanbul — this exercises all three leg styles and three countries — edit `VISIT_SEEDS`.
- Unlinked `#/gallery` route ships in production — it gives the design and feature agents plus Playwright one stable page per component — remove its entry in `ROUTES` before launch if unwanted.
- SplitFlap is CSS keyframes plus timers, not GSAP — it stays off the initial-bundle budget and GSAP is lazy-only — swap the internals of `FlapCell`.
- Stub feature screens share `src/features/stubs.module.css` — keeps the stubs tiny — delete it once the last stub is replaced.
- Letter type carries `updated_at` though the Sheet's Letters tab has no such column — the store's LWW merge needs it — the adapter maps `updated_at = read_at ?? created_at`.
- Separate `tsconfig.test.json` for tests/unit (adds node types) — keeps Node types out of `src` — merge into tsconfig.app.json if preferred.
- Playwright blocks service workers (`serviceWorkers: 'block'`) — stops the SW cache from leaking between tests — the PWA e2e spec (w1-shell) should opt back in with `test.use({ serviceWorkers: 'allow' })`.
