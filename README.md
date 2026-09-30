# Suite Nothings

*Every room we've made ours.*

Suite Nothings is a hotel diary for two, Nirsh and Shady. Every staycation, pool day, spa
afternoon and overnight goes in: the hotel, the date, photos, notes, a mood stamp and both our
ratings. It's a phone-first web app (a PWA) that works offline, installs to the home screen and
keeps both phones in sync through a Google Sheet we own. No servers, no accounts, no monthly
bills.

## Features

- Add a stay in under 30 seconds: hotel search, one-tap revisits, photos with EXIF date and place
- Stays feed with a split-flap counter, filters and search
- A 3D map of every hotel, and a journey mode that flies through our stays in order
- Stay detail with photos, hotel info, both ratings and Google Maps, Apple Maps and Waze links
- Milestone stamps, a wishlist with Surprise me, letters that unlock on a rule
- Offline first: every change is saved on the phone and syncs when it can
- Live sync between both phones (about 20 seconds), invite by QR code
- Download our data (JSON and CSV); the Sheet is the long-term backup

## Quick start

```sh
npm ci
npm run dev
```

Open the URL it prints. The app starts in Demo mode: seeded sample stays and a **Demo** badge,
nothing leaves the browser. **Settings → Clear demo data** removes the samples.

To connect it to a real Google Sheet and both phones, follow [SETUP.md](SETUP.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Typecheck, production build into `dist/`, then `tools/postbuild.mjs` (404.html copy) |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript, no output |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run test` | Unit tests (Vitest) |
| `npm run e2e` | Builds, then runs Playwright on iPhone, Pixel and desktop viewports |
| `npm run size` | Gzipped initial JS; fails above 300 KB |
| `npm run letter:gs` | Writes `private/Letter.gs` from the private letter, for pasting into Apps Script |
| `npm run mock:api -- --port 8787` | A local fake Apps Script backend (same protocol, in memory) |

To point a dev build at the mock backend:

```sh
npm run mock:api -- --port 8787
VITE_ALLOW_LOCAL_API=true npm run dev
```

Then in **Settings → Connection** paste `http://localhost:8787/macros/s/MOCK/exec` with the
passphrase `our-secret-suite`.

## Architecture in brief

```
[Phone / PC] ──► React UI ──► Store (IndexedDB, source of truth for UI)
                                  │
                         Sync engine (outbox + delta polling)
                                  │
                     DataAdapter ─┼─ DemoAdapter  (seeded, local only)
                                  └─ SheetsAdapter (Apps Script ⇄ Google Sheet + Drive)
```

- **Local first.** IndexedDB is the UI's source of truth. The app renders from it instantly and
  works fully offline.
- **Outbox.** Every write goes to an outbox first and syncs with backoff, so nothing is lost on
  refresh, crash or airplane mode.
- **Delta polling.** While the app is visible it asks for changes every 20 seconds, on focus and
  right after a write; it pauses when hidden.
- **Backend.** One Apps Script web app (`apps-script/Code.gs`) in front of a Google Sheet (one tab
  per table) and a Drive folder for photos. The wire protocol is pinned in
  [`apps-script/PROTOCOL.md`](apps-script/PROTOCOL.md).
- **Hosting.** A static build on GitHub Pages with hash routing (`#/map`, `#/stay/…`), deployed by
  `.github/workflows/deploy.yml` on every push to `main`.

## Privacy

- The passphrase is never in the repo. It lives in the script's Script Properties (`APP_KEY`)
  and on each phone. `VITE_API_URL` is only an optional default link, never the passphrase.
- The letter lives in `private/`, which is gitignored. It reaches the Sheet only through
  `private/Letter.gs`, pasted by hand.
- `node tools/check-private.mjs` fails if any line of the letter shows up in a tracked file.

## Repo layout

```
apps-script/        Code.gs, appsscript.json, PROTOCOL.md (the backend)
src/app/            router, shell, error boundary, shortcuts
src/config/         couple.ts, env.ts (API default, tile style, geocoder)
src/data/           IndexedDB store, sync engine, demo and Sheets adapters, seed
src/features/       one folder per screen (stays, add-stay, map, journey, settings, …)
src/components/     shared UI and brand components
src/lib/, src/map/  pure helpers and map code
build/, tools/      Vite plugin for the private letter, build and check scripts
tests/              unit (Vitest) and e2e (Playwright)
design/, docs/      tokens, copy deck, module contracts
private/            gitignored: the letter and anything personal
```

## What could ever need attention

We built this to run for years untouched. Honestly, here's what could ever need a look:

- **The Google account must stay active.** Apps Script, the Sheet and the photos live in it.
  Google's free quotas are far above what two people use.
- **Map tiles come from OpenFreeMap**, the one outside service. If it ever goes away, swapping
  it is one line: `TILE_STYLE_URL` in `src/config/env.ts`. Viewed tiles are cached, and a bundled
  world outline keeps the map working offline.
- **Hotel search uses Photon.** If it's down, the app falls back to the Apps Script geocoder, and
  dropping a pin by hand always works.
- **iOS may clear a home-screen app's storage** after long disuse. The Sheet is the backup:
  re-join with the invite link from the other phone and everything comes back.
- **A new Apps Script deployment changes the link.** Update with **Deploy → Manage deployments →
  Edit → New version** to keep it (see [SETUP.md](SETUP.md), step 9). If it changes anyway,
  both phones say so and nothing saved is lost.

---

Designed as a love letter to Dayuse, where our first check-in happened.
