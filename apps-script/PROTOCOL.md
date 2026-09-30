# Apps Script wire protocol (Code.gs ⇄ app)

The single reference for `apps-script/Code.gs`, `tools/mock-apps-script.mjs` and
`src/data/adapters/sheets.ts`. SPEC §5–§6 are the brief; this file pins the details.

## Transport
- One web app URL: `https://script.google.com/macros/s/<id>/exec`.
- Real Apps Script answers every request with a **302** to `script.googleusercontent.com/macros/echo?…`,
  which serves the JSON (with `Access-Control-Allow-Origin: *`). `fetch(..., { redirect: 'follow' })`
  follows it. POST bodies become a GET on the redirect target.
- GET: query params `action`, `key`, plus action params.
- POST: **simple request only**: `Content-Type: text/plain;charset=utf-8`, body is a JSON string
  `{ "key": "...", "action": "...", "payload": {...} }`, no custom headers. Apps Script can't
  answer a CORS preflight.
- Every response is `ContentService` JSON (`MimeType.JSON`):
  - success: `{ "ok": true, "data": <any> }`
  - failure: `{ "ok": false, "error": { "code": <code>, "message": "<plain words>" } }`
  - codes: `unauthorized`, `bad_request`, `not_found`, `conflict`, `server`.
- HTTP status is always 200 (Apps Script can't set it). The app reads `ok`.

## Auth
- Script Property `APP_KEY`. Required for every action except `ping`. Compared in constant time.
  If `APP_KEY` is not set, every keyed action answers `unauthorized` with the message
  "The passphrase isn't set yet. Run setup() in the Apps Script editor."

## Sheets (tabs) and columns (SPEC §5, plus two server columns)
| Tab | Columns |
|---|---|
| `Hotels` | `hotel_id, name, brand, address, area, city, region, country, country_code, lat, lng, source, osm_id, wikidata_id, website, phone, stars, price_level, description, description_source, amenities_json, cover_photo_id, enrichment_status, enriched_at, created_at, updated_at, deleted, server_updated_at` |
| `Visits` | `visit_id, hotel_id, date, check_in, check_out, nights, visit_type, booked_via, note, favourite_moment, mood, rating_nirsh, rating_shady, picked_by, added_by, photo_ids_json, created_at, updated_at, deleted, server_updated_at` |
| `Photos` | `photo_id, visit_id, thumb_file_id, full_file_id, width, height, taken_at, caption, created_at, deleted, updated_at, server_updated_at` |
| `Wishlist` | `wish_id, name, lat, lng, city, country, note, added_by, priority, fulfilled_visit_id, created_at, updated_at, deleted, server_updated_at` |
| `Letters` | `letter_id, title, body_md, from, to, unlock_rule, written_at, read_at, created_at, updated_at, server_updated_at` |
| `Settings` | `key, value` (rows: `home_base` (JSON), `map_lighting`, `units`, `updated_at`) |
| `Log` | `timestamp, actor, action, detail` |

- `server_updated_at` is the **server clock** at the last write (by the app, by `onEdit` for hand
  edits, or when the server stamps a row that had a blank `updated_at`). `changes` filters on it,
  so a phone with a skewed clock can never hide a change from the other phone. The app ignores
  this column.
- `Photos.updated_at` and `Letters.updated_at` are appended so LWW works for them. If blank, readers
  fall back to `read_at ?? created_at` (letters) or `created_at` (photos).
- Columns are found **by header name** (trimmed, case-insensitive). Unknown columns are kept
  untouched. Missing known columns are appended on write (and by `setup()`).
- Timestamp cells are formatted as plain text (`@`) by `setup()` so Sheets doesn't turn ISO strings
  into dates; readers still accept Date objects.

## Row normalisation (server on read; the app repeats it tolerantly)
- Strings: trimmed; empty → `null`. IDs empty → the row is skipped (blank rows are ignored).
- Numbers (`lat, lng, stars, price_level, nights, rating_nirsh, rating_shady, width, height, priority`):
  number or numeric string → number; blank/invalid → `null` (`nights` → `0`).
- Booleans (`deleted`): `true/TRUE/"true"/"yes"/1` → `true`, else `false`.
- `date`: `YYYY-MM-DD`. Accepts a Date object (formatted in the spreadsheet timezone), `YYYY-MM-DD`,
  `YYYY/MM/DD`, `DD/MM/YYYY`, `19 Jun 2026`, an ISO timestamp.
- Times (`check_in, check_out`): `HH:mm`. Accepts Date objects (spreadsheet timezone), numbers as a
  fraction of a day (0.5833… → `14:00`), `14:00`, `14:00:00`, `9:5`, `2pm`/`2:30 PM`.
- Timestamps (`created_at, updated_at, enriched_at, taken_at, read_at, written_at, server_updated_at`):
  ISO 8601 UTC strings (`2026-09-30T12:00:00.000Z`). Date objects → `toISOString()`. A bare
  `YYYY-MM-DD` stays as is (`written_at` may be a plain date).
- JSON columns (`amenities_json, photo_ids_json`): kept as JSON strings. Server accepts arrays on
  write and stringifies them.
- Enum columns are passed through trimmed; the app validates.

## GET actions
| Request | `data` |
|---|---|
| `?action=ping` | `{ version, serverTime }`. Also top-level `version` (SPEC: `{ ok: true, version }`). No key. |
| `?action=bootstrap&key=K` | `{ hotels, visits, photos, wishes, letters, settings, serverTime }` — every row, deleted ones included. |
| `?action=changes&since=ISO&key=K` | Same shape; only rows whose `server_updated_at > since` or `updated_at > since`; `settings` is `{}` unless it changed. Invalid `since` → `bad_request`. |
| `?action=photo&id=FILE_ID&key=K` | `{ mime, base64 }` for a Drive file id (`thumb_file_id` or `full_file_id`). Missing → `not_found`. |

`settings` in responses is an object: `{ home_base: {...}, map_lighting, units, updated_at }`
(`home_base` parsed from JSON; unknown keys passed through, strings JSON-parsed when they parse).

Before `bootstrap`/`changes` read a tab, rows that have an ID but a blank `updated_at` are
stamped (`updated_at = server_updated_at = now`), so rows typed in by hand sync too.

## POST actions (`payload` → `data`)
All writes run inside `LockService.getScriptLock().waitLock(20000)` and write a `Log` row.
Upserts are by ID with **last-write-wins on `updated_at`**: an incoming row replaces the stored one
only if `incoming.updated_at > stored.updated_at`. Equal = same op replayed → no change. Older →
no change. In every case the answer is `{ row: <the row the Sheet now holds>, applied: boolean, serverTime }`.

| Action | Payload | Notes |
|---|---|---|
| `upsertHotel` | a `Hotel` | `hotel_id`, `updated_at` required, else `bad_request`. |
| `upsertVisit` | a `Visit` | `visit_id`, `hotel_id`, `date`, `updated_at` required. |
| `deleteVisit` | `{ visit_id, deleted, updated_at }` | Soft: sets `deleted` + `updated_at` (LWW). Unknown id → `not_found`. Undo sends `deleted: false`. |
| `uploadPhoto` | `{ photo: Photo, thumb: { mime, base64 } \| null, full: { mime, base64 } \| null }` | Writes files to the Drive folder `PHOTOS_FOLDER_ID` (names `<photo_id>-thumb.jpg` / `-full.jpg`), then upserts the `Photos` row with the file ids. Idempotent: if the row already has file ids, no new files. `data` adds `fileIds: { thumb_file_id, full_file_id }`. |
| `upsertWish` | a `Wish` | |
| `upsertLetter` | a `Letter` | So Nirsh can write future notes from the app. |
| `markLetterRead` | `{ letter_id, read_at }` | Sets `read_at` only if blank (first read wins); bumps `updated_at`. Unknown id → `not_found`. |
| `updateSettings` | `Partial<SettingsMap>` with `updated_at` | LWW on the `updated_at` settings row. `data` = `{ settings, applied, serverTime }`. |
| `geocode` | `{ query, near?: { lat, lng } }` | `Maps.newGeocoder()`; `data` = `{ results: [{ name, address, lat, lng, city, region, country, country_code, postcode }] }` (max 8). |

Unknown action → `bad_request`. Malformed JSON body → `bad_request`. Anything thrown → `server`
(message logged in `Log`).

## Script Properties
`APP_KEY` (passphrase), `PHOTOS_FOLDER_ID` (Drive folder "Suite Nothings photos"),
`SPREADSHEET_ID` (so the script also works when opened standalone), `SCHEMA_VERSION`.

## Editor functions
- `setup()`: creates missing tabs + headers (appends missing columns; never clears), dropdown
  validations on enum columns (`visit_type, booked_via, mood, picked_by, added_by, source,
  enrichment_status, price_level, from, to`), frozen header row, text format on timestamp
  columns, creates the Drive folder once, writes Script Properties, prompts for `APP_KEY` when a UI
  is available (else logs how to set it in Project Settings → Script properties), then calls
  `seedLetters_()` if defined. Safe to re-run.
- `selfTest()`: upserts a fake visit (id prefix `SELFTEST`), reads it back via `changes`, soft
  deletes it, replays the same op (no duplicate), then removes the test rows. Logs "selfTest passed".
- `onEdit(e)`: simple trigger; when a person edits a data tab, stamps `updated_at` and
  `server_updated_at` on each edited row (unless they edited `updated_at` themselves).
