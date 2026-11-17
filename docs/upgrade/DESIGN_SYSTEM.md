# 404X1 Design System — "Underground terminal"

Source of truth: `src/styles/design-system.css` (tokens, base, primitives, page refinements), `src/styles/home.css` (Home namespace `.hm-*`). Fonts are bundled from npm (`@fontsource*`); **no external font/CDN requests**.

## Color tokens (refined from the brief)
| Token | Value | Use |
|---|---|---|
| `--bg-0 / -1 / -2 / -3` | `#030504 / #080d0a / #0d1510 / #13201a` | page / secondary / elevated / raised |
| `--green` | `#00ff88` | primary neon, BUY, focus, active |
| `--matrix` | `#00ff41` | rain glyphs, solid-button hover |
| `--green-2` | `#00c96b` | gradients, secondary green |
| `--text` / `--text-dim` / `--text-faint` | `#e8fff1 / #82998b / #74897c` | primary / secondary / tertiary text |
| `--red` | `#ff4560` | SELL, errors, destructive, mod links |
| `--amber` `--cyan` `--purple` | `#ffb020 #4fe3ff #a974ff` | warnings/stale, addresses & info, AMM/roles |
| `--border` `--border-strong` | `#1d2b22 #2a4034` | hairlines |
Refinements: tertiary text was lightened to `#74897c` (≈4.8:1 on `--bg-1`) so even faint labels meet AA; legacy greys (`#444/#666`, ~1.6–3:1) were mapped up. Axe (wcag2a/2aa/21aa) reports **0 violations** on all pages (see PHASE_2_REGRESSION_REPORT.md). Legacy aliases (`--dark…`) are retained so older CSS keeps working. shadcn/ui tokens (`--background`, `--primary`, …) are bridged to the palette so every Radix/shadcn component (toasts, dialogs, OAuth consent) is themed automatically.

## Typography
- Display: **Chakra Petch** 500/600/700 (`--font-display`) — headings, nav, buttons, tabs.
- Body: **Space Grotesk Variable** (`--font-body`) — readable UI and prose.
- Mono: **JetBrains Mono Variable** (`--font-mono`) — addresses, timestamps, labels, terminal. `.num` / `.mono` enable tabular, slashed-zero numerals; all financial values use them.
- Scale: h1 `clamp(28px,5vw,48px)`, h2 `clamp(18px,2.4vw,22px)` uppercase tracked, body 14–15px, labels 10.5–12px mono with 0.12–0.2em tracking.

## Effects (all procedural, no images/video)
- **Matrix rain** (`MatrixRain.jsx`): one `<canvas>`, ~24 fps cap, DPR ≤ 1.5, half the columns on phones, paused when the tab is hidden, hidden + single frame under `prefers-reduced-motion`. Layer opacity 0.3.
- Atmosphere: radial vignette, masked 56px grid, subtle scanlines (`.ds-atmos`), fixed behind content.
- Glass: `.ds-glass` (blur 14px, gradient fill, 1px green-tinted border) used on panels only (not on list rows) to bound GPU cost; `.ds-card` is the flat variant.
- Glow: restrained — hero numerals, active tab underline, focus rings, primary buttons on hover.
- Motion: `ds-rise` entrance, `ds-pulse` live dots, `ds-blink` caret, skeleton shimmer, glitch on the 404 numerals (±3px, 3% duty cycle). Everything stops under reduced motion.

## Components
`.ds-nav` (sticky, blur, active underline), `.ds-drawer` (mobile menu, Escape closes, focus-safe), `.ds-net` (live X1 status), `.ds-btn` (+ `solid`, `ghost`, `danger`), `.ds-chip` (`ok`/`warn`/`bad`), `.ds-eyebrow`, `.ds-skeleton`, `.ds-spinner`, `GateScreen` (login/denied), `BrandMark` (SVG 4-0-4 in a hex), Home metric tiles / segmented timeframe control / BUY-SELL pills / distribution bar.

## Layout & responsive rules
Content width 1180px (1320 ≥ 1800px); gutter `clamp(14px,3.2vw,32px)`; nav height `--nav-h: 60px` (pages use `calc(100vh - var(--nav-h))`). Burger/drawer navigation ≤ 1120px; net-label hidden 1121–1320px. Tables collapse to cards ≤ 720px (Home feed); wide moderation tables scroll inside a focusable region. Coarse pointers get ≥ 40px hit areas on icon buttons.

## Page-refinement technique
Existing pages keep their own `<style>` blocks (logic/markup untouched). Their colours/fonts were codemodded to tokens, and `design-system.css` adds `#root …` overrides (id specificity beats class selectors; no `!important`).

## Chart styling
`PriceChart.jsx` only restyles: transparent background, mono axis font, dashed green crosshair, BUY `#00ff88` / SELL `#ff4560` candles, 32% alpha volume bars, right offset 4. Data path (pool parser, aggregation) is unchanged.
