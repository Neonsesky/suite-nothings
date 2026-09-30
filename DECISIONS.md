# Decisions

- TypeScript pinned to 6.0.3, not 7.x — typescript-eslint 8.71 peers `typescript <6.1.0` — bump TS once typescript-eslint supports 7.
- wouter 3 with `useHashLocation` for routing — tiny, hooks-based, hash support built in — replace `src/app/router.tsx` only.
- Device prefs in localStorage (`sn:device:*`), data in IndexedDB namespaces `suite-nothings-demo` / `suite-nothings-live` — prefs must survive a namespace switch — move to a `device` IDB store in `src/data/device.ts`.
- happy-dom for Vitest DOM — faster than jsdom, enough for hooks/components — switch `environment` in vitest.config.ts.
