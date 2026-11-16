# Test Results

Environment: sandbox with npm registry access only. **The real X1 RPC, xdex API, jsDelivr, Base44 and 404x1.xyz were unreachable. Every chart test below uses mocked RPC responses; none verifies live on-chain data.**

| Check | Result | Kind |
|---|---|---|
| Unit tests (`npm test`, vitest 5.1) | **17/17 pass** (14 library + 3 legacy-defect evidence) | mocked fixtures |
| Browser tests (`node tests/e2e/chart.e2e.cjs`, Playwright/Chromium, vite preview) | **15/15 pass** (also 15/15 with `VITE_PREVIEW_READ_ONLY=true`) | mocked RPC; Base44/xdex calls aborted |
| `npm run build` | pass | real |
| `npm run lint` | pass (4 pre-existing warnings in Home.jsx) | real |
| `npm run typecheck` | **fails: 61 errors vs 64 baseline**; none in new files | real |
| `npm audit` | 25 vulns (1 low, 8 moderate, 16 high, 0 critical) vs 26 baseline; all transitive/pre-existing | real |
| Secrets in `dist/` (TELEGRAM, CRON_SECRET, keys, tokens) | none found (grep) | real |

## What the tests cover
Swap parsing (BUY/SELL, decimals, native-XNT pool, failed tx, liquidity add, wrong pool, plain transfer); candle OHLCV, volume, timeframe bucketing, no gap filling; RPC retry on 429, no retry on 4xx, abort, batch→single fallback; incremental sync and cursor; chart render at desktop 1280, tablet 820, mobile 390 with no horizontal overflow; timeframe + volume toggle; crosshair OHLCV; resize; cache contents; error state, Retry recovery, empty state; no uncaught page errors.

## Bug found by testing
Overlay status messages were hidden behind the chart canvas (z-index); fixed. A typing tweak briefly broke Vite's `import.meta.env` replacement and blanked the app; caught by the browser tests and reverted.

## NOT verified
- Real X1 mainnet swaps, real pool vault layout (assumption: vaults are token accounts *owned by* `DY9u…vmq1`, as the legacy pool-price code also assumed), real price/volume vs an explorer.
- Whether the pool/mint addresses in source are the current live ones (runtime validation will surface a mismatch as an error state).
- Live `/chart.html` on Base44 (now removed), Lightweight Charts CDN reachability for end users, CSP.
- Base44 runtime: auth, chat, DMs, moderation, game, rewards, entity rules. Not tested; not reported as passed.
- Vercel deployment, read-only guard against a real backend, mobile device (only Chromium emulation).

## Screenshots (`docs/upgrade/screenshots/`)
`before-chart-desktop.png` (legacy build; chart blank — CDN blocked in sandbox, RPC mocked empty), `after-chart-{desktop,desktop-5m-vol,tablet,mobile,fail,empty}.png` (new chart, mocked data). Home-page/other-page screenshots beyond the chart panel were not captured.
