# Suite Nothings — module contracts

This is the source of truth for every public API that feature agents consume. The signatures
here match the code on `agent/w0-foundation`. If you change a shared module (additively only),
update this file in the same commit and note it in `docs/handoff/<task>.md`.

Conventions:
- Import through the `@/` alias (`@/data/store`, `@/lib/dates`, …).
- Domain fields are **snake_case** (they mirror the Sheet columns). App-level code is camelCase.
- Calendar dates are `YYYY-MM-DD` strings, times are `HH:mm`, timestamps are ISO strings. Never
  convert a calendar date through `new Date()`; use `@/lib/dates`.
- Styles use CSS modules (`X.module.css`) that reference only token variables from
  `src/styles/tokens.css`. Never hardcode colours or sizes.
- Motion uses `motion/react` with the house springs from `@/lib/motion`; always check
  `useReducedMotion()`.

## Lazy-only libraries

These must **only** be imported with dynamic `import()` (never at the top of a module on the
initial path). The build puts them in their own chunks, and `npm run size` enforces the 300 KB
initial-JS budget.

| Library | Chunk | Used by |
|---|---|---|
| `maplibre-gl` (+ its CSS) | `maplibre` | map, mini map, journey |
| `three` | `three` | intro key tag, letter reveal |
| `gsap` | `gsap` | journey timeline (the split-flap does **not** use it) |
| `exifr` | its own async chunk (`full.esm-*.js`; no manual chunk, see DECISIONS) | add-stay photo step |
| `qrcode` | `qrcode` | invite QR in Settings |
| `@turf/*` | route chunks | only where needed; `@/lib/geo` covers the common maths without Turf |

`motion`, `idb` and `react` are on the initial path.

---

## App shell and routing (`src/app/`)

### `src/app/router.tsx`
A hash router: URLs look like `#/map?city=Dubai`. **Every route is already registered.** Feature
agents replace the component files, never the router.

| Route | Kind | Component file (default export) |
|---|---|---|
| `#/` | screen | `features/stays/StaysScreen.tsx` |
| `#/stay/:visitId` | screen | `features/stay-detail/StayDetailScreen.tsx` |
| `#/add` (`?hotel=<hotel_id>` revisit, `?here=1` from "We're at a hotel right now") | **sheet** (renders over the last screen) | `features/add-stay/AddStaySheet.tsx` |
| `#/map` (`?city=`, `?focus=visitId`) | screen | `features/map/MapScreen.tsx` |
| `#/journey` | screen | `features/journey/JourneyScreen.tsx` |
| `#/us` | screen | `features/us/UsScreen.tsx` |
| `#/letters` | screen | `features/letters/LettersScreen.tsx` |
| `#/letters/:id` | screen | `features/letters/LetterScreen.tsx` |
| `#/settings` | screen | `features/settings/SettingsScreen.tsx` |
| `#/join` (`?api=&key=&as=`) | fullscreen (no chrome) | `features/connection/JoinRoute.tsx` |
| `#/welcome` | fullscreen | `features/onboarding/Onboarding.tsx` |
| `#/wishlist` | screen | `features/wishlist/WishlistScreen.tsx` |
| `#/gallery` | fullscreen, unlinked | `app/Gallery.tsx` (component gallery for visual QA) |

Each route component must be a **default export with no props**. Read params from hooks.

```ts
type RouteName = 'stays'|'stay'|'add'|'map'|'journey'|'us'|'letters'|'letter'|'settings'|'join'|'welcome'|'wishlist'|'gallery';
interface Location { path: string; query: URLSearchParams; raw: string }
useLocation(): Location                         // reactive
useRoute(): { match: { route: RouteDef; params: Record<string,string> } | null; location: Location }
useParams(): Record<string, string>             // e.g. useParams().visitId
useQueryParam(name: string): string | null      // e.g. useQueryParam('city')
href(path: string, query?: Record<string, string|number|null|undefined>): string  // '#/map?city=Dubai'
navigate(to: string, opts?: { replace?: boolean }): void  // '/map' or '#/map'
goBack(fallback = '/'): void                    // history.back() inside the app, else navigate(fallback)
getLastScreen(): Location                       // what a sheet route renders over
<Link to="/map">…</Link>                        // plain <a href="#/…"> is fine too
parseHash, matchPath, matchRoute, ROUTES        // pure helpers (tested)
```

**Sheet routes.** `#/add` renders the last *screen* route behind it plus the sheet component.
The sheet component owns its `BottomSheet`. When it closes, it must leave the route with
`goBack('/')` after the close animation. The stub's `OnExit` pattern shows how.

### `src/app/Shell.tsx` (shared after merge)
The shell renders the desktop header (≥ 64rem; key-tag mark + name, Map, Journey, Us, "Add a
stay"), the mobile tab bar (Stays, Map, centre **+**, Journey, Us; 44 px targets, safe areas),
`OfflineBanner`, `DemoBadge`, `ToastHost`, a per-route `ErrorBoundary` and `Suspense` with a
`ClockLoader`. It also:
- Redirects to `#/welcome` when no `me` is set (except on `/welcome`, `/join` and `/gallery`).
- Shows a love-tone toast "Shady just checked in at …" when a pulled change adds a visit by the
  other person.
- Mirrors the reduced-motion override onto `<html data-reduced-motion>`.
- Main content is padded for the tab bar on mobile. Screens should wrap their content in
  `<div className="page">` (the max-width container with gutters and safe areas).

### `src/app/shortcuts.ts`
The keys are `N` → `#/add`, `M` → `#/map`, `J` → `#/journey` and `/` → Stays + focus search.
They're ignored while typing or while a modal dialog is open.
```ts
FOCUS_SEARCH_EVENT = 'sn:focus-search'
requestSearchFocus(): void
consumeSearchFocus(): boolean   // the Stays search field calls this on mount and on the event
```

### `src/app/ErrorBoundary.tsx`
`<ErrorBoundary resetKey?>`, with `ERROR_BOUNDARY_COPY` = "This screen tripped over its suitcase.
Your stays are safe on this phone." and a Reload button.

---

## Config (`src/config/`)

### `couple.ts`
`COUPLE` exactly as in SPEC §2, plus:
```ts
type PersonId = 'nirsh' | 'shady'
PEOPLE: readonly PersonId[]
personName(id: PersonId | null | undefined): string   // '' for null
otherPerson(id: PersonId): PersonId
```

### `env.ts`
```ts
API_URL: string          // VITE_API_URL default ('' if unset). A URL pasted in Settings always wins.
TILE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'   // swap the basemap in one line
PHOTON_URL = 'https://photon.komoot.io'
BASE_URL: string         // Vite base, ends in '/'
ALLOW_LOCAL_API: boolean // VITE_ALLOW_LOCAL_API === 'true' (tests only)
IS_DEMO_DEFAULT: boolean // true when no VITE_API_URL was baked in
APP_VERSION: string      // package.json version
```

---

## Data layer (`src/data/`)

### `types.ts` (shared)
These mirror SPEC §5. The key types:
- Enums (as `const` arrays plus a type):
  - `VISIT_TYPES` / `VisitType`: `Dayuse | Staycation | Overnight | Pool day | Spa | Brunch or dinner | Other`
  - `BOOKED_VIA` / `BookedVia`: `Dayuse | Direct | Booking.com | Other`
  - `MOODS` / `Mood` (`blissful, cosy, romantic, giddy, lazy, adventurous, fancy, sleepy`) plus `MOOD_LABELS`
- `Hotel`: all Sheet columns. `osm_id` looks like `"W91402276"`. `amenities_json` is a JSON
  string (parse it with `parseJsonArray`). `enrichment_status` is `'none'|'pending'|'done'|'failed'|'skipped'`.
  `price_level` is `1..4 | null` and `stars` is `number | null`.
- `Visit`:
  - `date` is `YYYY-MM-DD`; `check_in` and `check_out` are `HH:mm | null`; `nights` is `0` for day use.
  - `rating_nirsh` and `rating_shady` are `1..5 | null`.
  - `picked_by` is `PersonId | 'both' | null` and `added_by` is `PersonId | null`.
  - `photo_ids_json` is a JSON `string[]` that sets the display order.
- `Photo`: `thumb_file_id` and `full_file_id` hold Drive ids (sheets) or local blob keys (demo), and
  can be null until uploaded.
- `PhotoBlob`: `{ key: `${photo_id}:${'thumb'|'full'}`, photo_id, size, blob, mime, bytes? }`. Some WebKit builds
  refuse Blobs in IndexedDB; the store then saves `bytes` (ArrayBuffer) instead. Always read through `blobOf(row)` or `getPhotoBlob()`.
- `Wish`, `Letter` (+ `updated_at`), and `UnlockRule` (`'always'|'first_abroad'|`visits>=N`|`hotels>=N`|`date>=YYYY-MM-DD``).
- `SettingsMap`: `{ home_base: HomeBase; map_lighting: 'auto'|'day'|'golden'|'night'; units: 'km'|'mi'; updated_at }`.
- `HomeBase`: `{ city, country, countryCode, lat, lng, bbox?: [w,s,e,n] }`.
- `Stay` (derived, never stored): `{ visit, hotel, photos, visitNumber, stayNumber }`. Both
  numbers are 1-based and chronological; deleted visits get 0.
- `Snapshot`: `{ hotels, visits, photos, wishes, letters, settings: Partial<SettingsMap>, serverTime }`.
- `OutboxOp`: a discriminated union on `action`. The actions are `upsertHotel`, `upsertVisit`,
  `deleteVisit` (with `{visit_id, deleted, updated_at}`; undo sends `deleted:false`),
  `uploadPhoto` (with `{photo, thumb_key, full_key}`, where the blob keys point into `photoBlobs`),
  `upsertWish`, `markLetterRead` (with `{letter_id, read_at}`) and `updateSettings`
  (with `Partial<SettingsMap>`). Every op has `op_id, created_at, attempts, last_error?`.
  `OutboxPayload<A>` extracts the payload type.
- `ConnectionConfig`: `{ apiUrl, key, connectedAt, lastSyncAt }`.
- `Namespace`: `'demo' | 'live'`.

### `adapters/types.ts`: the `DataAdapter` interface
```ts
interface DataAdapter {
  readonly kind: 'demo' | 'sheets';
  ping(): Promise<{ ok: boolean; version?: string }>;
  bootstrap(): Promise<Snapshot>;
  changes(sinceIso: string): Promise<Snapshot>;      // rows with updated_at > since
  apply(op: OutboxOp): Promise<ApplyResult>;          // idempotent; LWW on updated_at
  getPhoto(id: string): Promise<Blob>;
  geocode(query: string, near?: { lat: number; lng: number }): Promise<PlaceResult[]>; // demo → []
}
interface ApplyResult { ok: true; applied?: Partial<Snapshot>; fileIds?: { thumb_file_id; full_file_id }; serverTime?: string }
type AdapterErrorCode = 'unauthorized'|'not_apps_script'|'network'|'server'|'conflict'|'not_configured';
class AdapterError extends Error { code: AdapterErrorCode; retryable: boolean /* network|server */ }
isAdapterError(e): e is AdapterError
adapterErrorMessage(code): string   // SPEC §6 copy: "Wrong passphrase", "This isn't an Apps Script web app link", "Can't reach Google right now", …
```
- **`adapters/demo.ts`**: `createDemoAdapter({ latencyMs?=220, seed? })`. It's a fake server
  kept in its own IDB (`suite-nothings-demo-server`), seeded from `seed.ts`. It throws
  `network` while `navigator.onLine === false`, so offline flows work in demo. It also exports
  `resetDemoServer()`, `clearDemoServer()` and `DEMO_VERSION`.
- **`adapters/sheets.ts`** (w1-backend): `createSheetsAdapter(config: ConnectionConfig): DataAdapter`.
  The stub rejects everything with `not_configured`. Replace the body and keep the export name. The
  store calls it through a factory, which you can also inject with `setSheetsAdapterFactory(fn)`.

### `db.ts` (idb)
```ts
openDb(ns: 'demo'|'live'): Promise<IDBPDatabase<SnDB>>   // cached per namespace; DB name `suite-nothings-${ns}`
closeDb(ns), deleteDb(ns), dbName(ns)
getMeta<T>(db, key), setMeta(db, key, value)
DB_VERSION = 1   // to migrate: bump it and append a step to MIGRATIONS (each runs once, in order)
```
The stores are `hotels`, `visits` (indexes `by_hotel`, `by_date`), `photos` (`by_visit`),
`photoBlobs` (`by_photo`), `wishes`, `letters`, `settings` (a single row keyed `"settings"`),
`outbox` (`by_created`), `drafts` (`{id, data, updated_at}`) and `meta` (`since`,
`bootstrapped`, …). Feature code should use the store, not `db.ts` directly.

### `device.ts`: device-level prefs (never synced, survive namespace switches)
These live in localStorage `sn:device:<key>`, with an in-memory fallback.
```ts
interface DevicePrefs { me: PersonId|null; connection: ConnectionConfig|null; mode: 'demo'|'live'|null;
  muted: boolean; reducedMotion: boolean|null /* null = follow OS */; introSeen: boolean; pillowShown: string[] }
getDevice(key), setDevice(key, value), onDeviceChange(cb), resetDevice(), DEVICE_DEFAULTS
```
To add a device pref: extend `DevicePrefs` and `DEVICE_DEFAULTS`, then add the key to the union
in `useDevicePref`. That's an additive change; note it in handoff.

### `store.ts`: the reactive store (the UI's source of truth)
**Every write** goes IDB row + outbox op (in one transaction) → memory → `sync.kick()`. Writes
are upserts by id with LWW on `updated_at` and soft deletes. Remote rows never overwrite an
entity that still has a pending local op.

Lifecycle:
```ts
initStore(opts?: { ns?: Namespace; adapter?: DataAdapter; startSync?: boolean }): Promise<void>  // main.tsx calls it
whenReady(): Promise<void>
resolveNamespace(): Namespace        // device.mode, else 'live' if a connection exists, else 'demo'
getState(): StoreState; subscribe(l): () => void; getAdapter(): DataAdapter
activateDemo(): Promise<void>                          // switch to the demo DB
activateLive(config: ConnectionConfig): Promise<void>  // save the connection, switch to the live DB (w1-backend calls this)
setSheetsAdapterFactory(f: (c: ConnectionConfig) => DataAdapter): void
applyRemote(snap: Partial<Snapshot>, source?: 'pull'|'echo'): Promise<RemoteChange>   // used by sync
```
Hooks (all reactive and memoised):
```ts
useStoreReady(): boolean                 // false until first data is in memory (show skeletons)
useBootError(): string | null
useAllStays(): Stay[]                    // every stay incl. deleted, oldest first
useStays(filter?: StayFilter): Stay[]    // excludes deleted; newest first by default
useStay(visitId): Stay | null            // includes deleted (for undo screens)
useHotels(): Hotel[]                     // non-deleted, most recently visited first (the add-stay "revisit" list)
useHotel(id): Hotel | null
useVisitsForHotel(hotelId): Stay[]       // oldest first, non-deleted
useWishes(): Wish[]                      // non-deleted, by priority
useLetters(): Letter[]                   // all, oldest first; unlock checks in features/letters/unlock.ts
useSettings(): SettingsMap
useMe(): PersonId | null
useDevicePref(key): DevicePrefs[key]     // 'me'|'muted'|'connection'|'introSeen'|'reducedMotion'|'pillowShown'|'mode'
useSyncState(): SyncState                // { online, pending, syncing, lastSyncAt, error: 'unreachable'|'unauthorized'|'server'|null, errorMessage }
useDemoMode(): boolean
usePhotoUrl(photoId, size?: 'thumb'|'full'): string | null   // object URL, auto-revoked
useStore(selector): T                    // escape hatch; the selector must return stable refs
```
`StayFilter` = `{ city?: string /* or 'Abroad' */; year?; type?: VisitType; minRating?; pickedBy?: PersonId|'both'; query?; hotelId?; includeDeleted?; order?: 'newest'|'oldest' }`.

Actions:
```ts
upsertHotel(input: Partial<Hotel> & Pick<Hotel,'name'|'lat'|'lng'|'city'|'country'|'country_code'>): Promise<Hotel>
upsertVisit(input: Partial<Visit> & Pick<Visit,'hotel_id'|'date'|'visit_type'>): Promise<Visit>   // added_by defaults to me
softDeleteVisit(visitId): Promise<void>; undoDeleteVisit(visitId): Promise<void>
deleteVisitWithUndo(visitId): Promise<void>     // soft delete + "Stay deleted" toast with Undo
upsertWish(input: Partial<Wish> & Pick<Wish,'name'>): Promise<Wish>
markLetterRead(letterId): Promise<void>         // sets read_at once
updateSettings(patch: Partial<Omit<SettingsMap,'updated_at'>>): Promise<SettingsMap>
addPhoto(visitId, file: Blob, opts?: { caption?; processed?: ProcessedPhoto }): Promise<Photo>   // stores blobs, appends to photo_ids_json, queues uploadPhoto; `processed` skips the pipeline
blobOf(row: PhotoBlob): Blob                    // read a photoBlobs row: `blob`, or `bytes` on engines that refuse Blobs in IDB
setPhotoProcessor(p: (file: Blob) => Promise<{ thumb; full; width; height; taken_at }>): void  // w1-add-stay installs the real resize/EXIF pipeline
getPhotoBlob(photoId, size?): Promise<Blob | null>
saveDraft(id, data), loadDraft<T>(id): Promise<{ id; data: T; updated_at } | null>, deleteDraft(id)
setMe(id: PersonId | null): void
resetDemo(): Promise<void>     // wipe + re-seed demo
clearDemo(): Promise<void>     // wipe demo, leave it empty
exportData(): Snapshot; importData(snap: Partial<Snapshot>): Promise<number>
syncNow(), onRemoteChange(cb)  // re-exported from sync
```

### `stays.ts`: pure helpers (unit-tested)
```ts
buildStays(visits, hotelsMap, photos): Stay[]   // oldest first, with visitNumber/stayNumber
filterStays(stays, filter, home?): Stay[]
cityTab(hotel, home): string                    // the city when in the home country, else 'Abroad'
ABROAD = 'Abroad'
averageRating(visit): number | null
parseJsonArray(json): string[]
visitSortKey(visit): string
```

### `sync.ts` (w1-backend owns it after merge; keep these exports)
```ts
startSync(ctx: SyncContext, opts?: { initialSync?: boolean }): () => void
stopSync(): void
syncNow(): Promise<void>          // flush + pull; never rejects (errors land in SyncState)
flush(): Promise<void>            // outbox oldest-first; stops at the first failure and schedules a retry
pull(): Promise<RemoteChange | null>   // changes(since) or bootstrap() the first time
kick(): void                      // debounced flush after a local write
onRemoteChange(cb: (c: RemoteChange) => void): () => void
backoffDelay(attempt, random?): number   // 1s, 2s, 4s … max 5 min, ±20% jitter (BACKOFF_BASE_MS, BACKOFF_MAX_MS)
activeAdapter(): DataAdapter | null      // diagnostics
interface RemoteChange { hotels; visits; newVisits; photos; wishes; letters; settings; source: 'pull'|'echo' }
interface SyncContext { adapter; listOutbox; removeOp; updateOp; applyRemote; onApplied?; getSince; setSince; setSyncState }
```
It listens for `online` and `offline`. A `conflict` error drops the op, because the server copy
wins on the next pull. Non-retryable errors (such as `unauthorized`) keep the ops and surface
in `SyncState`. It polls every 20 s while visible, on focus/visibility/`online`, and right after
writes (w1-backend). Additions:
```ts
POLL_INTERVAL_MS = 20_000; SINCE_OVERLAP_MS; withOverlap(since); opEntity(op)
onArrival(cb: (a: Arrival) => void): () => void      // a stay the *other* person added (pulled)
useRecentArrivals(): readonly Arrival[]              // last 30 s, newest first; animate the card in
acknowledgeArrival(visitId): void
interface Arrival { visitId; hotelId; addedBy; at }
```

### `connection.ts` (w1-backend)
```ts
validateApiUrl(raw, { allowLocal? }): { ok: true; url } | { ok: false; reason: 'empty'|'bad_url'|'dev_url'; message }
testConnection(url, key): Promise<{ ok; outcome: 'connected'|'wrong_passphrase'|'not_apps_script'|'unreachable'|'server'|'bad_url'; message; stays? }>
saveConnection(config|null), getConnection(), restoreConnection(), defaultApiUrl(), shortenUrl(url)
inviteLink({ apiUrl, key }, as, base?), parseJoinParams(query), demoOnlyStays()
```
`ConnectionForm` also takes optional `initialUrl`, `initialKey` and `as`. Wire format:
`apps-script/PROTOCOL.md`.

### `seed.ts`
`buildSeed(letterBody?: string | null): Snapshot` returns 11 hotels, 12 visits (19 Jun 2026 →
19 Sep 2026), 2 wishes and 1 letter. Coordinates come from Photon with their OSM ids. The
first stay is a Dayuse booking at Golden Tulip Al Barsha, which is also the hotel visited
twice. The legs cover glide, hop and flight; the countries are AE, OM and TR.
It also exports `seedUlid`, `defaultSettings()`, `DUBAI_BBOX`, `DEMO_LETTER_TITLE` and
`DEMO_LETTER_PLACEHOLDER`.

### The private letter
`virtual:private-letter` exports `{ body: string | null }` (see `build/private-letter.ts`).
`body` is the exact text of `private/letter.md` at build time, or `null` in CI or when
`SN_NO_PRIVATE_LETTER=1`. The demo seed uses it as `body_md` (`from: nirsh`, `to: shady`,
`unlock_rule: always`). **Never** copy the text into committed files, tests, snapshots or
logs. `node tools/check-private.mjs` fails if any line of it appears in a tracked file. Any
screenshot of the letter body goes in `private/checkpoints/…`.

---

## Lib (`src/lib/`), all unit-tested

| Module | Exports |
|---|---|
| `dates.ts` | `formatDate('2026-06-19')→'19 Jun 2026'`, `formatDateShort`, `formatMonth→'June 2026'`, `isIsoDate`, `parseDate`, `toIsoDate`, `daysInMonth`, `normaliseTime`, `formatTimeRange(in,out)→'14:00 → 20:00'`, `timeToMinutes`, `zonedParts`, `today(tz?, now?)` (Asia/Dubai), `nowTime`, `dayNumber`, `addDays`, `daysBetween`, `compareDates`, `togetherDuration(now?)→{days,hours,minutes,seconds,months,monthDays,totalMs}`, `monthAnniversaryDate(n)`, `monthsTogether(now?)`, `isMonthAnniversary(date)`, `anniversaryNumber(date)`, `formatRelative(iso)`, `MONTHS_SHORT`, `MONTHS_LONG` |
| `geo.ts` | `LatLng`, `BBox`, `haversineKm`, `kmToMiles`, `bearing`, `interpolateGreatCircle(a,b,t)`, `greatCircle(a,b,steps)` (unwrapped longitudes), `bbox`, `padBBox`, `inBBox`, `classifyLeg(km)→'glide'|'hop'|'flight'` (< 30, < 400, above), `legs(points)`, `pathKm`, `formatKm(km, units)`, `GLIDE_MAX_KM`, `HOP_MAX_KM` |
| `geocode.ts` | `searchPlaces(q, { near?, hotelsOnly?=true, limit?=8, lang?, signal?, timeoutMs? })` (tries `osm_tag=tourism:hotel` first, then a looser search with hotels sorted first), `reverse(lat,lng,opts?)`, `nearbyHotels(lat,lng,{radiusKm?,limit?})` (nearest first), `normalisePhoton(feature, near?)`, `PlaceResult` (`id, name, lat, lng, osm_id, kind, isHotel, street, housenumber, area, city, region, country, country_code, postcode, address, tags, source, distanceKm?`), `GeocodeError` (codes `timeout|network|aborted|bad_response`) |
| `ulid.ts` | `ulid(now?)` (monotonic), `ulidTime(id)`, `isUlid(id)` |
| `stats.ts` | `hotelCount`, `visitCount`, `stayHours(visit)`, `hoursTogether`, `cities`, `countries`, `countriesAbroad(stays, home)`, `kmTravelled(stays, home?)`, `farthestFromHome`, `longestStay`, `mostRevisited` (null without a revisit), `firstStay`, `latestStay`, `favouriteStay`, `whosePicksRateHigher → {nirsh, shady, winner}`, `awaitingRating(stays, person)`, `summary(stays, home?)` |
| `motion.ts` | `SPRING_UI` (bounce 0, 0.38 s), `SPRING_THROW` (0.2, 0.4 s), `SPRING_SHEET` (0.15, 0.3 s; pass `velocity`), `INSTANT`, `PRESS_SCALE=0.97`, `useReducedMotion()` (OS setting or Settings override), `prefersReducedMotion()`, `useReducedMotionAttribute()`, `motionSafe(reduced, full, fallback)` |
| `haptics.ts` | `haptic(kind?: 'tap'|'success'|'milestone'|'chapter'): boolean` (Android vibrate; a no-op elsewhere). Use it for save, milestone and chapter change only. |
| `sound.ts` | `play('beep'|'whoosh'|'flap')` (Web Audio synth; flap clicks rate-limited), `isMuted()`, `setMuted(b)` (stored in the device prefs) |
| `busy.ts` | `markBusy(key): () => void`, `isBusy()`, `onBusyChange(cb)`, `useMarkBusy(active, key)`. Every open form must register, so the SW update never reloads under it. |
| `toast.ts` | `toast.show({ message, tone?: 'neutral'|'success'|'error'|'love', action?: { label, onClick }, durationMs?, id? }): string`, `toast.dismiss(id)`, `toast.clear()`, `toast.subscribe(cb)`. Defaults are 4 s, 6 s with an action, and `0` for sticky; at most 3 show at once; the same `id` replaces. |
| `useMediaQuery.ts` | `useMediaQuery(q)`, `useIsDesktop()` (`(min-width: 64rem)`), `DESKTOP_QUERY` |

w1-add-stay:
- `image.ts`: `processImage(file, { exif? }) → { thumb, full, width, height, taken_at }` (480 px / 1600 px, WebP 0.8 else JPEG, orientation applied, EXIF stripped), `photoProcessor` (installed with `setPhotoProcessor` when the add sheet loads), `fitWithin`, `decodeImage`, `encode`, `stripJpegMetadata`, `THUMB_PX`, `FULL_PX`, `QUALITY`.
- `exif.ts`: `readExif(blob) → { takenAt, date, time, lat, lng, orientation }` (never throws; exifr lazy), `suggestFromExif(infos, current?)`, `parseExifDateString`.
- `LocationProvider` in `app/router.tsx`: the shell wraps the screen behind a sheet route in it, so `useParams()`/`useLocation()` there read the background location (`#/stay/:id` survives `#/add`).
- `BottomSheet` has `onDismissAttempt?()`: with `dismissible={false}`, scrim/Esc/drag-down/close call it so the owner can confirm first.
- `#/add?edit=<visitId>` edits a stay with the same steps (link to it from stay detail).
- `features/milestones/index.ts`: `checkMilestones` re-export and `showMilestoneUnlock(milestones)` (a no-op until the unlock UI lands).

---

## Components (`src/components/`), shared after merge

| Component | Props (summary) |
|---|---|
| `SplitFlap` | `value: string\|number; ariaLabel: string; length?; charset? (FLAP_CHARSET_DEFAULT = ' 0-9A-Z', FLAP_CHARSET_DIGITS); size?: 'sm'\|'md'\|'lg'\|'xl'\|css; animateOnMount?; riffle?=3; sound?=true; live?; className?; onSettled?()`. Only changed cells flip, and reduced motion changes the value instantly. It exposes `data-value` on the root and `data-flipping` on cells that are animating. `toCells(value, length)` is exported. |
| `BottomSheet` | `open; onClose(); title; hideTitle?; snapPoints?: number[] (fractions of the viewport, ascending; default [0.92]); initialSnap?; onSnapChange?(i); footer?; headerExtra?; dismissible?=true; desktop?: 'center'\|'sheet'; className?; children`. It renders in a portal, and `role="dialog"` is labelled by the title. Put `data-autofocus` on the element that should receive focus, and `data-no-drag` on controls inside the draggable area. `pickSnap()` is exported (pure). |
| `Button` / `ButtonLink` | `variant?: 'primary'\|'secondary'\|'ghost'\|'celebrate'` (celebrate = ginger, for love moments only); `size?: 'sm'\|'md'\|'lg'; icon?; iconEnd?; block?; busy?`, plus native attributes |
| `Chip` / `ChipGroup` | `Chip { selected?; icon? }`. `ChipGroup<V> { options: {value,label,icon?,count?}[]; value: V\|null\|V[]; onChange; multiple?; allowEmpty?; label; scroll?; className? }` |
| `Badge` | `tone?: 'honey'\|'ginger'\|'ink'\|'cream'\|'outline'; icon?` |
| `TimestampChip` | `checkIn; checkOut; fallback?` → `14:00 → 20:00` |
| `Toast` | `<ToastHost />` (mounted by the shell), re-exports `toast` |
| `Skeleton`, `StayCardSkeleton` | `width?; height?; radius?` |
| `ClockLoader` | `size?=48; label?='Loading'` (sweeping hands, `role=status`) |
| `EmptyState` | `title; body?; art?; action?` |
| `ErrorState` | `title; body?; onRetry?; retryLabel?` (`role=alert`) |
| `OfflineBanner` | none. It's driven by `useSyncState()` (offline, or unreachable/unauthorized Sheet). |
| `Stamp` | `title; caption?; icon?; tone?: 'honey'\|'ginger'\|'cream'; locked?; size?=96; label?` (the ink-outlined badge shell) |
| `DemoBadge` | `className?`. It renders only in demo mode. |
| `StayCard` | `stay; photoUrl?; badge?: {label,tone?}\|null (default autoBadge: 'First' / 'Visit N' / '♡ avg'); href?; onClick?; viewTransitionName?; footnote?; className?`. The root has `data-visit-id`. |
| `StayArt` | `seed (hotel_id); motif?: 'window'\|'pool'\|'skyline'; label?; className?; rounded?` (deterministic illustrated placeholder; no stock photos). `hashSeed` and `rng` are exported. |
| `icons/index.tsx` | 42 icons, `IconStays … IconSparkle` (the full list is in the brief), each taking `{ size?, title?, …svgProps }`. **w0-design replaces this file wholesale** and keeps the names. |

The `#/gallery` route shows every component with demo data. Use it for screenshots.

---

## Cross-feature seams (after int-1)

These were stubs in wave 0. Wave 1 built them for real; the signatures below are current.

| Module | Signature | Owner |
|---|---|---|
| `src/map/MiniMap.tsx` | `MiniMap(props: { lat; lng; zoom?; pitch?; dropPin?; label?; className?; interactive?; onMove?(center) })`, named and default export. Used by stay detail, add-stay (pin drop and celebration) and onboarding. | w1-map |
| `src/pwa/install.ts` | `useInstallPrompt(): { canInstall; isIOS; isStandalone; promptInstall(): Promise<'accepted'\|'dismissed'\|'unavailable'> }` (on iOS it opens the illustrated sheet), `detectIOS(ua?)`, `detectIOSSafari(ua?)`, `detectStandalone()`, `openIOSInstallSheet()`, `closeIOSInstallSheet()`, `useIOSInstallSheetOpen()`. The window event `sn:open-ios-install` also opens the sheet. | w1-shell |
| `src/pwa/register.ts` | `registerServiceWorker(): Promise<void>`. It prompts "A fresh version is ready" and waits for `isBusy()` to clear. | w1-shell |
| `src/lib/busy.ts` | `markBusy(key): release`, `useMarkBusy(active, key)`, `isBusy()`, `onBusyChange(cb)`. Add-stay and Write a note register while open. | w0 |
| `src/features/connection/ConnectionForm.tsx` | `ConnectionForm({ onConnected?(), compact?, initialUrl?, initialKey?, as? })` | w1-backend |
| `src/features/connection/ConnectionSection.tsx` | `ConnectionSection()` (the Settings section, including Demo ↔ Live) | w1-backend |
| `src/features/connection/JoinRoute.tsx` | `#/join?…`: sets `me`, connects, then goes to `#/welcome` (onboarding starts at Home base) or `#/` | w1-backend |
| `src/features/share/index.ts` | **Fully implemented (w2-delight).** `renderShareCard(kind: 'stay'\|'stats'\|'route', data): Promise<Blob>` (1080×1920 PNG, lazy chunk). `shareStay(visitId)`, `shareStats()`, `shareRoute(data?)` → `Promise<'shared'\|'copied'\|'cancelled'\|'unavailable'>`; each opens a preview sheet (Web Share API with files, else a PNG download). See "Share cards" below. | w2-delight |
| `src/features/stays/transition.ts` | `openStay(id)` and `closeStay(id)`: card ↔ detail View Transition | w1-stays |
| `src/features/milestones/index.ts` | **Fully implemented (w2-delight).** `checkMilestones(stays, prev, opts?)`, `allMilestones`, `milestoneDefs(opts?)` / `MILESTONE_DEFS`, `milestoneToast(m)`, `useMilestoneState(stays) → { defs, earned }`, `showMilestoneUnlock(ms)` (the ink-stamp unlock overlay), `notifyNewLetters(before, after)`. `Milestone { id: MilestoneId; title; caption; visitId; achievedOn; detail? }`. | w2-delight |
| `src/features/letters/unlock.ts` | `parseUnlockRule(raw)`, `isUnlocked(letter, { visits, hotels, countriesAbroad }, today): boolean`, `unlockHint(rule)`. **Fully implemented and tested.** | w1-shell |
| `src/enrichment/index.ts` | `requestEnrichment(hotelId, { force? }?): Promise<void>` (a no-op; marks the hotel `skipped`), `useEnrichmentStatus(hotelId): 'idle'\|'running'\|'done'\|'failed'\|'skipped'`, `EnrichmentProvider { id; canEnrich(hotel); enrich(hotel, signal): Promise<EnrichmentPatch> }` | later wave |

**Hero header:** while its hero is at the top, a screen sets `<html data-hero-header="1">` and
marks the hero element with a bare `data-hero` attribute. On desktop, `Shell` draws the header
transparent until the page has scrolled 80% of the hero's height.

**Outbox actions:** `upsertHotel`, `upsertVisit`, `deleteVisit`, `uploadPhoto`
(`{ photo, thumb_key, full_key }`; the blobs stay in `photoBlobs`, which may hold `bytes` on WebKit), `upsertWish`,
`markLetterRead`, `upsertLetter` (a full `Letter`) and `updateSettings`. Both adapters and
`sync.opEntity()` handle every action.

Feature stubs share `src/features/stubs.module.css`. Once no stub imports it, delete it.

---

## Share cards (`src/features/share/`, w2-delight)

1080×1920 PNGs in the Dayuse ink-outline style (canvas, no DOM/CSS at render time — waits on
`document.fonts.ready`). The renderer (`render.ts`, ~70 KB gzip) and the preview sheet are lazy
chunks; `index.ts` itself stays tiny on the initial path.

```ts
// index.ts — stable API; the journey screen also calls renderShareCard('route', …)
type ShareCardKind = 'stay' | 'stats' | 'route';
type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unavailable';
renderShareCard<K extends ShareCardKind>(kind: K, data: ShareCardDataMap[K]): Promise<Blob>  // 1080×1920 PNG
interface StayCardData { stay: Stay; total: number; photo?: Blob | null }      // total = live stays in all
interface StatsCardData { stays: Stay[]; home?: HomeBase }
interface RouteCardData { stays: Stay[]; home?: HomeBase; title?: string }
shareStay(visitId): Promise<ShareOutcome>
shareStats(): Promise<ShareOutcome>
shareRoute(data?: RouteCardData): Promise<ShareOutcome>   // defaults to every live stay from the store
downloadBlob(blob, fileName): void
stayCaption(i, n, hotelName, date) / statsCaption(summary) / routeCaption(km, hotels)  // design/copy.md §12
CARD_W = 1080; CARD_H = 1920
```

Each `share*` call opens a preview sheet (own React root, `SharePreview.tsx` via `host.tsx`,
no Shell edit) with a loading/error/ready state, then the Web Share API with files when
`navigator.canShare({ files })`, else a "Save image" download. `layout.ts` holds the pure,
unit-tested maths (text fit/wrap/balance, cover-fit crop, the route's equirectangular projection
and pin clustering) used by `render.ts`'s canvas drawing and by `art.ts`'s rasterised StayArt.

---

## Map engine (`src/map/`, w1-map)

Everything here lives in the lazy map chunk. Import `@/map/engine` **only** with dynamic
`import()`; the pure modules (`chapters`, `lighting`, `pins`, `prewarm`) have no MapLibre runtime
import and are safe anywhere (they're unit-tested).

```ts
// engine.ts
loadMaplibre(): Promise<typeof import('maplibre-gl')>   // once; also loads the CSS and sets the worker URL
supportsWebGL(): boolean
createSuiteMap(container: HTMLElement, opts: SuiteMapOptions): Promise<SuiteMap>
interface SuiteMapOptions {
  home: HomeBase; lighting?: 'auto'|'day'|'golden'|'night'; data?: MapData;
  camera?: Partial<Framing>; chapter?: Chapter /* initial framing, default 'city' */;
  interactive?: boolean /* true */; overlays?: boolean /* pins etc., true */;
  reducedMotion?: boolean; settle?: boolean /* = interactive */;
}
interface MapData { stays: readonly Stay[]; wishes?: readonly Wish[]; home?: HomeBase | null }
interface SuiteMap {
  map: maplibregl.Map; maplibre: typeof maplibregl; breakpoints: { city; country }; home: HomeBase;
  chapter(): Chapter; framing(c): Framing; setChapter(c, { animate? }?): void;   // flyTo (jump under reduced motion)
  setLighting(mode): void; look(): LightingLook;
  setData(d: MapData): Promise<void>; setArcsVisible(b): void; setIdleSpin(b): void;
  select(hotelId | null): void; flyToHotel(hotelId, { zoom? }?): void; resetNorth(): void;
  onChapterChange(cb(chapter, prev)): off; onView(cb({ zoom, chapter, inView, bearing, pitch })): off;
  onPinClick(cb(StayPinProps)): off /* hotelId '' = tapped empty map */;
  onLookChange(cb(LightingLook)): off; onFallbackChange(cb(boolean)): off; isFallback(): boolean; hasTiles(): boolean;
  // Journey helpers
  addLine(id, coords: [lng, lat][], { color? /* ginger */, width?, outline? /* ink casing, true */, opacity?, dash? }?): LineHandle;
  //   LineHandle { id; setCoordinates(c); setProgress(0..1) /* draws the first p of the line (line-progress) */; setOpacity(o); remove() }
  addMarker(el: HTMLElement, lngLat, { anchor?: 'center'|'bottom' }?): MarkerHandle;   // traveller icon
  //   MarkerHandle { element; setLngLat(ll); setRotation(deg /* map-aligned */); remove() }
  project(lngLat): { x, y }; unproject({ x, y }): { lng, lat };
  destroy(): void;
}
```
- Lines and markers survive the offline fallback style swap (the engine re-installs them).
- For the journey, drive the camera yourself with `map.jumpTo` each frame; call `setIdleSpin(false)`
  and pass `settle: false` so the engine never fights your timeline.
- Layer ids we add: `sn-pins`, `sn-cities`, `sn-countries`, `sn-wishes`, `sn-home`, `sn-arcs(-casing)`,
  `sn-line-<id>(-casing)`; sources `sn-*`. The vector style is `src/map/style.json` (tile URL:
  `openmaptiles` source; `TILE_STYLE_URL` in env stays the one-line swap for the whole style).

```ts
// chapters.ts (pure)
type Chapter = 'city'|'country'|'world'
computeBreakpoints(home): { city, country }        // Dubai ≈ 9.48 / 5.49
chapterForZoom(zoom, bp): Chapter
framingFor(chapter, home, bp, viewport): { center, zoom, pitch, bearing }
chapterTitle(chapter, home): string                // DUBAI / UNITED ARAB EMIRATES / THE WORLD
settleTarget(zoom, bp), fitZoom(bbox, vp?), cityBBox(home), countryBBox(home), flapText(s), CHAPTER_PITCH
// lighting.ts (pure)
solarPosition(date, lat, lng), phaseAt(date, lat, lng), resolvePhase(mode, date, lat, lng), lookFor(phase, sun?)
LightingPhase = 'dawn'|'day'|'golden'|'sunset'|'night'; LIGHTING_REFRESH_MS = 5 min
// pins.ts
aggregate(stays, wishes, home): PinAggregates     // pins per hotel, city + country bubbles, wishes, arcs, home
ensurePinImages(map, agg), mapPixelRatio() /* ≤ 2 */, neighbours(agg, hotelId, n)
// prewarm.ts
prewarmHomeTiles(home, tileJsonUrl, signal?)      // z9–14, ≤ 300 tiles, only with an SW, online, idle
```

`MiniMap` keeps its props contract. It's lazy (IntersectionObserver), non-interactive by default,
pitched 50° at z15, shows a `StayArt` tile while loading or without WebGL, bounces the pin with
`dropPin`, and with `interactive` + `onMove` becomes a pin picker (the pin lifts while dragging;
`onMove` fires on `moveend` with the centre rounded to 6 dp).

Test hook: with `localStorage['sn:e2e'] === '1'`, MapScreen sets `window.__sn.map` to its `SuiteMap`.
Map specs are named `map*.spec.ts` and run only in the `map-390`, `map-412` and `map-1440`
Playwright projects (Chromium with software GL flags).

---

## Tooling

| Command | What it does |
|---|---|
| `npm run build` | `tsc -b`, then `vite build`, then copies `dist/404.html` |
| `npm run size` | Gzipped initial JS (the entry plus its modulepreloads); fails above 300 KB |
| `npm run e2e` | Builds, then serves a preview on `$PREVIEW_PORT`. Projects: `iphone-390` (WebKit), `pixel-412`, `desktop-1440`. Service workers are blocked. |
| `npm run e2e:dev` | The same tests against the dev server on `$PORT` |
| `node tools/check-private.mjs` | Checks that no private letter text is in a tracked file |

E2E helpers live in `tests/e2e/helpers.ts`:
- `resetApp(page, { me?: 'nirsh'|'shady'|null, hash? })` wipes IDB and storage, sets `me`
  (default `nirsh`) and loads `hash`.
- `watchConsole(page)` collects console errors and warnings.
- `checkpoint(page, testInfo, name)` saves to `design/checkpoints/w0-foundation/`, but only
  with `CHECKPOINTS=1`; otherwise it attaches the image to the report, so plain `npm run e2e`
  never dirties the tree. Copy the pattern for your own task folder.
- `isMobile(testInfo)` and `waitForStays(page)` are helpers.

Tooling ignores `design/**`, `private/**`, `dist/**`, `dev-dist/**`, `.tmp/**` and `apps-script/**`.

---

## Ownership

- **w0-foundation:** everything not listed below. After the merge, the shell,
  `src/data/{types,db,store}.ts`, `src/lib/*`, `src/components/*` (except icons) and the router
  are **shared**. Feature agents may only make additive changes to them, and must note each
  one in `docs/handoff/`.
- **w0-design:** `design/**`, `src/styles/tokens.css`, `src/styles/fonts.css`,
  `src/components/icons/**`, `public/icons/**`, `public/fonts/**`, `public/favicon.svg`,
  `src/components/brand/**`.
- **w1-stays:** `src/features/stays/**`, `src/features/stay-detail/**`.
- **w1-add-stay:** `src/features/add-stay/**`, `src/lib/image.ts`, `src/lib/exif.ts`. It may
  also extend `src/lib/geocode.ts`, additively.
- **w1-map:** `src/map/**`, `src/features/map/**`, `public/glyphs/**`,
  `public/fallback-world.geojson`.
- **w1-shell:** `src/features/onboarding/**`, `src/features/intro/**`,
  `src/features/letters/**`, `src/features/settings/**` (not connection), `src/pwa/**`, and the
  PWA part of `vite.config.ts`.
- **w1-backend:** `apps-script/**`, `src/data/adapters/sheets.ts`, `src/data/sync.ts`,
  `src/data/connection.ts`, `src/features/connection/**`, `tools/**`, `SETUP.md`, `README.md`.
- **Later waves:** `src/features/journey/**`, `src/features/us/**`,
  `src/features/milestones/**`, `src/features/wishlist/**`, `src/features/share/**`,
  `src/features/moments/**`, `src/enrichment/**`.
