# 404 Coin Graph — Root Cause

Base commit: `f00d17cefa1fec84fe0d10599981bc28128b7680` (main).

## Verification limits (read first)
The sandbox's egress proxy blocks `rpc.mainnet.x1.xyz`, `api.xdex.xyz`, `cdn.jsdelivr.net` and `404x1.xyz` (HTTP CONNECT 403). **I could not observe the live site or the real X1 RPC.** Everything below is established by (a) reading the source, (b) executing the legacy parser on realistic fixtures, and (c) running the legacy app in a browser with the network mocked. Any claim about live production behaviour is marked *unverified*.

## Confirmed defects (with evidence)
1. **Wrong data source / wrong parser (reproduced).** `parseTrade` (legacy `Home.jsx` 72-110) keeps only the *last* matching token-balance entry per mint across *all* accounts in the tx, so the trader's wSOL account can overwrite the pool vault delta. On a fixture BUY (trader pays 1 XNT for 10 404) the legacy parser returns `side: 'SELL'`. Its native-balance fallback takes the largest lamport change of *any* account, so a plain 404 transfer (fee-only lamport change) is recorded as a "trade". Evidence: `tests/legacy-evidence.test.js` runs a verbatim copy (`tests/legacy/parseTradeLegacy.js`) against the new parser. Mis-signed and non-swap rows corrupt price, direction, candles and the transaction feed.
2. **Queried the mint, not the pool.** `getSignaturesForAddress(TOKEN_CA, limit 1000)` returns every transaction touching the mint (transfers, account creation, holder churn), not just swaps. Reaching real swaps then requires up to 1000 `getTransaction` calls (50 batches of 20) at page load and every 60 s after the 5-min cache expires — an easy way to hit RPC rate limits.
3. **Silent failure.** Rejected batches are `continue`d, RPC errors only `console.warn`; the "Loading chart data…" overlay sits *under* the iframe and is never replaced. Users get an empty chart with no message or retry.
4. **CDN single point of failure (reproduced under the sandbox block).** `public/chart.html` injects `cdn.jsdelivr.net/.../lightweight-charts@4.1.3` at runtime. With the CDN unreachable the legacy page throws an uncaught `Chart library failed to load` and renders nothing (screenshot `before-chart-desktop.png`; console log recorded). Whether jsDelivr is reachable for real users on 404x1.xyz is *unverified*.
5. **Real data deleted.** Median ±3x "outlier" filter (and a `> 0.000001` candle filter) silently dropped genuine trades; volume/price were also float-`uiAmount` based.
6. **Messaging.** `postMessage(..., '*')` both ways with no `source`/`origin` check; a single `pendingTradesRef` slot so `setTF`/`setVol` sent before `chartReady` were lost.
7. **Duplicated chart code.** ~135 lines of the same chart lived both as the unused `CHART_IFRAME_SRC` template in `Home.jsx` and in `public/chart.html`.
8. **Cache.** `chart_trades_cache_v2` merged forever (unbounded localStorage growth, never revalidated).

Not proven: that defect 1 or 2 alone is what blanks the *live* chart today. The most probable live causes are 2/3 (RPC limits → silent empty chart) and 4; they are fixed together by the redesign.

## Fix summary
- Chart is a React component using the **bundled** `lightweight-charts@4.2.3` (no CDN, no iframe, no postMessage). `public/chart.html` removed.
- Swaps are read from the **pool** (`DY9u…vmq1`): signatures of the pool address, parsed from the pool's own vault deltas (404 vs wXNT/native XNT, raw integer amounts + decimals). Failed txs, liquidity moves (same-direction deltas) and transfers are rejected. Side is from the pool's perspective.
- Pool identity validated at runtime (pool must hold the 404 mint and an XNT quote side) before any data is trusted.
- First load: 100 signatures; afterwards only signatures newer than a cursor (paged back, cursor advances only on full success). Batch size 10, 3 concurrent, timeouts, exponential backoff + jitter, AbortController, single-call fallback if batching is rejected, refresh paused when tab hidden.
- No filtering, no synthetic candles; empty periods stay empty. Loading / empty / stale / partial / error states with Retry.
- Cache versioned and bounded (2000 trades).
