# Suite Nothings — release status

One-page summary for Nirsh. Last updated by qa-final-2, 2026-10-01.

## What works, and how it was verified

| Area | Status | Verified by |
| --- | --- | --- |
| Core flows (Stays, Add a stay, Stay detail, Map, Journey, Us, Letters, Wishlist, Settings) | ✅ | Full `npm run e2e`: 283 passed, 44 skipped (evidence specs), 0 failed |
| Unit logic (dates, geo, stats, enrichment, milestones, share, journey camera, etc.) | ✅ | 561 Vitest tests, all passing |
| Type safety / lint | ✅ | `npm run typecheck && npm run lint`, zero errors or warnings |
| Initial JS budget | ✅ | 165.2 KB gzipped, budget 300 KB (map/three/gsap/qrcode excluded, loaded lazily) |
| PWA (manifest, service worker, offline, update toast) | ✅ | `tests/e2e/pwa.spec.ts`, offline add-a-stay in `add-stay.spec.ts` |
| Accessibility (axe, WCAG AA) | ✅ | `tests/e2e/a11y.spec.ts`; Lighthouse Accessibility 100 |
| Console cleanliness | ✅ | `tests/e2e/console-clean.spec.ts` across every route; SwiftShader's benign GPU-stall driver warning is the one allowed exception |
| Intro timing (SPEC §14: ≤2.5s first launch, ≤400ms+fade repeat) | ✅ | `tests/e2e/qa-final-2.spec.ts`, 3/3 repeats |
| Card → detail morph, price-level glyphs | ✅ | Screenshotted and reviewed, `design/checkpoints/qa/` |
| Public-repo hygiene (no Dayuse assets, no secrets, private letter never leaked) | ✅ | Manual audit this session; see `docs/handoff/qa-final.md` |
| Lighthouse Best Practices | ✅ | 100 |
| **Lighthouse Performance (mobile, Stays home)** | ⚠️ **61, target ≥90** | Improved from 56–57 by deferring the intro's three.js import off the critical path; remaining gap is ~20 small initial-path JS chunks adding simulated-network RTT overhead under Lighthouse's throttle profile — real-world phones on real networks should score meaningfully better. Root cause and the next step (a `manualChunks` consolidation) are in `design/checkpoints/qa/lighthouse/summary.md`. |

## Known limitations

- **Lighthouse Performance is below target** (above). Not a functional bug — the app works and
  feels fast in manual testing — but the simulated-throttle score is what it is. Fixing it
  properly means consolidating Vite's code-splitting for the initial path, which touches caching
  behavior broadly enough to deserve its own dedicated slice.
- A few small, previously-deferred polish items (never blocking): the map's "Locate me" control
  isn't built; add-a-stay's desktop layout is a centred modal rather than the wireframe's 560px
  side panel; photo captions are read-only when editing a saved stay; the phone's back button
  skips the card↔detail morph animation (forward navigation has the full morph).
- Visual QA this round was a representative sample across all 3 viewports (full set reviewed at
  390px) rather than a pixel-by-pixel check of every screenshot at every size.

## Manual checks still needed (can't be done from here)

- Real install prompts (Android Chrome, iOS Safari "Add to Home Screen").
- iOS standalone mode on a real iPhone (status bar, safe areas, splash screens).
- Haptics on save, map chapter changes, and milestone unlocks.
- A real two-phone Apps Script sync (one device as Nirsh, one as Shady) once `SETUP.md` is
  followed for real — only the Demo adapter and a local Apps Script test harness were exercised
  here.
- Drive photo upload against a live deployment (fixtures only were exercised in this environment).
- Intro and journey-replay smoothness on a real mid-range Android phone (this environment only has
  software-rendered WebGL).
- A real-world Lighthouse/PageSpeed Insights run once GitHub Pages is live, to see the true
  Performance score without the simulated throttle.

## Release readiness

Functionally ready: every core flow, PWA requirement, and accessibility check passes, and the
public repo is safe to make visible (no Dayuse assets, no secrets, the private letter is fully
contained to the gitignored `private/` folder — verified against both the working tree and full
git history). The one open item is a Lighthouse Performance score below the ≥90 target, which is
a polish/optimization gap, not a correctness or safety one.
