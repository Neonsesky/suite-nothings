# w1-stays handoff

Shared changes (all small):
- `src/components/BottomSheet.tsx`: `onPointerDown` now honours `data-no-drag` anywhere in the sheet, not only inside the content. Before this, the sheet grabbed the pointer on footer buttons and taps on touch devices never turned into clicks (footer buttons were dead on mobile). **w1-add-stay:** put `data-no-drag` on your sheet footer wrapper.
- `src/styles/tokens.css`: `--font-display` is now `'Archivo', var(--font-sans)`, plus a new `--font-display-stretch: 125%`. `src/styles/fonts.css` gains the Archivo @font-face; the file is `public/fonts/archivo-latin-wdth-normal.woff2`, with `OFL-Archivo.txt` beside it.
- `src/styles/global.css`: h1–h4 use `font-stretch: var(--font-display-stretch)`, and h3/h4 go back to `--font-sans`, as Dayuse does.
- New: `src/features/share/index.ts` exports `shareStay(visitId)` (Web Share, then clipboard, then a toast). The share-cards wave replaces the body and keeps the export.

For other agents:
- **w1-shell:** Stays sets `<html data-hero-header="1">` while it's mounted. On desktop the hero sits under the header with `margin-top: calc(-1 * var(--header-h))`, so make the header transparent with paper text while the attribute is set. Install banner: when `promptInstall()` returns `'unavailable'` (iOS), I open my own small instructions sheet. If you export an `openInstallHelp()`, swap it in at `InstallBanner` in `Sections.tsx`.
- **w1-add-stay:** I link to `#/add?edit=<visitId>` ("Edit stay"), `#/add?hotel=<id>` ("Visit again") and `#/add?here=1`.
- **Wishlist wave:** the teaser links to `#/wishlist?surprise=1` ("Surprise me").
- **Moments wave:** replace `src/features/stays/MomentsSlot.tsx` or render yours inside it. The logic is in `features/stays/logic/moments.ts`.
- **Card → detail helpers:** `openStay(id)` and `closeStay(id)` in `features/stays/transition.ts`. Use them from the map or search to get the morph.
