# Design tokens (measured from dayuse.ae, 30 Sep 2026)

How we got them: `design/tools/fetch-dayuse.mjs` fetched the home, Dubai results and Golden Tulip Al Barsha pages plus all their CSS bundles, `parse-css.mjs` counted the values, and `capture-dayuse.mjs` took screenshots and ran `getComputedStyle` on 36 elements × 3 pages × 2 widths. Raw data (gitignored) is in `design/references/{css-summary.json,computed.json,NOTES.md}`. Implemented in `src/styles/tokens.css`.

## Colour

| Token | Value | Dayuse source |
|---|---|---|
| `--color-ink` | #292935 | body/heading/header computed `color` rgb(41,41,53), "shadow-black" |
| `--color-muted` | #54545D | struck price, FAQ answer `color` rgb(84,84,93) (shadow-black-80) |
| `--color-struck` | #A9A9AE | hotel-page struck price (shadow-black-40) |
| `--color-footer-text` | #D4D4D7 | footer link/text colour (shadow-black-20) |
| `--color-line-input` | #EAEAEB | search bar 1 px border (shadow-black-10) |
| `--color-line` / `--color-line-strong` | #E5E7EB / #D1D5DB | city-tab border, Tailwind gray-200/300 in bundle |
| `--color-paper` | #FFFFFF | page background |
| `--color-surface` | #F6F6F8 | trust-badge panel background (light grey, measured by eye ≈ #F7F7F7) |
| `--color-honey` | #FFC536 | primary CTA gradient end ("See hotels", "Open") |
| `--color-honey-deep` | #FFAF36 | primary CTA gradient start / hover |
| `--color-honey-soft`, `--color-cream` | #FFEAB0, #FFF8E9 | derived: honey at ~40% / ~12% on paper (ours) |
| `--color-ginger` | #FC5E57 | coral in bundle (5 uses), also the gradient trust icons |
| `--color-ginger-soft`, `--color-ginger-ink` | #FFE1DC, #B3302A | derived (ours) for washes and AA text |
| `--color-teal` | #51B0B0 | "Free cancellation" and review badge (smart-blue) |
| `--color-focus` | #2299DD | link blue in bundle (blue-sky family #3597C8) |
| `--color-success` / `--color-danger` | #17784F / #D93A32 | ours, AA-checked |

Not used: Dayuse purple #6E69AC (map price pins and clusters) and sunset #EE825F, because ours stay honey/ginger.

## Type

| Token | Value | Dayuse source |
|---|---|---|
| `--font-sans` | Manrope 200–800 | Google Fonts link on every page; body/UI family |
| `--font-display` | = sans (Manrope 800) | Dayuse headline1/2 and title1 use **MaisonNeue Extended Bold** (commercial, self-hosted by them), so we use Manrope 800 with -0.01em tracking instead |
| `--font-mono` | JetBrains Mono | ours (split-flap, timestamps) |
| `--text-2xs…4xl` | 11 / 12 / 14 / 16 / 18 / 20 / 24 / 32 / 48 px | body4 12, body3 14, body2 16, title4 16–18, title3 18–20, title1 24 (mobile), headline2 32 (mobile) → 56 desktop, headline1 36 → 72 desktop; for 56–72 px heroes use `clamp(var(--text-3xl), 5vw, 4rem)` |
| weights | 400 / 500 / 600 / 700 / 800 | bundle counts: 500 ×22, 700 ×20, 600 ×17, 800 ×2; body 500, titles 600–700, price 800 |
| `--leading-tight` / `--leading-normal` | 1.2 / 1.5 | headline 40/36 ≈ 1.1–1.2; body 24/16 = 1.5 |
| letter-spacing | .01em body3; -0.01em our headings | bundle `.01em` ×5 |

## Radii, shadow, spacing, layout, motion

| Token | Value | Dayuse source |
|---|---|---|
| `--radius-xs` | 4 px | review badge `rounded-5` (5 px) |
| `--radius-sm` | 8 px | mobile card `rounded-lg` |
| `--radius-md` | 12 px | bundle `12px` ×3 (photo frames) |
| `--radius-lg` | 16 px | desktop card `rounded-2xl` |
| `--radius-xl` | 24 px | trust panel, our sheet tops |
| `--radius-pill` | 9999 px | every button, tab, chip, search bar, discount badge |
| `--shadow-card` / `--shadow-card-hover` | 0 0 10px /10%, 0 0 15px /12% | `shadow-100` / `shadow-200` |
| `--shadow-sm`, `--shadow-sheet`, `--shadow-pop` | ours | Dayuse has no sheet shadow |
| `--space-*` | 4 px grid, rem | Tailwind spacing; nav link padding 12×20, button 0×28, FAQ 24/32 vertical |
| `--header-h` | 56 mobile / 80 desktop | header `h-20` = 80 px at both widths (we keep 56 on mobile because of the tab bar) |
| `--content-max` | 1280 px | `.ds-container` 1280 (1340 at ≥1440) |
| `--gutter` | 16 / 24 px | container padding 20 px |
| breakpoints | 640 / 768 / 1024 / 1280 | media queries (768 ×23 uses) |
| `--dur-fast/base/slow` | 150 / 250 / 400 ms | transitions `duration .15s` ×9, `.16s ease-out` |
| `--z-overlay`, `--z-toast` | 1031, 1060 | bundle z-indexes |
| button height | 52 mobile / 42 desktop | primary button computed height |
| search bar | 58 px, pill, 1 px #EAEAEB | computed container |
| city tab | 54 px pill; active ink fill + white text | computed active/inactive tabs |

## Dayuse app (store listings, described, not copied)

From the App Store and Play listings: a bottom tab bar (search/explore, favourites, bookings, account); a full-screen map with price pills and a draggable bottom sheet of results; cards that are photo-led with rounded corners, a heart at the top right, and time slots as pills; honey primary buttons; white surfaces with the ink text. We copy the patterns (tab bar, map + sheet, pill slots), not the screens.

## Could not extract

- MaisonNeue Extended (their display face) is commercial, so we substitute Manrope 800.
- The trust-panel grey and the icon gradients were read from pixels, not from CSS variables (they're inline SVG).
- There are no sheet/modal shadows or spring curves on the web; ours come from SPEC §14.

## WCAG AA contrast (generated by `node design/tools/contrast.mjs`)

| Foreground | Background | Ratio | AA normal (4.5) | AA large / UI (3.0) | Used for |
|---|---|---|---|---|---|
| `ink` #292935 | `paper` #ffffff | 14.36 | pass | pass | body text, headings |
| `ink` #292935 | `cream` #fff8e9 | 13.57 | pass | pass | text on banners |
| `ink` #292935 | `surface` #f6f6f8 | 13.30 | pass | pass | text on grey sections |
| `ink` #292935 | `honey` #ffc536 | 9.09 | pass | pass | primary button label, badges |
| `ink` #292935 | `honey-deep` #ffaf36 | 7.82 | pass | pass | pressed primary button |
| `ink` #292935 | `honey-soft` #ffeab0 | 12.06 | pass | pass | selected chip |
| `ink` #292935 | `ginger` #fc5e57 | 4.70 | pass | pass | favourite badge label |
| `ink` #292935 | `ginger-soft` #ffe1dc | 11.66 | pass | pass | letter card text |
| `paper` #ffffff | `ink` #292935 | 14.36 | pass | pass | split-flap digits, footer, toasts |
| `paper` #ffffff | `ginger` #fc5e57 | 3.05 | fail | pass | large-only: celebration headline ≥ 24 px |
| `muted` #54545d | `paper` #ffffff | 7.49 | pass | pass | secondary text |
| `muted` #54545d | `cream` #fff8e9 | 7.08 | pass | pass | secondary text on banners |
| `muted` #54545d | `surface` #f6f6f8 | 6.94 | pass | pass | secondary on grey |
| `subtle` #6b7280 | `paper` #ffffff | 4.83 | pass | pass | placeholders, tertiary |
| `ginger-ink` #b3302a | `paper` #ffffff | 6.23 | pass | pass | love-coloured text (e.g. "♡ Favourite") |
| `ginger-ink` #b3302a | `ginger-soft` #ffe1dc | 5.06 | pass | pass | text on letter card accent |
| `success` #17784f | `paper` #ffffff | 5.47 | pass | pass | sync ok text |
| `danger` #d93a32 | `paper` #ffffff | 4.56 | pass | pass | error text |
| `focus` #2299dd | `paper` #ffffff | 3.15 | fail | pass | focus ring (non-text, needs 3:1) |
| `honey` #ffc536 | `paper` #ffffff | 1.58 | fail | fail | non-text: honey pin/fill vs paper (decorative) |
| `line` #e5e7eb | `paper` #ffffff | 1.24 | fail | fail | non-text: dividers (decorative) |

Rules: honey is a fill, never text on paper (1.58:1). Ginger takes ink text, never paper text below 24 px. Teal is decorative only.
