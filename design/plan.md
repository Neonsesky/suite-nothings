# Suite Nothings: design plan

The visual target the feature agents build to. Tokens are in `src/styles/tokens.css`, measured
values and sources in `design/tokens.md`, copy in `design/copy.md`, and the clickable reference in
`design/prototype/`. When this plan and the prototype disagree, the prototype wins, because it
was re-shot and critiqued against the Dayuse captures.

## 1. Principles

1. **Dayuse's discipline everywhere, boldness in one place.** Stays, Add, Detail, Us and Settings
   are as calm as dayuse.ae: white paper, near-black ink, one honey accent per view, photo-led
   cards, generous white space. The map and the journey are where we spend big motion and colour.
2. **Honey works, ginger loves.** Honey (`--color-honey`) is the functional flavour: primary
   buttons, the active tab indicator, the search button, stay pins, selected chips, calm
   highlight surfaces (`--color-honey-soft`, `--color-cream`). Ginger (`--color-ginger`) is kept
   for love and celebration only: hearts, favourites, the journey line, milestones, the pillow
   note and letters, the save celebration. If a screen has no love in it, it has no ginger.
   Honey is never text on white; text on honey is always ink.
3. **Time is the motif.** Every stay shows a timestamp chip (`14:00 → 18:00`). Loaders are
   sweeping clock hands. The home counter, map chapter titles and journey dates are split-flap
   boards in `--font-mono`.
4. **Ink outlines and framed panels.** Illustration, stamps, pins and photo panels use a 2 px
   ink outline (`--color-ink`) with a rounded corner. A stay's photos sit in a patchwork of
   framed panels. Chrome (buttons, cards, inputs) does *not* get ink outlines: it stays in
   Dayuse's soft-shadow language, so the outline reads as "our story" and never as UI noise.
5. **Photo first.** Cards and heroes lead with the image. Until real photos exist, StayArt
   gradients stand in: warm, daylight, never grey.
6. **Thumb zone.** Primary actions sit at the bottom on mobile: tab bar, sheet footers, the
   floating "+". Minimum target 44 px.

## 2. Type

One family, Manrope (variable, self-hosted), the same free family dayuse.ae loads. Dayuse's
body face is a commercial grotesk (Maison Neue); Manrope is their own fallback and the closest
free match, so we use it for everything. JetBrains Mono (variable) is for timestamps, the
split-flap boards and codes.

| Token | rem / px | Weight | Use (Dayuse source) |
|---|---|---|---|
| `--text-2xs` | 0.6875 / 11 | 700, caps +0.04em | badge text, chart ticks (discount badge) |
| `--text-xs` | 0.75 / 12 | 500 | captions, timestamp chip, tab bar labels (card area line) |
| `--text-sm` | 0.875 / 14 | 500 | secondary text, chips, buttons S (card meta, footer links) |
| `--text-md` | 1 / 16 | 500 | body, inputs, buttons (body, search input) |
| `--text-lg` | 1.125 / 18 | 700 | card title desktop, sheet titles (card hotel name) |
| `--text-xl` | 1.25 / 20 | 700 | section heading mobile |
| `--text-2xl` | 1.5 / 24 | 800 | section heading desktop, page titles mobile (h2) |
| `--text-3xl` | 2 / 32 | 800 | hero headline mobile, big stats (h1 mobile) |
| `--text-4xl` | 3 / 48 | 800 | hero headline desktop, split-flap counter |

Leading: `--leading-tight` 1.2 for headings, `--leading-normal` 1.5 for body. Headings use
-0.01em tracking at 24 px and above. Numbers in stats and prices use `font-variant-numeric:
tabular-nums`.

## 3. Grid and rhythm

- 4 px base grid, spacing tokens `--space-1` (4 px) to `--space-16` (64 px).
- Mobile gutter 16 px (`--gutter`), desktop gutter 24 px, content max 1280 px
  (`--content-max`, Dayuse's container), centred.
- Section rhythm: 40 px between home sections on mobile, 64 px on desktop. Section heading →
  content 16 px.
- Cards: horizontal scroll rails on mobile (card width 78 vw, max 300 px, 12 px gap, scroll-snap,
  first card aligned to the gutter). Desktop: 4-column grid with 24 px gap.
- Header 64 px desktop, 56 px mobile (`--header-h`); tab bar 64 px + safe area (`--tabbar-h`).

## 4. Card anatomy (1:1 with the Dayuse hotel card)

```
Dayuse card                              Suite Nothings card
┌──────────────────────────┐             ┌──────────────────────────┐
│[-30%]              ♡     │ photo 4:3   │[Visit 3]           ♡     │  StayArt/photo 4:3, radius md
│                          │ radius      │                          │  badge: top-left pill
│         photo            │             │        our photo         │  heart: top-right, 36 px disc
│                          │             │                          │
└──────────────────────────┘             └──────────────────────────┘
 Golden Tulip Al Barsha    ★ 8.2         Golden Tulip Al Barsha   ★ 4.5   name 16/700, rating 14/700
 Al Barsha, Dubai                        Al Barsha, Dubai                 area 14/500 muted
 AED 189  ~~AED 450~~                    19 Jun 2026   [14:00→18:00]      date where price sits (16/800)
 11:00 – 16:00                                                            timestamp chip where struck price sits
```

- **Container:** no border, no shadow at rest (Dayuse cards are flat on white); the photo carries
  the radius. Hover (desktop): photo scales 1.03 inside its frame, 250 ms.
- **Photo:** aspect 4:3, `--radius-md`, `object-fit: cover`.
- **Badge** (where the discount sits): top-left, 8 px inset, pill, `--text-2xs` 800 caps, ink
  text on honey for "Visit n" / "First" / "Our regular"; paper text on ginger for "♡ n"
  (favourite count), so ginger stays love-only.
- **Heart** (Dayuse's wishlist heart): top-right, white disc 32 px, `IconHeart` 18 px; filled
  ginger when a favourite.
- **Text block:** 8 px under the photo. Line 1: hotel name (1 line, ellipsis) + stars/rating
  right-aligned. Line 2: area, city in muted. Line 3: visit date in the price slot
  (`--text-md` 800) + the timestamp chip in the struck-price slot (`--font-mono` 12,
  `--color-muted`, 1 px line border, `--radius-xs`).
- "Waiting for Shady's rating" replaces the rating with a 12 px muted italic-free note.

## 5. Components

- **Buttons.** Primary: honey fill, ink text, 700, height 48 (mobile) / 44 (desktop),
  `--radius-sm`, no border. Secondary: paper fill, 1 px ink border. Ghost: underline text link
  (Dayuse's "See hourly hotels" link). Press: `scale(0.97)` on pointer-down.
- **Search bar.** Paper, `--radius-pill` on mobile, `--radius-md` bar on desktop, `--shadow-card`,
  64 px tall on desktop with the honey round search button at the right; 52 px on mobile with the
  search icon at the left.
- **Tabs (city tabs).** Text tabs 14/600 muted; active is ink with a 3 px honey underline
  (rounded). Scroll horizontally on mobile.
- **Chips.** 36 px, pill, 1 px `--color-line`, 14/600; selected: honey-soft fill, ink border.
- **Sheets.** Paper, top radius `--radius-xl`, grabber 36×4 `--color-line`, `--shadow-sheet`,
  sticky footer with the primary action.
- **Timestamp chip.** `--font-mono` 12/500, `14:00 → 18:00`, muted ink, 1 px line border,
  radius xs, padding 2×6.
- **Stats row** (Dayuse trust badges): icon in a 40 px cream circle + number 20/800 + label
  12/500 muted, in a row that scrolls on mobile and spreads to 5 columns on desktop.
- **FAQ accordion.** 1 px line dividers, question 16/700, chevron rotates 90° → 270°, answer
  15/500 muted, 250 ms height transition (instant with reduced motion).
- **Footer.** Ink background (Dayuse's dark footer), paper text, muted links, the mark in
  mono variant.

## 6. Motion tone

Quiet and quick, like the site: 150–250 ms colour and opacity changes, `--ease-standard`. Springs
from SPEC §14 for position and size. Big motion only at the signature moments: the intro key tag,
the save celebration, map chapter changes, the journey, the letter and milestone unlocks. No
fade-up on scroll. Reduced motion: no transforms, only opacity crossfades ≤ 150 ms, and the
split-flap shows the final value instantly.

## 7. Wireframes

Legend: `[Button]`, `(chip)`, `▢` photo, `═` split-flap, `▔` sheet top, `⌕` search, `♡` heart,
`⊕` add. Mobile is 390 wide; desktop is 1440 wide with a 1280 container.

### 7.1 Onboarding

```
MOBILE: intro (≤2.5 s, skippable)       who's checking in              connect
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│                  [Skip]  │   │  [key-tag mark]          │   │ ‹                        │
│                          │   │  Who's checking in?      │   │ Connect our diary        │
│        ○─(619)           │   │                          │   │ Try it with demo stays,  │
│      key tag swings      │   │ ┌──────────┐┌──────────┐ │   │ or link our Sheet.       │
│   card taps lock → ●     │   │ │   N      ││   S      │ │   │ ┌──────────────────────┐ │
│   light green, door      │   │ │  Nirsh   ││  Shady   │ │   │ │ [Try demo]  (honey)  │ │
│   opens into the app     │   │ └──────────┘└──────────┘ │   │ └──────────────────────┘ │
│                          │   │                          │   │ ─── or connect ───       │
│                          │   │                          │   │ API URL  [__________]    │
│                          │   │  step dots ● ○ ○ ○       │   │ Passphrase [________]    │
└──────────────────────────┘   └──────────────────────────┘   │ [Test connection]        │
                                                              └──────────────────────────┘
home base                      install (iOS sheet)
┌──────────────────────────┐   ┌──────────────────────────┐
│ ‹                        │   │ Put us on your home      │
│ Home is Dubai?           │   │ screen                   │
│ ┌──────────────────────┐ │   │ 1  Tap Share  [⇧]        │
│ │  mini map, house pin │ │   │ 2  Add to Home Screen ⊕  │
│ └──────────────────────┘ │   │ 3  Open Our Suites       │
│ Dubai, UAE     [Change]  │   │  ┌ illustrated phone ┐   │
│                          │   │  └───────────────────┘   │
│ [Yes, that's home]       │   │ [Done]      Not now      │
└──────────────────────────┘   └──────────────────────────┘
DESKTOP: the same steps in a 480 px centred card on cream, mark above, step dots below.
```

### 7.2 Stays home (Dayuse homepage anatomy, in order)

```
MOBILE 390                                   DESKTOP 1440
┌──────────────────────────┐                 ┌────────────────────────────────────────────────┐
│ [mark] Suite Nothings  ⚙ │ header 56       │ [mark] Suite Nothings       Map  Journey  Us  [+ Add a stay]│ header 64
├──────────────────────────┤                 ├────────────────────────────────────────────────┤
│▢▢▢▢▢ hero photo ▢▢▢▢▢▢▢▢│ latest stay     │▢▢▢▢▢▢▢▢▢▢▢▢ full-bleed hero, 520 tall ▢▢▢▢▢▢▢▢▢│
│ Stay 12, and still       │ headline 32/800 │   Stay 12, and still checking in.   48/800   │
│ checking in.             │ paper on scrim  │   ┌──────────────────────────────────────┬──┐ │
│ ┌──────────────────────┐ │                 │   │ ⌕ Find a stay we've had              │⌕ │ │
│ │⌕ Find a stay we've had│ │ pill search     │   └──────────────────────────────────────┴──┘ │
│ └──────────────────────┘ │                 │   ◎ We're at a hotel right now               │
│ ◎ We're at a hotel now   │                 │                                               │
├──────────────────────────┤                 ├────────────────────────────────────────────────┤
│ ═27═ hotels together     │ split-flap      │  ═ 2 7 ═  hotels together                     │
│ (🏨 27)(🗝 31)(⏱ 112h)… ▸│ stats rail      │  🏨 27 hotels  🗝 31 visits  ⏱ 112 h  🏙 6  🌍 3 │ 5 cols
├──────────────────────────┤                 ├────────────────────────────────────────────────┤
│ Our stays                │ h2 20/800       │  Our stays                                    │
│ Dubai Sharjah AbuDhabi A…│ city tabs       │  Dubai  Sharjah  Abu Dhabi  Abroad            │
│ ┌────────┐┌────────┐┌──  │ card rail       │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │ 4-col grid
│ │▢ card  ││▢ card  ││    │ 78vw            │  │▢card │ │▢card │ │▢card │ │▢card │          │
│ └────────┘└────────┘└──  │                 │  └──────┘ └──────┘ └──────┘ └──────┘          │
│ See all our Dubai stays →│ ghost link      │  See all our Dubai stays →                    │
├──────────────────────────┤                 ├────────────────────────────────────────────────┤
│ Our story in three stays │                 │  Our story in three stays                     │
│ ① First  ▢ 19 Jun 2026   │ numbered steps  │  ① First ▢      ② Latest ▢      ③ Favourite ▢ │ 3 cols
│ ② Latest ▢ 28 Sep 2026   │ (Dayuse "book   │                                               │
│ ③ Favourite ▢ ♡          │ in 3 steps")    │                                               │
├──────────────────────────┤                 ├────────────────────────────────────────────────┤
│ ┌ cream banner ────────┐ │ install banner  │  ┌ cream banner: phone art | Put us on your home screen [Install] ┐│
│ │[mark] Put us on your │ │ hidden once     │  └──────────────────────────────────────────────┘│
│ │home screen [Install] │ │ installed       │                                               │
│ └──────────────────────┘ │                 │                                               │
├──────────────────────────┤                 ├────────────────────────────────────────────────┤
│ On this day              │ Instagram slot  │  On this day  ▢▢ | 3 months together, 12 in   │
│ ▢▢ 19 Sep · 3 months     │                 │                                               │
├──────────────────────────┤                 ├────────────────────────────────────────────────┤
│ Next check-ins           │ newsletter slot │  Next check-ins            [Surprise me]      │
│ ┆dashed card┆┆dashed┆  ▸ │                 │  ┆dashed┆ ┆dashed┆ ┆dashed┆                  │
│ [Surprise me]            │                 │                                               │
├──────────────────────────┤                 ├────────────────────────────────────────────────┤
│ Frequently asked by us   │ FAQ accordion   │  Frequently asked by us        (2-col on desktop)
│ Where was our first…  ⌄  │                 │  Q ⌄                 Q ⌄                      │
│ Which hotel do we…    ⌄  │                 │  Q ⌄                 Q ⌄                      │
├──────────────────────────┤                 ├────────────────────────────────────────────────┤
│ JUMEIRAH · ROVE · HILTON…│ marquee (text)  │  JUMEIRAH · ROVE · HILTON · MARRIOTT · …      │
├──────────────────────────┤                 ├────────────────────────────────────────────────┤
│█ ink footer █████████████│                 │█ [mark] Made by Nirsh for Shady · 103 d 4 h 12 min together █│
│█ Made by Nirsh for Shady │                 │█ Stays Map Journey Us Settings About      █████████████████│
│█ 103 d 4 h 12 min        │                 └────────────────────────────────────────────────┘
├──────────────────────────┤
│ Stays  Map  (⊕)  Journey Us│ tab bar 64 + safe area, ⊕ is a 56 honey disc raised 12 px
└──────────────────────────┘
```

### 7.3 Add a stay (bottom sheet, 5 steps + celebration)

```
1 HOTEL                         2 WHEN                          3 WHAT WE DID
┌─▔▔▔▔ grabber ────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│ Add a stay        1/5  ✕ │   │ ‹ When was it?     2/5 ✕ │   │ ‹ What did we do?  3/5 ✕ │
│ ━━━━○○○○ progress        │   │ ━━━━━━━━○○○              │   │ ━━━━━━━━━━━━○○           │
│ ┌──────────────────────┐ │   │ Date  [📅 30 Sep 2026 ]  │   │ (Day use)(Overnight)     │
│ │⌕ Which hotel?        │ │   │ Check-in  [14:00]        │   │ (Pool day)(Spa)(Brunch)  │
│ └──────────────────────┘ │   │ Check-out [18:00]        │   │ (Date night)(Staycation) │
│ ◎ We're here now         │   │ ┌ 14:00 → 18:00 · 4 h ┐ │   │ (Birthday)(Anniversary)  │
│ Stayed here before       │   │ Nights  [-] 0 [+]        │   │                          │
│ ▢ Rove Downtown  Visit 3 │   │                          │   │                          │
│ ▢ Atlantis The Palm      │   │                          │   │                          │
│ Search results…          │   │                          │   │                          │
├──────────────────────────┤   ├──────────────────────────┤   ├──────────────────────────┤
│              [Next]      │   │ Skip         [Next]      │   │ Skip         [Next]      │
└──────────────────────────┘   └──────────────────────────┘   └──────────────────────────┘
4 PHOTOS                        5 THE GOOD PART                 SAVE CELEBRATION
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│ ‹ Photos           4/5 ✕ │   │ ‹ The good part    5/5 ✕ │   │                          │
│ ┌────┐┌────┐┌────┐       │   │ Note  [______________]   │   │   ▭═key card slides═▶ ▣  │
│ │ ▢  ││ ▢  ││ +  │       │   │ Best moment [________]   │   │        lock light ● green│
│ └────┘└────┘└────┘       │   │ Mood  ◎ ◎ ◎ ◎ stamps ▸   │   │     ═ 2 8 ═ flips up     │
│ ┌ These photos say ────┐ │   │ My rating ★★★★☆          │   │   mini map: pin drops    │
│ │ 28 Sep at JBR. Use?  │ │   │ Who picked it (Nirsh)(S) │   │  Checked in. Stay 28 is  │
│ └ [Use that] [No]──────┘ │   │                          │   │  ours.                   │
├──────────────────────────┤   ├──────────────────────────┤   │  [View stay] [Done]      │
│ Skip         [Next]      │   │         [Save our stay]  │   └──────────────────────────┘
└──────────────────────────┘   └──────────────────────────┘
DESKTOP: the sheet becomes a 560 px right-side panel over a dimmed page (still a sheet: slides,
Esc closes); steps identical. Draft autosaves; reopening offers "Pick up where we left off".
```

### 7.4 Stay detail

```
MOBILE                                       DESKTOP
┌──────────────────────────┐                 ┌────────────────────────────────────────────────┐
│ ‹                  ♡  ⇧  │ over photo      │ header                                        │
│▢▢▢▢ header photo ▢▢▢▢▢▢▢│ shared element  │ ‹ Our stays                                   │
│▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢▢│                 │ ┌──────────────┬──────┬──────┐  Dayuse       │
├──────────────────────────┤                 │ │▢ big panel   │▢     │▢     │  gallery      │
│ Rove Downtown     ★★★    │ h1 24/800       │ │              ├──────┼──────┤  patchwork    │
│ Downtown, Dubai          │                 │ │              │▢     │▢ +4  │               │
│ (Visit 3)(Date night)    │                 │ └──────────────┴──────┴──────┘               │
│ 28 Sep 2026 [14:00→18:00]│                 │ Rove Downtown ★★★         ┌ sticky card ───┐│
├──────────────────────────┤                 │ Downtown, Dubai           │28 Sep 2026     ││
│ ┌────┬──┐ photo panels   │ ink-outlined    │ (Visit 3)(Date night)     │[14:00→18:00]   ││
│ │ ▢  │▢ │ patchwork      │ varied sizes    │ Our notes …               │★ Nirsh 4 ★ S 5 ││
│ ├──┬─┴──┤                │                 │ Our visits here (timeline)│[Google Maps]   ││
│ │▢ │ ▢  │                │                 │ Hotel info …              │[Apple] [Waze]  ││
│ └──┴────┘                │                 │ On the map ▢▢▢            │[Edit] [Delete] ││
│ Our notes                │                 │                           └────────────────┘│
│ "…" — Nirsh              │                 └────────────────────────────────────────────────┘
│ Ratings  N ★★★★  S ★★★★★ │
│ Our visits here          │ mini timeline
│ ●─19 Jun ●─2 Aug ●─28 Sep│
│ Hotel info  (skeleton→)  │ description, stars, ¤¤, address, site, phone, amenities
│ On the map ▢ 3D mini map │
│ [Google Maps][Apple][Waze]│
│ [Edit]         Delete    │
└──────────────────────────┘
```

### 7.5 Map (hero)

```
MOBILE: chapter HUD                          pin card sheet                list view
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│ ┌═D═U═B═A═I═┐ 9 stays ◎  │   │ ═DUBAI═   9 stays        │   │ ═DUBAI═  [Map ◫]         │
│ └───────────┘            │   │                          │   │ (City)(Country)(World)   │
│ (City)(Country)(World) ◫ │   │      ▼ honey pin (sel.)  │   │ Downtown                 │
│                      🧭  │   │                          │   │ ▢ Rove Downtown  28 Sep ›│
│   3D buildings, pins     │   │ ┌─▔▔▔▔───────────────────┐│   │ ▢ Address Sky View 2 Aug›│
│     ▼   ▼▼  ▼            │   │ │▢ Rove Downtown  Visit 3││   │ Marina                   │
│  ▼        ⌂ home         │   │ │ Downtown · 28 Sep 2026 ││   │ ▢ Address Marina  3 Jul ›│
│                   ◎ locate│  │ │ [14:00→18:00] [Open stay]│  │ …                        │
│ © OpenFreeMap © OSM      │   │ └────────────────────────┘│   │                          │
├──────────────────────────┤   ├──────────────────────────┤   ├──────────────────────────┤
│ tab bar                  │   │ tab bar                  │   │ tab bar                  │
└──────────────────────────┘   └──────────────────────────┘   └──────────────────────────┘
DESKTOP: full-bleed map under the header; HUD top-left (split-flap + count + chips), controls
top-right (layers/lighting, compass, locate, list), pin card as a 360 px floating card
bottom-left; list view is a 400 px left panel that pushes the map.
Chapter titles: DUBAI → UNITED ARAB EMIRATES → THE WORLD.
```

### 7.6 Journey

```
MOBILE                                       DESKTOP
┌──────────────────────────┐                 ┌────────────────────────────────────────────────┐
│ ✕     ═1═9═ ═J═U═N═ 2026 │ date board      │ ✕            ═ 1 9  J U N  2 0 2 6 ═        🔊 │
│                      🔊  │                 │                                                │
│    globe / city camera   │                 │        map, ginger route with ink casing      │
│   ~~ginger route~~✈      │                 │                ~~~~~~~✈                        │
│ ┌ postcard ────────────┐ │ pops at stop    │   ┌ postcard 320 ┐                            │
│ │▢ Atlantis The Palm   │ │                 │   │▢ …           │                            │
│ │ 3 Jul 2026 · Stay 4/12│ │                 │   └──────────────┘                            │
│ │ "The pool at night"  │ │                 │                                                │
│ └──────────────────────┘ │                 │ ⏮ ▶ ⏭  ├──┼──┼──●──┼──┤ Jun Jul Aug Sep  1×  (All time ▾)│
│ ├─┼──●─┼──┤ Jun … Sep    │ scrubber+ticks  └────────────────────────────────────────────────┘
│ ⏮   ▶   ⏭    1×  (All ▾) │ controls in thumb zone
└──────────────────────────┘
Finale: pull back to globe, stats roll in (12 hotels · 6 cities · 3 countries · 7,420 km),
wishlist pins pulse, "To be continued…".
```

### 7.7 Us, Letters and the pillow note

```
US (mobile)                     LETTERS                        PILLOW NOTE (Shady, first open)
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│ Us                    ⚙  │   │ ‹ Letters                │   │   dimmed app             │
│ ┌ 103 d 4 h 12 min ────┐ │   │ ┌ ginger-soft card ────┐ │   │ ┌──────────────────────┐ │
│ │ together since 19 Jun│ │   │ │ ✉ A note on your     │ │   │ │  Turndown service    │ │
│ │ 2026, 23:46          │ │   │ │ pillow · Read 21 Sep │ │   │ │   ▭ pillow card      │ │
│ └──────────────────────┘ │   │ └──────────────────────┘ │   │ │   ◆ chocolate        │ │
│ Stats  (grid 2×3)        │   │ ┌ locked ─ dashed ─────┐ │   │ │   Tap to open        │ │
│ 27 hotels   31 visits    │   │ │ 🔒 Unlocks at 25     │ │   │ └──────────────────────┘ │
│ 112 h       6 cities     │   │ │ hotels               │ │   │ tap → lifts, flips 3D,   │
│ Whose picks rate higher  │   │ └──────────────────────┘ │   │ lines reveal one by one, │
│ Nirsh 4.3 ▮▮▮▮ Shady 4.6 │   │                          │   │ signature + "Written in  │
│ Milestone stamps  ◎◎◎○○  │   │                          │   │ Dubai, September 2026"   │
│ Letters ›                │   │                          │   │                          │
│ Next check-ins ›         │   │                          │   │                          │
│ Settings ›               │   │                          │   │                          │
└──────────────────────────┘   └──────────────────────────┘   └──────────────────────────┘
DESKTOP Us: counter hero across the top, stats 5-col, stamps grid 6-col, letters + wishlist
side by side.
```

### 7.8 Settings, Join, states

```
SETTINGS                        JOIN (invite link)              EMPTY (zero stays)
┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
│ ‹ Settings               │   │  [mark]                  │   │ header                   │
│ WHO AM I   (Nirsh)(Shady)│   │  Nirsh invited you to    │   │   ○─(619) ink drawing    │
│ HOME BASE  Dubai  Change›│   │  our diary               │   │   of an empty key hook   │
│ CONNECTION               │   │  Joining as Shady        │   │ Our first check-in is    │
│  URL ••••  Passphrase •• │   │  [Join as Shady]         │   │ waiting                  │
│  [Test connection] ✓ ok  │   │  Not Shady? Switch       │   │ [Add our first stay]     │
│  Invite QR ▣ Scan to join│   │                          │   │                          │
│ MAP LIGHTING (Auto)(Day)…│   └──────────────────────────┘   └──────────────────────────┘
│ UNITS (km)(mi)           │   OFFLINE banner: slim ink bar under header, "Offline. Stays save
│ MOTION  Reduce ◯         │   on this phone and sync later."   ERROR: inline card with icon,
│ SOUND   On ●             │   what happened + what to do + [Try again]. BOUNDARY: full screen,
│ DATA [Export][Import]    │   "This screen tripped over its suitcase…" + [Reload].
│ Clear demo data          │   LOADING: skeleton cards (cream blocks, shimmer off with reduced
│ About · attributions     │   motion) and the clock-hand loader for waits > 400 ms.
└──────────────────────────┘
```

## 8. Critique, pass 1 → revisions

See §9 (written after comparing with the captures).
