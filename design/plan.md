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

## 4. Card anatomy (1:1 with the Dayuse hotel card), revised in pass 2

```
Dayuse card (results list / home rail)       Suite Nothings card
┌──────────────────────────┐                 ┌──────────────────────────┐
│(Pool access included) (♡)│ photo, r12      │(First stay)          (♡) │ StayArt/photo 4:3, radius md
│                          │ white pill tl   │                          │ white pill top-left
│          photo           │ heart tr        │         our photo        │ heart in white 32 disc, top-right
└──────────────────────────┘                 └──────────────────────────┘
 Raviz Center Point Hotel   20/700            Rove Downtown             name 18/700 (20 on desktop list)
 ★★★★ Al Mankhool           13/500            ★★★ Downtown, Dubai       stars + area 13/500 muted
 ◌ 4.4/5 | 53 Reviews                         ◌ 4.5 · Nirsh 4 · Shady 5 rating row
                 AED 130    32/800                         28 Sep 2026  date where the price sits (20/800)
         [-79%] ~~AED 600~~ ink pill + struck         [Visit 3] 4 h     ink pill where the discount sits
 (9am - 6pm) (11am - 7pm)   outlined pills   (14:00 → 18:00)            timestamp pill where the time slots sit
```

- **Container:** paper, `--radius-md` (12 px), `--shadow-card` (Dayuse's one soft centred
  shadow), content padding 16 px. Home rail cards are photo-on-top; the Map list and search
  results use Dayuse's horizontal list card (photo left 45%, text right) on desktop.
- **Photo:** aspect 4:3 in rails, `object-fit: cover`, top corners follow the card radius.
  Desktop hover: photo scales 1.03 inside its frame, 250 ms.
- **Feature pill** (Dayuse "Pool access included"): top-left, 12 px inset, paper pill,
  13/600 ink: "First stay", "Our regular", "Latest".
- **Heart:** top-right, 32 px paper disc, `IconHeart` 18 px ink outline; filled ginger when a
  favourite (the only ginger on the card).
- **Ink pill** (Dayuse discount badge "-79%"): `--color-ink` bg, paper text, 12/800, radius 6,
  padding 6×8: "Visit 3", "♡ 5". Beside it, where the struck price sits, the stay length in
  `--color-struck`-free muted text ("4 h", "2 nights"), never struck through.
- **Date** (Dayuse price): 20/800 in rails, 32/800 on the desktop list card, tabular numerals.
- **Timestamp pill** (Dayuse time-slot buttons): outlined pill, 1 px `--color-line-strong`,
  36–40 px tall, `--font-mono` 13/500 ink, `14:00 → 18:00`.
- "Waiting for Shady's rating" replaces the partner rating with a 13/500 muted note.

## 5. Components (revised in pass 2 to match measured styles)

- **Buttons.** All pills. Primary: honey fill (subtle vertical honey → honey-deep gradient, as on
  Dayuse's "See hotels"/"Open"), ink text 700, 52 px tall mobile / 42–44 px desktop, padding
  0 28 / 12 20. Secondary: paper, 1 px `--color-line` border, ink text. Ghost: underlined
  text link (Dayuse's "See the day hotels around me"). Press: `scale(0.97)` on pointer-down.
- **Search bar.** Paper pill, 58 px tall on desktop with a 1 px `--color-line-input` border;
  fields start with a 36 px ink disc holding a paper glyph (pin, calendar, search); the honey
  pill button sits inside the bar at the right. Mobile: 56 px pill, ink search disc at the
  left, placeholder 16/500.
- **City tabs.** Pills 54 px tall (44 on mobile), padding 0 20; active = ink fill + paper text,
  inactive = paper + 1 px line border + ink text. Horizontal scroll on mobile.
- **Chips / filters.** Outlined pills 40 px tall with a trailing chevron (Dayuse filter row);
  selected = honey-soft fill + ink border.
- **Stats panel** (Dayuse trust panel). `--color-surface` panel, `--radius-xl`, full container
  width; per stat a 48 px icon filled with a honey → ginger gradient, value 20/700 ink, label
  14/500 muted; 5 centred columns on desktop, stacked rows (icon left) on mobile.
- **Sheets.** Paper, top radius `--radius-xl`, grabber 36×4 `--color-line-strong`,
  `--shadow-sheet`, sticky footer holding the primary pill.
- **FAQ accordion.** 1 px line dividers, padding 24 px (mobile) / 32 px (desktop), question
  16–18/700, chevron rotates, answer 15/500 muted.
- **Header.** Over the home hero it's transparent with paper text; elsewhere paper with a 1 px
  bottom line; 80 px desktop, 56 px mobile; desktop nav links 14/600 with 12×20 padding.
- **Footer.** Ink background, `--color-footer-text` text, the mark in mono paper.
- **Map controls.** 48 px paper circles with `--shadow-card`, stacked at the right (zoom,
  locate, compass, layers), the same as the Dayuse results map.

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
│ [mark] Suite Nothings  ⚙ │ header 56, clear│ [mark] Suite Nothings       Map  Journey  Us  [+ Add a stay]│ header 64
├──────────────────────────┤                 ├────────────────────────────────────────────────┤
│▢ ┌────────────────────┐▢│ search on top   │▢▢▢▢▢▢▢▢▢▢▢▢ full-bleed hero, 520 tall ▢▢▢▢▢▢▢▢▢│
│▢ │(⌕) Find a stay we've│▢│ 56 pill, ink    │   Stay 12, and still checking in.   48/800   │
│▢ └────────────────────┘▢│ disc            │   ┌──────────────────────────────────────┬──┐ │
│▢ We're at a hotel now ▢▢│ underlined link │   │ ⌕ Find a stay we've had              │⌕ │ │
│▢▢▢ latest stay photo ▢▢▢│                 │   └──────────────────────────────────────┴──┘ │
│ Stay 12, and still       │ headline 32/800 │   ◎ We're at a hotel right now               │
│ checking in.             │ bottom-left     │                                               │
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

Pass 1 was written from the brief and the CSS alone. Setting it against the captures
(`design/references/home-*`, `dubai-*`, `hotel-*`) and `computed.json` turned up these problems:

| # | What was off in pass 1 | Evidence | Revision |
|---|---|---|---|
| 1 | Buttons at `--radius-sm` (8 px) | Every Dayuse action is a pill: "See hotels", "Open", "Read more", filters and time slots | All buttons, chips, tabs and search bars are pills (§5) |
| 2 | City tabs as text with a honey underline | Computed: the active tab is an ink-filled pill with white text, inactive tabs are outlined pills, 54 px tall | Ink-filled active pill (§5); honey stays for primary actions only |
| 3 | Card with no container, badge honey | Result cards are white, radius 12, with a soft shadow; the discount badge is an **ink** pill; the photo carries a **white** feature pill; time slots are outlined pills | Card rebuilt 1:1 (§4): feature pill, ink pill, timestamp pill |
| 4 | Search bar with a small shadow, radius md on desktop | Paper pill with a 1 px #EAEAEB border and no heavy shadow; icons sit in ink discs; honey pill button inside the bar | Search bar spec rewritten (§5) |
| 5 | Header: paper, 64 px desktop | 80 px; transparent with white logo and links over the home hero | 80 px desktop; transparent over our hero (§5) |
| 6 | Trust badges as a plain icon row | A light-grey rounded panel (radius ≈ 24) with honey → coral gradient icons and two-line labels | Stats panel (§5); the gradient icons are the one place honey meets ginger outside love moments, as on Dayuse |
| 7 | Text ink pure black (#000) | Computed body, heading and footer colour is #292935 | `--color-ink` #292935 everywhere, including the mark |
| 8 | Hero headline centred at every size | Mobile puts search at the top of the hero and the headline bottom-left over the photo; desktop centres both | Mobile hero: search on top, headline bottom-left (§7.2) |
| 9 | Ginger used for the favourite badge fill with white text | White on #FC5E57 is 3.05:1 (fails AA for small text) | Favourite count uses the ink pill; ginger only fills hearts and illustrations; `--color-ginger-ink` for coloured text |
| 10 | Desktop footer copied the mobile layout | Dayuse's footer is a dark multi-column block (473 px at 1440) | Desktop footer: 3 columns (mark + counter, app links, About) on ink |

Things kept on purpose: our map pins stay honey key tags (Dayuse uses purple price pills,
which would read as prices); the bottom tab bar on mobile (their site uses a hamburger, but
their app uses a tab bar); and ink outlines only on story elements, never on chrome.

The prototype went through two more critique loops after this; see §9.

## 9. Prototype critique loops (Checkpoint 1)

Composites (Dayuse left, ours right) are in `design/references/cp1/` (gitignored); our side is
in `design/checkpoints/cp1/proto/`.

- **Loop 1** (prototype agent, mid-build, from the captures): buttons, search and tabs became
  pills; the header is transparent over the hero; city tabs are ink-filled when active; the
  stats sit in a grey radius-xl panel with honey → ginger icons; cards got the two-badge system
  (white feature pill, ink visit pill) plus the outlined timestamp pill; map controls are 48 px
  white circles. Also fixed: a scrim that blocked the sheet, and pointer-events leaks on the map.
- **Loop 2** (home 1440 against Dayuse): the hero was 520 px tall with a 48 px headline, where
  Dayuse has 700 px and 64 px. Now 700 px, 64/800, -0.02em. Still open, and the React build
  should fix these: (a) the hero search pill renders about 330 px wide, but Dayuse's is about
  550 px, so the pill should fill `.hero-search-wrap` (34rem); (b) Dayuse orders the hero as
  headline → search → trust line → link, but ours puts the link and trust line above the
  search, so move them below; (c) the FAQ chevron should use `IconChevron`; (d) Waldorf Astoria
  RAK should get its own city tab ("Ras Al Khaimah") or go under "Abroad/Other".
