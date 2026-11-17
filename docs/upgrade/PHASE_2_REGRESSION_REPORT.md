# Phase 2 Regression Report

Baseline: approved commit `301e1fc3a08da699dedb0ef6a336659d8bf8ddc6`. Everything below was run against real X1 mainnet where stated; mocked/fixture runs are labelled and kept separate.

## Verified-integration regression (must not regress)
| Check | Result | Kind |
|---|---|---|
| `npm run test:live` (`scripts/live-verify.mjs`) — pool decode, XDEX cross-checks, spot vs XDEX, supply, holders sum = supply, swaps, vault-balance continuity, 24h volume vs XDEX, XDEX history vs on-chain, 6 timeframes | **24/24 pass** | LIVE (real RPC + XDEX) |
| `MODE=live npm run test:e2e` — redesigned Home in Chromium, real RPC relayed: spot within 1% of XDEX, 57 holders, market cap = spot × supply, 20 real BUY/SELL rows, 6 timeframes, volume, crosshair, resize, holders tab, cache | **18/18 pass** | LIVE |
| `npm test` (vitest) incl. real captured pool-state + swap fixtures, parser, candles, RPC retry/failover/abort, holders | **22/22 pass** | mocked/fixtures |
| `npm run test:e2e` (mock RPC): states, error → Retry, empty | **18/18 pass** | MOCKED |
| Responsive/a11y/reduced-motion suite | **7/7 checks pass** (details in RESPONSIVE_TEST_RESULTS.md) | real browser; Base44 aborted/fixtures |
Not modified: `src/lib/xchart/{pool,trades,candles,market,store,rpc,useTrades}.js`, `config.js`. Only additions: `useNetworkStatus.js` (one `getSlot` per 20s, paused when hidden, via the existing RPC client with failover). `base44Client.js` (preview read-only guard) untouched; `VITE_PREVIEW_READ_ONLY` still works.

## Build / static comparison vs baseline
| Check | Baseline `301e1fc` | Phase 2 | Verdict |
|---|---|---|---|
| `npm run build` | pass | pass | — |
| `npm run lint` | pass | pass | no new errors (4 warnings pre-existing) |
| `npm run typecheck` | **61** errors | **61** errors | **0 new**, 0 fixed (identical set; diffed by file+message) |
| `npm audit` | 25 (1 low, 8 mod, 16 high, 0 crit) | 25 (same) | unchanged; new dependency only adds `@axe-core/playwright` (dev) and `@fontsource*` (fonts) |
| Secrets in `dist/` (TELEGRAM, CRON_SECRET, keys) | none | none | — |
Pre-existing issues deliberately **not** touched (per scope): backend security items in INITIAL_AUDIT.md (public `chatHistory`, cron-secret reuse, plaintext session tokens, CORS `*`), 61 typecheck errors, 25 dependency vulnerabilities, history depth (first load 200 signatures), `rpc.x1galaxy.io` unreachable from the sandbox, `xdexProxy` hardening not deployed.

## Newly introduced issues (and their resolution)
All found by the new tests and fixed before commit: toast-viewport stacking over the mobile nav; 1024px nav overflow when signed in; a typing tweak earlier in the project that blanked the app is not repeated. No known newly introduced defects remain open.

## Behaviour preserved
Auth/session logic, wallet modal flow, RP polling (`gameStats`), chat/DM/profile/game/moderation function calls, role gating, routes, game mechanics: **no logic changes** — page edits were restricted to markup/CSS; gate screens (`GateScreen`) only render what the existing conditions already decided. Verified by build + route load + fixture-driven rendering; **real Base44 behaviour was not run** (see limitations).

## Performance (Home, real RPC, Chromium, median of 3, 1440×900)
| Metric | Baseline | Phase 2 |
|---|---|---|
| First Contentful Paint | 180 ms | 296 ms |
| Largest Contentful Paint | 240 ms | 424 ms |
| Cumulative Layout Shift | 0.0098 | **0.0022** |
| Long-task blocking (>50ms) | 0 ms | 5 ms |
| Local transfer (JS+CSS+fonts+html) | 787 KB | 870 KB |
| DOM nodes | 372 | 394 |
| JS bundle (raw / gzip) | 724 / 221 KB | 717 / 221 KB |
| CSS (raw / gzip) | 61 / 10 KB | 112 / 32 KB |
Caveats: the baseline pulled its fonts from Google Fonts, which is blocked in this sandbox (so baseline paint excludes a font round-trip that real users pay, and may be slower for them); the redesign serves self-hosted fonts. Phase 2 is ~115–185 ms slower to first/large paint here because of ~50 KB more CSS and local webfonts; layout stability improved. Rain is capped at ~24 fps and pauses when hidden. No Lighthouse score is claimed.

## Limitations (not verified)
- No authenticated Base44 runtime: Chat, Messages, Profile, Game scoring, ModPanel and Logs were only exercised with synthetic fixtures (layout), never against the real backend. Writes were blocked in the harness.
- `OAuthConsent` is restyled via theme tokens (`AuthLayout`) but is **not routed** (`pages.config.js` is auto-generated and omits it); it could not be loaded in the preview.
- Wallet connection flows (X1/Phantom/Backpack/MetaMask) were not run (no wallet extension); the modal received only the colour/font codemod.
- Docs page copy was kept verbatim; it states "Fixed supply: 404,404 tokens", whereas the on-chain mint supply is **404,402.625473771** (authority revoked). Home shows the on-chain figure. The Docs text should be reviewed by the owner; it was not altered because documentation copy is owner-controlled.
- Vercel preview URL not independently verified (Vercel connector unavailable; no URL provided).
- Real mobile devices not tested (Chromium emulation).
