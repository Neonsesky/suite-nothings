# Lighthouse — stays home (`#/`), mobile — qa-final-2 re-run

Run with `npx lighthouse http://localhost:5450/#/ --only-categories=performance,accessibility,best-practices`
against a production preview build (`npm run build && npm run preview -- --port 5450 --strictPort`),
Lighthouse's default mobile config (simulated slow 4G + 4x CPU throttle), fresh profile (no
localStorage — the worst case, since it's the one run that shows the full first-launch intro).
Raw report: `stays-mobile.json`.

## Scores

| Category | Score | Target |
| --- | --- | --- |
| Performance | **61** | ≥ 90 — not met |
| Accessibility | 100 | ≥ 90 — met |
| Best Practices | 100 | ≥ 90 — met |
| Installable | yes (confirmed manually; see below) | — |

This is an improvement over the prior qa-final pass's 56–57 (see `design/checkpoints/final/lighthouse.md`
for that baseline and its root-cause analysis), after one targeted fix in this slice — still well
short of 90.

## What changed this slice

`src/features/intro/Intro.tsx`'s full-intro `wait` stage used to call `import('./scene3d')`
(the ~150KB three.js chunk) synchronously inside a `useEffect`, i.e. in the same tick as first
paint — directly competing with the critical render path for bandwidth and main-thread time on
exactly the run Lighthouse measures (a fresh, never-visited profile). It's now kicked off from
`requestIdleCallback` (150ms timeout fallback), so the above-the-fold paint gets priority; the
existing elapsed-time-based budget logic (`LOAD_BUDGET_MS`, `HARD_CEILING_MS`) is unchanged and
still measures from true mount time, so the 2.5s hard ceiling (SPEC §14) still holds — verified by
`tests/e2e/qa-final-2.spec.ts`'s "intro timing" test, which passed 3/3 repeats.

## Why it's still below 90 — root cause

`bootup-time`/`mainthread-work-breakdown` show ~2.7s of JS execution (`scriptEvaluation`), and
`network-requests` shows **~20 separate small JS chunks** on the initial path (18 under ~12KB each,
per `vite.config.ts`'s fine-grained default code-splitting — one file per lazy-loaded
module/route/lib re-export). Under Lighthouse's simulated "slow 4G" (the default mobile throttle
profile), each additional request carries real simulated RTT overhead; ~20 small requests queue up
waterfall-style even though the *total* transferred (165KB gzip, well inside the 300KB SPEC budget)
is small. This is a different bottleneck from request *size* — it's request *count* on a
high-latency simulated link.

The concrete next step: consolidate the initial-path `manualChunks` in `vite.config.ts` (today only
maplibre/three/gsap/qrcode get manual chunks; everything else — store, icons, seed data, small
libs — splits into its own tiny file) down to 3–5 chunks for the critical path only, leaving lazy
route chunks untouched. This is a real but non-trivial change to the build's chunking strategy
(long-term caching behaviour, not just initial load, is affected) and risks subtly changing what's
eagerly vs. lazily loaded if done carelessly — judged too risky to attempt correctly in this QA
slice's remaining budget without time to re-verify the size budget, offline/PWA precaching, and the
full e2e suite afterward. Flagging for a dedicated follow-up slice, same as the prior pass flagged
the intro-import fix that this slice then made.

Accessibility and Best Practices are already at the target (100) — no further action.
