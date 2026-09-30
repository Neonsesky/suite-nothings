# Decisions

- [w0-design] Manrope (variable 200–800, Fontsource WOFF2, latin + latin-ext) for all UI text — dayuse.ae loads Manrope from Google Fonts itself; its primary face "MaisonNeue" is commercial, so we don't use it — swap the files in `public/fonts/` and `src/styles/fonts.css` to change.
- [w0-design] JetBrains Mono (variable, latin) as `--font-mono` for timestamp chips and split-flap boards — Manrope's tabular figures look too soft on flap tiles; a sturdy mono reads as a departures board — point `--font-mono` at Manrope with `font-variant-numeric: tabular-nums` to drop the 40 KB file.
- [w0-design] Ink is Dayuse's measured text colour #292935, not pure black — it matches body/heading/footer computed styles on all three pages — change `--color-ink` in tokens.css.
- [w0-design] Honey #FFC536 / honey-deep #FFAF36 and ginger #FC5E57 come from Dayuse's CSS (brand yellow, hover yellow, coral) — measured, not guessed — edit tokens.css + `design/tools/mark.mjs` colours, then re-run `node export-icons.mjs`.
- [w0-design] Added `--color-ginger-ink` #B3302A for love-coloured *text*; `--color-ginger` fails AA with white text (3.05) — ginger is a fill; use ink text on ginger (4.70) — remove the variable if no screen needs coloured text.
- [w0-design] `--color-success` darkened to #17784F (5.47:1 on paper) — the first pick failed AA — tokens.css.
- [w0-design] Desktop header 80 px (Dayuse's measured height); mobile header stays 56 px because mobile gets a bottom tab bar — `--header-h` in tokens.css.
- [w0-design] Buttons, search bar, city tabs and time chips are pills (`--radius-pill`), active city tab is ink-filled — measured from dayuse.ae computed styles — `design/plan.md` §5.
- [w0-design] Card badge mapping: Dayuse's white feature pill on the photo → "First stay"/"Our regular"; Dayuse's ink discount pill → "Visit 3"/"♡ 5"; Dayuse's outlined time-slot pills → our timestamp chip — keeps the card 1:1 — plan.md §4.
- [w0-design] Mark = diagonal oval key fob with split ring, "619" drawn as ink strokes (not a font) so it renders identically everywhere; PWA tiles are honey with a paper fob — `design/tools/mark.mjs` holds the geometry; KeyTagMark.tsx mirrors it.
- [w0-design] Mood stamps: Blissful, Lazy, Fancy, Giggly, Romantic, Adventurous, Cosy, Fizzy (ids lowercase) — 8 covers the day-use moods without a picker scroll on 390 px — `MOODS` in MoodStamps.tsx.
- [w0-design] Map pins ship as SVG strings with literal hex colours (a rasterised image can't read CSS vars) — `PIN_COLORS` in pins.ts must track tokens.css.
- [w0-design] iOS splash screens cover 12 portrait sizes (iPhone SE 2 → 17 Pro Max/Air); no landscape — the PWA is portrait-first — add sizes to `SPLASHES` in export-icons.mjs.
