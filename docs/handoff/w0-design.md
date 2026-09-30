# w0-design handoff

- `src/components/icons/index.tsx` replaces the foundation's version wholesale. It exports all the required names plus extras and an `icons` map. It only uses `import type` from React.
- The brand components use `useId` (React 18+). Pin colours in `pins.ts` are literal hex values, so keep them in sync with tokens.css.
- Shell: wire in the manifest icons, the apple-touch icon and the 12 splash `<link>` tags from `design/icons.md`. Set `theme_color` to #FFFFFF and `background_color` to #FFF8E9.
- Import `src/styles/fonts.css` before `tokens.css`. The fonts live in `public/fonts/`.
- Feature agents: the visual target is `design/prototype/` together with plan §4, §5 and §9 (open fixes are listed there). Use the copy in `design/copy.md` verbatim.
- Re-run the design tools with `cd design/tools && npm install`, then `node export-icons.mjs`, `node render-brand.mjs` and `node contrast.mjs`.
