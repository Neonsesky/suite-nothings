# Suite Nothings — Build Spec

A hotel diary PWA for Shady & Nirsh. This file is the complete brief for Claude Code.

---

## 0. Read this first (instructions for Claude Code)

You are building a complete, production-quality Progressive Web App from this spec. Work like a senior product designer and engineer who owns the result end to end.

1. Read the entire spec before writing any code. Then use plan mode to write `PLAN.md`: architecture, file tree, phase breakdown, open risks.
2. Build in the phases in §19. Each phase ends with the app running (`npm run dev` and `npm run build && npm run preview`), tests passing, screenshots reviewed, and a short entry in `CHANGELOG.md`.
3. Stop for my review only at the checkpoints marked **🛑 CHECKPOINT** in §19. Otherwise don't stop to ask: make the best call and log it in `DECISIONS.md` (one line each: decision, why, how to reverse).
4. Everything must work in **Demo Mode** (local seeded data) before any Google setup exists. I'll create the Sheet, Apps Script and GitHub repo later by following `SETUP.md`, which you write.
5. Verify visually, not just by compiling. Use Playwright to screenshot every screen at 390×844, 412×915 and 1440×900. Look at the screenshots, compare against the Dayuse references, and fix what's off. Review signature animations frame by frame (slow the timeline down or record video).
6. No lorem ipsum, no placeholder copy, no TODOs in shipped code paths, no console errors or warnings in the production build.

**Non-negotiables**

- Never lose a stay. Local-first storage, offline outbox, idempotent writes, soft deletes with undo.
- Zero running cost: no servers of our own, no subscriptions, no paid APIs required.
- No secrets committed to the repo, ever.
- Original identity. No Dayuse logo, wordmark, illustrations, photography, icons or font files. The homage is the *visual language* (§3), not their assets. The word "Dayuse" appears only in the About credit.
- Every screen has designed loading, empty, error and offline states.
- `prefers-reduced-motion` is respected everywhere.

---

## 1. The story

Nirsh and Shady have been together since **19 June 2026, 23:46 Dubai time**. In three months they've checked into a lot of hotels, the first one booked through Dayuse. This app is their hotel diary: a counter of every hotel they've been to, a 3D map of all of them, and an animated replay of their journey together.

It's a gift. Dates, names, the letter in §13 and small personal touches are load-bearing, not decoration.

- **Users:** exactly two people, Nirsh and Shady. No accounts, no sign-up.
- **Devices:** mostly phones (Android Chrome, iPhone Safari) installed to the home screen; also desktop browsers.
- **Home base:** Dubai, UAE by default; changeable in Settings.
- **Locale:** English, dates as `19 Jun 2026`, 24h times, timezone default `Asia/Dubai`, km by default.

---

## 2. Name and identity

- **Name:** Suite Nothings (hotel suites + sweet nothings).
- **Tagline:** "Every room we've made ours."
- **Manifest `short_name`:** "Our Suites" (verify it doesn't truncate on iOS and Android home screens).
- **Mark:** an original hotel key tag, the classic oval key fob on a small ring, embossed with room number **619** (for 19 June). Clean SVG in the ink-outline style from §3.2. Export: SVG favicon, 192/512 PNG, 512 maskable, 180 apple-touch-icon, monochrome icon for Android themed icons, iOS splash screens.
- **About credit (text only):** "Designed as a love letter to Dayuse, where our first check-in happened."

All personal constants live in one file so the app can be renamed or re-personalised in one place:

```ts
// src/config/couple.ts
export const COUPLE = {
  appName: 'Suite Nothings',
  shortName: 'Our Suites',
  tagline: "Every room we've made ours.",
  people: {
    nirsh: { id: 'nirsh', name: 'Nirsh' },
    shady: { id: 'shady', name: 'Shady' },
  },
  togetherSince: '2026-06-19T23:46:00+04:00',
  defaultHomeBase: {
    city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE',
    lat: 25.2048, lng: 55.2708,
  },
  timezone: 'Asia/Dubai',
} as const;
```

---

## 3. Design: a homage to Dayuse

The brief: it should feel unmistakably like Dayuse's website and app, as if Dayuse had made a private app for two of its guests. Match their visual language as closely as possible: layout patterns, type feel, colours, corner radii, spacing rhythm, card anatomy, button and badge styles, photo treatment, motion tone. Use our own name, mark, copy and imagery.

### 3.1 Phase 0 task: extract the real tokens (don't guess)

1. `curl` these pages and the CSS bundles they link from `/_next/static/css/`:
   - https://www.dayuse.ae/
   - https://www.dayuse.ae/s/united-arab-emirates/dubai
   - https://www.dayuse.ae/hotels/united-arab-emirates/golden-tulip-al-barsha
   
   Extract colour values and CSS custom properties, font families and weights, type scale, border radii, shadows, spacing, breakpoints, and the styles of buttons, badges, inputs, cards, tabs and the search bar.
2. With Playwright, screenshot the same pages at mobile and desktop widths into `design/references/` (gitignored, reference only, never shipped). Run `getComputedStyle` on the key elements: header, hero search bar, primary button, hotel card, discount badge, price, city tabs, section heading, FAQ accordion, footer.
3. Look at the Dayuse app's store screenshots (App Store id1068461104, Google Play `com.dayuse_hotels.dayuseus`) for app navigation, bottom sheets and card patterns.
4. Write `design/tokens.md` (every value with the element it came from) and `src/styles/tokens.css`.
5. If their typeface is commercial, pick the closest free equivalent (Google Fonts / Fontsource), self-host it as WOFF2, and log the choice in `DECISIONS.md`.

### 3.2 Brand DNA to carry over

These come from Dayuse's 2021 identity (by DesignStudio) and their current site:

- **Honey and ginger.** Their palette is built as a "cocktail" of two flavours: honey (warm, smooth, sweet: the functional side) and ginger (the cheeky, romantic kick). Daylight hues throughout. *Our use:* honey for calm surfaces and highlights; ginger reserved for love and celebration (hearts, the journey line, milestones, the letter).
- **Time is the motif.** A clock-face logo and timestamps across their campaigns. *Our use:* every stay shows its check-in and check-out times as a timestamp chip; loaders are sweeping clock hands; the home counter is a split-flap board; the map's lighting follows the real time of day.
- **Ink outlines and framed panels.** Their illustrations use black outlines, with scenes framed in boxes like a comic strip, a "patchwork of moments". *Our use:* a stay's photos sit in ink-outlined panels of varied sizes; milestone stamps are ink-outlined badges; roads get a thin ink casing at city zoom.
- **Photo-led, bright, clean.** White space, black type, big hotel photography, rounded cards, a prominent search bar in the hero.

### 3.3 Page anatomy, mapped 1:1

Build the home screen ("Stays") as a mirror of dayuse.ae's homepage structure, with our content in each slot:

| dayuse.ae section | Suite Nothings version |
|---|---|
| Header: logo, Destinations, Help, locale | Key-tag mark + name; Map, Journey, Us. On mobile: bottom tab bar |
| Full-bleed hero photo, headline, search bar, "see hotels around me" | Photo from our latest stay; a headline generated from data; search "Find a stay we've had"; button "We're at a hotel right now" (uses location to start logging) |
| Trust badges row (pay at hotel, free cancellation, up to 75% off…) | Stats row: hotels, visits, hours of hotel time together, cities, countries |
| "Our selection of day hotels" with city tabs and hotel cards | "Our stays" with city tabs generated from data (Dubai, Sharjah, Abu Dhabi, Abroad…) |
| Card: photo, name, price, discount badge, struck-through nightly price | Card: photo, name, area; the date where the price sits; a badge where the discount sits ("Visit 3", "♡ 5", "First"); the timestamp chip where the struck price sits |
| "See hourly hotels in Dubai" link | "See all our Dubai stays" (opens the map, filtered) |
| "Book a hotel in three steps" | "Our story in three stays": first, latest, favourite |
| App download banner with rating | "Put us on your home screen" install banner (hidden once installed) |
| Instagram block | "On this day" or monthly-anniversary moment |
| Newsletter club | "Next check-ins" wishlist |
| FAQ accordion | "Frequently asked by us": answered live from our data (Where was our first stay? Which hotel do we keep going back to? Farthest from home? Longest stay?) |
| Hotel-chain logo marquee | Text-only marquee of the chains we've stayed with (from the `brand` field, no logos) |
| Footer | "Made by Nirsh for Shady" + a live together-since counter |

### 3.4 Provisional tokens (placeholders until §3.1 replaces them)

```css
--ink: #000000; --paper: #FFFFFF; --cream: #FFF7E6;
--honey: #FFC83D; --ginger: #FF6A3D; --muted: #6E6E6E; --line: #E8E8E8;
```

Honey is a fill colour, never text on white. Check every text/background pair for WCAG AA.

### 3.5 Design process

Two passes. First write a compact design plan (tokens, type scale, ASCII wireframes per screen, principles), critique it against this brief and the Dayuse screenshots, revise, then build. Spend boldness in one place: the map and the journey are the hero. Everything else stays as calm and disciplined as dayuse.ae.

---

## 4. Stack and architecture

| Concern | Choice |
|---|---|
| Build | Vite + React + TypeScript, exact pinned versions (no `^`), lockfile committed |
| Maps | MapLibre GL JS v6.x (ESM) with the adaptive globe projection |
| Basemap | OpenFreeMap vector tiles (free, no API key), style forked into `src/map/style.json` |
| UI motion | Motion (motion.dev): springs, gestures, shared-element transitions |
| Timelines | GSAP (free) for the journey choreography and split-flap |
| 3D extras | Three.js, lazy-loaded, only for the intro key tag and the letter reveal |
| Geo math | Turf modules (great-circle, distance, bbox) |
| Local storage | IndexedDB via `idb` |
| PWA | `vite-plugin-pwa` (Workbox) |
| Routing | Hash routing (robust on GitHub Pages, no 404 tricks needed) |
| Backend | Google Sheet + Apps Script web app (§6) |
| Hosting | GitHub Pages via a GitHub Actions workflow; base path from repo name |

No runtime CDNs: every library, font and icon is bundled or self-hosted. The only runtime network dependencies are the Apps Script API, map tiles, the geocoder and optional enrichment sources, and each has a fallback (§7.5).

```
[Phone / PC] ──► React UI ──► Store (IndexedDB, source of truth for UI)
                                  │
                         Sync engine (outbox + delta polling)
                                  │
                     DataAdapter ─┼─ DemoAdapter  (seeded, local only)
                                  └─ SheetsAdapter (Apps Script ⇄ Google Sheet + Drive)
```

The `DataAdapter` interface is the only thing the UI knows about. Demo and Sheets adapters are swappable at runtime (Settings → Connection).

---

## 5. Data model (Google Sheet)

Separate **hotels** from **visits** so we can count unique hotels *and* total visits, and so revisits are one tap.

**`Hotels`**
`hotel_id, name, brand, address, area, city, region, country, country_code, lat, lng, source, osm_id, wikidata_id, website, phone, stars, price_level, description, description_source, amenities_json, cover_photo_id, enrichment_status, enriched_at, created_at, updated_at, deleted`

**`Visits`**
`visit_id, hotel_id, date, check_in, check_out, nights, visit_type, booked_via, note, favourite_moment, mood, rating_nirsh, rating_shady, picked_by, added_by, photo_ids_json, created_at, updated_at, deleted`

- `visit_type`: Dayuse, Staycation, Overnight, Pool day, Spa, Brunch or dinner, Other
- `booked_via`: Dayuse, Direct, Booking.com, Other
- `mood`: one of a small curated set of stamps (not free emoji)
- `date` is a plain `YYYY-MM-DD` string (no timezone bugs); times are `HH:mm`

**`Photos`**
`photo_id, visit_id, thumb_file_id, full_file_id, width, height, taken_at, caption, created_at, deleted`

**`Wishlist`**
`wish_id, name, lat, lng, city, country, note, added_by, priority, fulfilled_visit_id, created_at, updated_at, deleted`

**`Letters`**
`letter_id, title, body_md, from, to, unlock_rule, written_at, read_at, created_at`
`unlock_rule` is one of: `always`, `visits>=N`, `hotels>=N`, `first_abroad`, `date>=YYYY-MM-DD`.

**`Settings`**
`key, value`: home base (city, country, lat, lng, city bbox, country code), map lighting mode, units.

**`Log`**
`timestamp, actor, action, detail` for debugging.

Rules: IDs are ULIDs generated on the client (offline-safe). Header row frozen, dropdown validations on enum columns. The app must tolerate a human editing the Sheet by hand: blank cells, extra columns, reordered columns (read by header name, never by index), stray whitespace.

---

## 6. Apps Script backend

Deliver `apps-script/Code.gs` and `apps-script/appsscript.json`.

**Endpoints**

- `GET ?action=ping` → `{ ok: true, version }` (health check, no key needed)
- `GET ?action=bootstrap&key=…` → all tabs as JSON + `serverTime`
- `GET ?action=changes&since=ISO&key=…` → only rows with `updated_at > since` (cheap polling)
- `GET ?action=photo&id=…&key=…` → `{ mime, base64 }`
- `POST` with body `{ key, action, payload }`: `upsertHotel`, `upsertVisit`, `deleteVisit` (soft), `uploadPhoto`, `upsertWish`, `markLetterRead`, `updateSettings`, `geocode`

**Implementation rules**

- Apps Script can't answer CORS preflight. Every POST must be a *simple request*: `Content-Type: text/plain;charset=utf-8`, JSON string body, no custom headers. `fetch` follows the redirect to `script.googleusercontent.com` automatically. Always respond with `ContentService` JSON: `{ ok, data }` or `{ ok: false, error: { code, message } }`.
- Auth: a shared passphrase stored in Script Properties as `APP_KEY`. Required for all reads and writes (the notes are private). Never in the repo.
- Writes wrapped in `LockService.getScriptLock()`. Upsert by ID, last-write-wins on `updated_at`, idempotent so retries never duplicate.
- Photos go to a Drive folder (ID in Script Properties). The client uploads a thumb (480px) and a full (1600px) per photo.
- `geocode` uses the built-in `Maps.newGeocoder()` as a server-side fallback (no API key).
- A `setup()` function I run once from the editor: creates all tabs with headers, validations and frozen rows, creates the Drive folder, writes Script Properties, and prompts me for `APP_KEY`.
- A `selfTest()` function that round-trips a fake visit and cleans up.
- Deploy as web app: *Execute as: Me*, *Who has access: Anyone*. In `SETUP.md`, explain how to push updates via *Manage deployments → Edit → New version* so the URL never changes.

**Connecting both phones (must-have)**

Nirsh's phone and Shady's phone both connect to the *same* Apps Script link, so they read and write the same Sheet and stay in sync.

- The link is entered **inside the app**, not in the code: Settings → Connection has a field to paste the Apps Script URL and the passphrase. Each device saves them locally (IndexedDB, with a localStorage fallback) and keeps them through app updates, cache clears of the service worker, and reinstalls where the browser allows.
- No rebuild or redeploy is ever needed to connect or change the link. `VITE_API_URL` is only an optional default; the pasted value always wins.
- **Test connection** runs `ping`, then an authorised `bootstrap`, and reports plainly: "Connected: 27 stays synced", "Wrong passphrase", "This isn't an Apps Script web app link", or "Can't reach Google right now".
- Paste validation: accept only `https://script.google.com/macros/s/…/exec` links; trim spaces; warn if it ends in `/dev` (that link only works for the script owner).
- Shortcut for Shady: Nirsh's Settings shows a QR code and share link (`…/#/join?api=…&key=…&as=shady`). Scanning it fills in the link and passphrase on her phone in one step. Pasting by hand must always work too.
- If the link ever changes (e.g. a brand-new deployment), both phones show a clear banner, "Can't reach our Sheet. Paste the new link in Settings", and nothing saved locally is lost; the outbox syncs once the new link is in.
- Settings shows the connected link (shortened), the last successful sync time, and a "Sync now" button on both devices.

---

## 7. Sync, offline and "works for years"

### 7.1 Local-first
IndexedDB is the UI's source of truth. On open, render instantly from cache, then sync in the background. The app is fully usable offline.

### 7.2 Outbox
Every write goes to an outbox first, then syncs with exponential backoff. The UI shows a quiet "Saved on this phone, will sync" state until confirmed. Nothing is ever lost on refresh, crash or airplane mode.

### 7.3 Live updates
While the app is visible, poll `changes` every 20 seconds, on focus, and right after a write. Pause when hidden (Page Visibility API). When the other person adds a stay, show a small toast ("Shady just checked in at …") and animate the new card in.

### 7.4 Photos
Resize on the client (thumb 480px, full 1600px, JPEG/WebP ~0.8). Read EXIF first to suggest the date and location, then strip EXIF before upload. Cache thumbs in IndexedDB.

### 7.5 Fallbacks for every external dependency

| Dependency | Primary | Fallback |
|---|---|---|
| Map tiles | OpenFreeMap | Tile URL is one config value; service worker caches viewed tiles (city zoom for home base pre-warmed); last resort is a bundled Natural Earth 110m land GeoJSON so the globe, pins and journey still render offline |
| Hotel search | Photon (komoot) | Apps Script `Maps.newGeocoder()`; manual pin drop always works |
| Enrichment | Wikidata/Wikipedia | Silently skipped; user can fill fields by hand |
| Backend | Apps Script | App keeps working locally; outbox waits |

### 7.6 Updates and backups
- New service worker version → toast "A fresh version is ready" with a refresh button. Never auto-reload while a form is open.
- Settings → "Download our data" (JSON + CSV) and "Import". The Sheet is the long-term backup.
- `README.md` states honestly what could ever need attention: the Google account must stay active, and the tile provider is the one outside service (swap = one line).

---

## 8. Screens and flows

**Navigation.** Mobile: bottom tab bar with Stays, Map, a centre **+** (add a stay), Journey, Us. Desktop: Dayuse-style top header, wider layouts, keyboard shortcuts (`N` new stay, `M` map, `J` journey, `/` search).

### 8.1 First launch
- **Intro (first launch only, ≤2.5s, skippable):** the 3D key tag swings in on its ring, a key card taps a door lock, the light turns green, the door opens into the app. Later launches get a 400ms version.
- **"Who's checking in?"** Nirsh or Shady. Sets `added_by` and greetings.
- **Connect:** paste nothing if opened from an invite link; otherwise "Try demo" or enter the API URL and passphrase.
- **Home base:** confirm Dubai or change it.
- **Install:** Android uses `beforeinstallprompt`; iOS shows an illustrated sheet (Share → Add to Home Screen).

**Invite link.** Settings shows a QR code and link like `…/#/join?api=…&key=…&as=shady`. Opening it stores the connection, strips the hash from the URL, and preselects the person.

### 8.2 Stays (home)
Dayuse homepage anatomy from §3.3. The counter is a **split-flap board** ("27 hotels together") that flips when a stay is added. Filters: city, year, type, rating, who picked it. Search covers hotel names, areas and notes.

### 8.3 Add a stay (the most important flow: under 30 seconds)
A draggable bottom sheet, in steps, with draft autosave:
1. **Hotel.** Previously visited hotels first (revisit = one tap). Autocomplete via Photon biased to current location or home base, filtered to hotels (`osm_tag=tourism:hotel`, plus a looser fallback). "We're here now" finds the nearest hotels to GPS.
2. **When.** Date defaults to today; optional check-in/check-out times; nights for overnight stays.
3. **What we did.** Visit-type chips.
4. **Photos.** Multi-select; EXIF suggests date and location.
5. **The good part.** Note, favourite moment, mood stamp, my rating. The other person can add theirs later; the card shows a gentle "Waiting for Shady's rating".

**Save celebration:** the key card slides into a lock, the light goes green, the split-flap counter ticks up, a pin drops on a mini map, haptic tap on Android. Milestones unlock here too (§12).

### 8.4 Stay detail
Shared-element transition from the card photo to the header. Contents: photo panels, hotel info (description, stars, price level, address, website, phone, amenities), our visits to this hotel as a mini timeline, notes and both ratings, a small 3D map with the pin, and buttons for Google Maps, Apple Maps and Waze:

- Google: `https://www.google.com/maps/search/?api=1&query={lat},{lng}`
- Apple: `https://maps.apple.com/?ll={lat},{lng}&q={name}`
- Waze: `https://waze.com/ul?ll={lat},{lng}&navigate=yes`

Edit in place; delete is soft with an undo toast.

### 8.5 Map (§9), 8.6 Journey (§10)

### 8.7 Us
Stats dashboard, milestone stamps, letters, wishlist, together-since counter, and Settings.

### 8.8 Settings
Who am I; home base; connection (URL, passphrase, **Test connection** with a clear result, invite QR); map lighting (Auto / Day / Golden hour / Night); units; reduced motion override; sound on/off; export/import; clear demo data; About and open-data attributions.

### 8.9 States
- **Empty (zero stays):** "Our first check-in is waiting" with one button, "Add our first stay".
- **Errors:** say what happened and what to do, in the app's voice. Never "Something went wrong" alone.
- **Global error boundary:** "This screen tripped over its suitcase. Your stays are safe on this phone." + Reload.

---

## 9. The map (hero feature)

**One continuous 3D map, not three separate maps.** MapLibre's adaptive globe projection gives a globe when zoomed out that flattens naturally as you zoom into the city. The three "maps" are *chapters*: zoom breakpoints computed from the home base, so changing home base (London → UK → World) just works.

| Chapter | Zoom (tune by feel) | What changes |
|---|---|---|
| **City** (Dubai) | ≥ ~9.5 | Pitch ~55°, 3D building extrusions (`render_height`), district labels, individual pins, roads with ink casing |
| **Country** (UAE) | ~5.5–9.5 | Buildings fade out, emirate boundaries emphasised, pins cluster by city with count bubbles |
| **World** | < ~5.5 | Globe with atmosphere and sky, pins cluster by country, optional great-circle arcs linking stays in order |

**Chapter transitions**
- All layer changes use zoom-interpolated style expressions, so the change is a continuous crossfade, never a jump.
- Crossing a breakpoint flips a split-flap chapter title in the HUD: DUBAI → UNITED ARAB EMIRATES → THE WORLD, with the count of stays in view.
- After a gesture ends near a breakpoint, a gentle, interruptible ease settles into that chapter's framing. It never fights the user's finger.
- Chapter chips (City / Country / World) jump between framings with `flyTo`.

**Interaction**
Pan with inertia, pinch zoom, two-finger rotate and tilt on mobile, right-drag or Ctrl-drag on desktop, keyboard controls, compass to reset north. On the World chapter, a slow idle spin that stops on touch (off with reduced motion).

**Pins**
- Stays: key-tag shaped pins in honey with ink outline; revisits show a count; favourites get a soft ginger glow.
- Wishlist: dashed outline pins.
- Home base: a small house-with-heart marker.
- Tap a pin → Dayuse-style card slides up as a bottom sheet → tap again for detail.
- Performance: symbol layers for pins in general; HTML markers only for the selected pin and its neighbours.

**Style**
Fork OpenFreeMap's style into `src/map/style.json` and recolour it to the tokens: warm paper land, soft desaturated water, white roads with thin ink casing at city zoom, muted parks, cream buildings. Generate glyph PBFs for the brand font and host them in `/public/glyphs` (fallback to the provider's glyphs).

**Daylight lighting (signature detail)**
Sky colour, light direction and intensity follow the real local time at the home base: dawn, day, golden hour (honey), sunset (ginger), night. Manual override in Settings.

**Quality bar**
60fps on a mid-range Android phone; device pixel ratio capped at 2; extrusions only at city zoom. Compact OpenStreetMap/OpenFreeMap attribution is always visible (licence requirement). A "List view" toggle gives an accessible alternative to the map.

---

## 10. Journey mode (the "Indiana Jones" replay)

A cinematic replay of every visit in chronological order.

**Camera choreography.** Drive a single progress value per leg with a GSAP timeline and compute the camera each frame with `map.jumpTo`, so the whole journey is scrubbable. Per leg, from stay A to stay B:

| Distance | Leg style | Camera | Traveller icon | Duration at 1× |
|---|---|---|---|---|
| < 30 km | Glide | Stays low (zoom ~13), pitch ~60°, bearing follows heading | Little heart | 2.5–3.5s |
| 30–400 km | Hop | Rises to country view, arcs over, descends | Little car | 4–5s |
| > 400 km | Flight | Rises to globe, rotates, descends | Little plane | 6–7s |

- Centre interpolates along the great-circle path; zoom follows a smooth bell curve, `z(t) = lerp(z0, z1, t) − h·sin(πt)`, with `h` scaled by distance; bearing eased toward the heading.
- The route draws itself as a ginger line with an ink outline, like the red line on an old adventure map. Past legs stay as a faded trail.
- The traveller icon rides the line's tip, rotated to heading.

**At each stop.** The pin drops with a small bounce, a postcard pops up (photo, hotel name, date, "Stay 7 of 27", a line from the note), and a split-flap date board at the top flips to the new date. Hold ~2.2s, then continue.

**Controls.** Play/pause, speed (0.5×, 1×, 2×), scrubber with month ticks, previous/next stop, filter (all time, this year, home city only). Tapping a postcard pauses and opens the stay.

**Opening and finale.** Opens on the date 19 June 2026 flipping in, then flies to the first stay. Ends by pulling back to the globe with the full route visible, stats rolling in (hotels, cities, countries, km), then the wishlist pins pulse softly under "To be continued…".

**Sound.** Soft synthesized effects via Web Audio (key-card beep, whoosh, flap clicks), no licensed audio. Optional: play a user-supplied file from `/public/audio/` if present. Mute toggle remembered.

**Reduced motion.** Replace flights with crossfades between stops.

**Phase 3 extras.** "Share our journey": record a 9:16 video of the replay with `canvas.captureStream()` + `MediaRecorder`, and a 1080×1920 story image of the route and stats.

---

## 11. Hotel info enrichment (and AI, later)

When a hotel is first added, enrich it **once**, write the results to the `Hotels` tab, and never fetch again unless someone taps "Refresh info". Everything is editable by hand, and our own photos always win as the cover.

Be honest in the design: a model running locally on a phone can't browse or reliably know facts about a specific hotel. So facts come from sources, and AI (optional) only rewrites fetched facts into a short, warm description.

**Pipeline** (pluggable `EnrichmentProvider` interface, runs in the background with skeleton states):
1. **Place data** from the Photon result and OSM tags: brand, stars, website, phone, address, Wikidata ID.
2. **Wikidata / Wikipedia:** a summary and official site where they exist; images only from Wikimedia Commons with licence and attribution stored and shown.
3. **Price level:** from OSM if tagged; otherwise the user sets it (¤ to ¤¤¤¤). An AI estimate may be shown only if clearly labelled as an estimate.
4. **Optional AI description (Phase 4)** behind an `AIProvider` interface, off by default. Implementations:
   - A hosted model (e.g. Gemini free tier or Claude API) called **from Apps Script** with its key in Script Properties, never in the frontend.
   - A local Ollama model on a desktop at `localhost` when detected.
   - An in-browser model via WebLLM on desktops with WebGPU.
   
   The prompt passes only the fetched facts and asks for a 2–3 sentence description plus tags. The UI labels it "Written by AI from public info".
5. **Optional Google Places provider (Phase 4, off by default):** richest data and photos, but needs a Google Cloud key with billing enabled. If added, it runs through Apps Script with the key in Script Properties and is documented in `SETUP.md` as optional.

Never scrape booking sites.

---

## 12. Extra features

Priority is set by phase in §19. Cut rather than ship something half-done.

- **Hours together in hotels.** Summed from check-in/check-out times: the most Dayuse stat possible.
- **Revisits.** "Our regular" badge for a hotel visited 3+ times.
- **Two ratings and "who picked it".** A friendly running score of whose picks rate higher.
- **Milestone stamps** (ink-outlined, satisfying unlock animation): first stay, 5/10/25/50/100 hotels, first stay outside the home city, first country abroad, three stays in one month, a stay on our monthly anniversary (the 19th), a 5-star stay, a hotel visited three times.
- **On this day** and a **monthly anniversary** moment on the 19th ("4 months together, 15 hotels in").
- **Together-since counter** from 19 June 2026, 23:46.
- **Next check-ins (wishlist)** with dashed pins, a "Surprise me" random pick, and one-tap conversion to a stay.
- **Share cards** (1080×1920): a single stay postcard, a stats card, the journey route.
- **Year in review** each 19 June anniversary (Phase 3 stretch).
- **Haptics** on Android for save, milestone and chapter change only.

---

## 13. The letter for Shady

**Placement: "A note on your pillow."** Like a hotel's turndown service. The first time Shady opens the app on her device (after choosing "Shady"), a pillow card with a small chocolate slides in. Tapping it lifts and flips the card in 3D and the letter reveals gently, line by line, signed by Nirsh. It stays re-readable in Us → Letters. When she reads it, `read_at` is written so Nirsh's app shows "Shady read your note".

Letters are data-driven from the `Letters` tab, so Nirsh can add future notes that unlock on milestones (e.g. at 25 hotels, or our first stay abroad).

**Seed this letter exactly as written.** Don't edit the wording. Show "Written in Dubai, September 2026" beneath the signature.

> **The letter text is private and kept out of git.** Read it from `private/letter.md` (a gitignored symlink in your working directory; absolute path `/Users/nirsh/Documents/GitHub/suite-nothings-build/shared/letter.md`). Seed it exactly as written there, keep every line break, and don't edit the wording.

---

## 14. Motion language

**House springs (Motion):**

| Use | Setting |
|---|---|
| Default UI (position, size, opacity) | `bounce: 0`, `duration: 0.35–0.4` |
| Things the user flicked or threw | `bounce: 0.2`, `duration: 0.4` |
| Bottom sheets | `bounce: 0.15`, `duration: 0.3`, velocity handoff from the drag |

**Rules**
- Press feedback on pointer-down (`scale(0.97)`), never on release.
- Every animation is interruptible and starts from the current on-screen value. Never lock input during a transition.
- Sheets track the finger 1:1, respect the grab offset, rubber-band at the edges, and decide open/close by release velocity.
- Card → detail uses shared-element transitions.

**Signature moments (the only places for big motion):** the intro key tag, the save celebration, map chapter changes, the journey, the letter, milestone unlocks. Everything else is quiet and quick. No fade-up-on-scroll on every section.

**Split-flap component:** reusable, per-character flaps with a top-half/bottom-half fold, slight random stagger, soft click sound. Used for the counter, chapter titles and journey dates.

**Three.js:** code-split and lazy-loaded; skipped on reduced motion or low-end devices (use `navigator.hardwareConcurrency` and a quick frame-time probe).

**Performance budget:** initial JS ≤ 300 KB gzipped before the map chunk; map and Three.js load lazily; LCP < 2.5s on 4G mid-range Android; 60fps interactions.

---

## 15. UX quality bar

- **Mobile first:** primary actions in the thumb zone, 44px minimum targets, safe-area insets, bottom sheets instead of modals, no hover-only affordances, `100dvh`, `overscroll-behavior` contained, `touch-action: manipulation` on controls while pinch stays enabled on the map and photos.
- **iOS PWA:** apple-touch-icon, `apple-mobile-web-app-capable`, status bar style, splash screens, custom install instructions (no `beforeinstallprompt` on iOS).
- **Android:** maskable icon, `theme_color`, install prompt, haptics. Standalone mode only activates when launched from the home-screen icon, not a browser tab; test it that way.
- **Accessibility:** WCAG AA contrast, visible focus rings, labelled pins and controls, list alternative to the map, respects text-size settings (rem-based spacing).
- **Copy voice:** warm, playful, short, sentence case, written as "us" ("our stays", "we checked in"). Hotel puns sparingly. Buttons say exactly what happens ("Save our stay", then a toast "Stay saved").

---

## 16. Demo mode and seed data

- Seed about 12 visits from 19 June 2026 onward across Dubai (Marina, Downtown, JBR, Palm Jumeirah, Al Barsha), Sharjah, Abu Dhabi and Ras Al Khaimah, plus 2 abroad, so all three map chapters and all three journey leg styles get exercised. Include one hotel visited twice.
- Use real, well-known hotels. Geocode them with Photon during development and hardcode the verified coordinates.
- Placeholder imagery: generated, on-brand illustrated gradients. No hotlinked stock photos.
- A clear "Demo" badge while in demo mode, and "Clear demo data" in Settings.

---

## 17. Testing and QA

- **Unit (Vitest):** adapters, outbox and retry, conflict resolution, header-name parsing of messy Sheet rows, chapter breakpoint math, journey camera math, stats, milestone rules, letter unlock rules.
- **E2E (Playwright, mobile viewports):** add a stay offline then sync online; edit, delete and undo; map loads and chapters switch; the journey plays start to finish; the letter unlocks for Shady; the manifest and service worker are valid.
- **Lighthouse:** Performance, Accessibility, Best Practices ≥ 90; installable.
- **Apps Script:** `selfTest()` passes.
- **Visual loop:** per screen, screenshot at three viewports, compare side by side with the Dayuse references, list differences, fix, repeat.

---

## 18. Repo structure

```
suite-nothings/
├─ apps-script/            Code.gs, appsscript.json
├─ public/                 icons, fonts, glyphs, fallback-world.geojson
├─ src/
│  ├─ config/              couple.ts, env.ts
│  ├─ styles/              tokens.css, global.css
│  ├─ components/          SplitFlap, BottomSheet, StayCard, Stamp, …
│  ├─ features/            onboarding, stays, add-stay, stay-detail, map,
│  │                       journey, letters, stats, wishlist, settings
│  ├─ map/                 style.json, chapters.ts, pins.ts, lighting.ts
│  ├─ data/                adapters/{demo,sheets}.ts, db.ts, sync.ts, types.ts
│  ├─ enrichment/          providers/*.ts
│  └─ lib/                 geo, dates, image, haptics, sound
├─ design/                 tokens.md, plan.md (references/ gitignored)
├─ tests/                  unit/, e2e/
├─ .github/workflows/      deploy.yml
├─ README.md  SETUP.md  PLAN.md  DECISIONS.md  CHANGELOG.md
```

---

## 19. Phases and acceptance criteria

### Phase 0: Design
Token extraction (§3.1), reference screenshots, design plan with ASCII wireframes for every screen, the key-tag mark, and a static clickable prototype of Stays, Add a stay, Stay detail and the Map chapter HUD using demo data.

**🛑 CHECKPOINT 1:** show me side-by-side screenshots (Dayuse reference vs ours) and the mark before building features.

### Phase 1: Working app in Demo Mode
App shell, PWA install, onboarding, Stays home, Add a stay, Stay detail, Map with all three chapters and pins, the letter, Settings, export/import.

Accept when:
- A stay can be added in under 30 seconds on a phone, including a revisit in one tap.
- The map zooms smoothly Dubai → UAE → globe with continuous crossfades and the chapter title flipping.
- The app installs on Android and iOS and works in airplane mode.
- Shady's first launch shows the pillow note.

**🛑 CHECKPOINT 2:** show me phone screenshots and a screen recording of the map and the save celebration.

### Phase 2: Live Google Sheet
`Code.gs` with `setup()` and `selfTest()`, the Sheets adapter, outbox sync, delta polling, photo upload to Drive, invite link and QR, Test connection, and `SETUP.md`.

Accept when: a stay added on one phone appears on the other within about 20 seconds; editing a cell by hand in the Sheet shows up in the app; nothing is lost after going offline, adding three stays, and reconnecting.

### Phase 3: Journey and delight
Full journey mode, milestone stamps, wishlist with Surprise me, on this day and anniversary moments, share cards, then the journey video export if time allows.

### Phase 4: Enrichment
Place data and Wikidata providers, then the optional AI and Google Places providers behind toggles.

---

## 20. `SETUP.md` requirements

Write it for a designer, not a developer: numbered steps, exact menu names, what I should see after each step.

1. Create the Google Sheet → Extensions → Apps Script → paste `Code.gs` and `appsscript.json` → run `setup()` → authorise → set the passphrase.
2. Deploy as a web app (*Execute as: Me*, *Anyone*) → copy the URL.
3. Create the GitHub repo → push → Settings → Pages → Source: GitHub Actions → wait for the deploy. (Optional: add the Apps Script URL as a repository variable `VITE_API_URL` as a default.)
4. On Nirsh's phone: open the app → Settings → Connection → paste the Apps Script link and passphrase → Test connection.
5. On Shady's phone: scan the invite QR from Nirsh's Settings, or paste the same link and passphrase by hand → Test connection. Add a stay on one phone and watch it appear on the other.
6. How to update the script without changing the URL.
7. How to change home base, add a future letter with an unlock rule, and safely edit data in the Sheet.
8. Troubleshooting table: symptom → cause → fix (e.g. "Test connection says unauthorised" → passphrase mismatch → re-enter it in Settings).
