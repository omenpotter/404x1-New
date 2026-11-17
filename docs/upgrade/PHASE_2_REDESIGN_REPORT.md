# Phase 2 — Ultra-Premium Redesign Report

Branch `claude/404x1-upgrade`, base `301e1fc3a08da699dedb0ef6a336659d8bf8ddc6` (approved Phase 1B). Nothing was merged, published to Base44, or deployed; `main`, production, the database and X1 Space Explorer were not touched. `VITE_PREVIEW_READ_ONLY` guard preserved.

## Design summary
Direction: an underground blockchain trading terminal. A near-black base (`#030504`) with a masked digital grid, a restrained Matrix code-rain canvas, glass panels with hairline green borders, Chakra Petch display type, Space Grotesk body and JetBrains Mono tabular numerals for every financial value. BUY/SELL are green/red pills with row accents; stale/error/loading states are explicit everywhere. Full spec: `DESIGN_SYSTEM.md`.

## What changed, page by page
| Page / surface | Redesign |
|---|---|
| **Layout / navigation** | New 4-0-4 hex brand mark + wordmark; sticky blurred nav with active underline; mobile drawer (Escape closes, focus-safe); skip link; **live X1 status chip** (one `getSlot` / 20 s via the shared RPC client; shows slot only after a real answer, "X1 RPC OFFLINE" otherwise); wallet/account controls and RP polling preserved exactly. |
| **Home** | Cinematic hero ("404 / SYSTEM NOT FOUND", glitch numerals, official copy kept — "404 ERROR is a minimal, experimental meme token on X1 SVM… No Destination. No Direction." — plus the *proposed* tagline "The Underground Has a New Address."); terminal card with the original five "Error 404 —" lines; CA bar (copy + explorer); **live market dashboard** of 7 verified tiles (price in XNT, 24h change, market cap in XNT, mint supply, 24h volume from verified swaps, unique holders, pool liquidity with both reserves) with LIVE / STALE / ERROR chip, skeleton loading and Retry; premium chart panel (segmented 1m–1d control, Vol toggle, OHLCV readout, stale/partial/empty/error overlays); Bridge/Trade/Liquidity cards; transactions feed (BUY/SELL pills, relative + absolute time, truncated maker, explorer links, card layout on phones); holders tab with **real supply-distribution bar** (AMM vault authority / top-10 wallets / rest — computed, no invented classes) and per-holder share bars; RP cards; footer. Pair label corrected to **404 / XNT** (price is XNT per 404). |
| **Chat** | Terminal-style frame, new bubbles/avatars/badges/reactions, modal & search overlays with blur, larger touch targets for actions; all handlers/permissions untouched. |
| **Messages** | Restyled sidebar/conversation list/bubbles/input; new gate screen; logic untouched. |
| **Game** | Surrounding UI (stat cards, controls, overlays) restyled; canvas/mechanics/scoring untouched. |
| **Leaderboard** | Competitive rank rows (top-3 accent, "YOU" highlight), mono numerals; data/ranking untouched. |
| **Profile** | Digital-identity hero, glass cards, tabs, RP bar glow; logic untouched; gate screen. |
| **Docs** | Sticky section nav (now real buttons), **working client-side search** over the existing docs text, mobile chip nav; content verbatim. |
| **ModPanel / ModerationLogs** | New tokens, gate/denied screens, labelled select + focusable table region; permissions untouched. |
| **404 route, restricted-access, OAuth consent shell, spinners, toasts/dialogs** | Themed via `GateScreen`, `PageNotFound`, `UserNotRegisteredError`, `AuthLayout`, shadcn token bridge. |

## Files modified (summary of `git diff 301e1fc`)
New: `src/styles/design-system.css`, `src/styles/home.css`, `src/components/{BrandMark,MatrixRain,GateScreen}.jsx`, `src/lib/xchart/useNetworkStatus.js`, `public/favicon.svg`, `tests/e2e/{responsive,perf,shots,backend-fixtures}.cjs`, `docs/upgrade/*`, screenshots, `docs/upgrade/live/*.json`.
Rewritten: `src/Layout.jsx`, `src/pages/Home.jsx`, `src/lib/PageNotFound.jsx`, `src/components/{AuthLayout,UserNotRegisteredError}.jsx`.
Restyled (colour/font/markup only): `src/pages/{Chat,Messages,Game,Leaderboard,Profile,ModPanel,ModerationLogs,Docs}.jsx`, `src/components/{WalletModal,ProtectedRoute}.jsx`, `src/App.jsx` (spinner), `src/components/chart/PriceChart.jsx` (styling only), `src/main.jsx` (fonts + CSS), `index.html` (local favicon/theme-color; removed dead `manifest.json` link), `tests/e2e/chart.e2e.cjs` (new selectors), `package.json`/lock (fonts, axe).
Untouched data layer: `src/lib/xchart/{pool,trades,candles,market,store,rpc,useTrades}.js`, `base44/**`.

## Screenshots (`docs/upgrade/screenshots/phase2/`)
- `before-<Page>-{desktop,tablet,mobile}.png` — approved baseline (1440 / 768 / 390), logged-out, Base44 calls aborted, real X1 data on Home.
- `after-<Page>-{…}.png` — redesign, same conditions (Home contains live data; **Home screenshots are full-page**).
- `after-signedin-fixtures-<Page>-{…}.png` — redesign with **synthetic test fixtures** to show signed-in layouts (Chat, Messages, Profile, Leaderboard, Game, ModPanel, Logs). Fixture data is fabricated for layout only.
- `after-NotFound-{desktop,mobile}.png`; chart states in `docs/upgrade/screenshots/{live,mock}-*.png` (real vs mocked clearly named).
No "before" screenshots exist for signed-in views (no real backend access).

## Test results — see PHASE_2_REGRESSION_REPORT.md and RESPONSIVE_TEST_RESULTS.md
Live: `test:live` 24/24, live browser 18/18. Unit 22/22, mock browser 18/18, responsive/a11y suite 7/7 (180 page loads, axe 0 violations). Build ✓, lint ✓, typecheck 61 = baseline (0 new), audit 25 = baseline.

## Performance comparison
Cumulative Layout Shift 0.0098 → 0.0022; FCP 180 → 296 ms and LCP 240 → 424 ms (local, median of 3; baseline fonts were unreachable in this sandbox); JS gz 221 → 221 KB; CSS gz 10 → 32 KB; fonts self-hosted. Details and caveats in the regression report.

## Remaining limitations
1. No real Base44 runtime or wallet testing (auth, chat send, DMs, profile actions, game scoring, moderation are rendered with fixtures only).
2. `OAuthConsent` is not routed by the auto-generated `pages.config.js`; restyled via theme tokens only and unreachable in the preview.
3. Docs copy says "Fixed supply: 404,404"; on-chain supply is 404,402.625473771. Owner decision needed; not changed.
4. Carried over, unchanged and documented earlier: backend security findings, 61 typecheck errors, 25 dependency vulnerabilities, 200-signature history depth / no pagination, `rpc.x1galaxy.io` fallback unverified from the sandbox, `xdexProxy` changes undeployed.
5. Visual QA by eye covered 1440 and 390 only; the other seven widths are covered by automated overflow/off-screen/a11y checks.
6. "Live network status" is RPC reachability + slot, not chain health/TPS.
7. Vercel preview: not independently verified (no URL / connector). The push should trigger the existing `404x1-preview` build.

## Rollback
Everything is on `claude/404x1-upgrade`. To return to the approved Phase 1B state: `git revert <phase-2 commit>` (single commit) or `git checkout 301e1fc3a08da699dedb0ef6a336659d8bf8ddc6 -- .` on the branch, push, and Vercel redeploys the preview. The preview project can be pointed at `301e1fc` directly from the Vercel dashboard (Deployments → older deployment → Promote on the preview project). Production (`main`, Base44) was never changed, so no production rollback is needed.

## Readiness assessment
Ready for the owner's visual review on the Vercel preview. Not ready for production merge: needs (a) owner visual approval, (b) authenticated Base44 runtime verification of every signed-in flow and the wallet modal, (c) the supply-figure decision in Docs, (d) the backlog of backend/security items from earlier phases.
