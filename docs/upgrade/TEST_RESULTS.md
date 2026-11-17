# Test Results (updated Phase 1B, 2026-11-17)

## A. LIVE tests — real X1 mainnet + real XDEX API, read-only (no keys, no signing, no writes)
**A1. `npm run test:live` (`scripts/live-verify.mjs`): 24/24 pass.** Raw output: `docs/upgrade/live/live-verify.json`. Highlights:
- Pool state decoded on chain; XDEX independently reports the **same pool, same two vaults, same LP mint**, and its price oracle selects this pool.
- On-chain spot **0.00455018 XNT/404** = XDEX USD(404)/USD(XNT) **0.00455018** (identical to 8 d.p.).
- Supply 404,402.625473771, mint authority revoked. Sum of all holder balances **equals** supply exactly; **57 unique wallets** (+1 AMM authority) from 155 token accounts.
- 70 swaps parsed from the last 200 signatures; none failed to fetch.
- Token-vault balance chain is continuous across the 20 vault-touching txs (every vault change is explained; no missed or phantom swaps) and the newest tx's post-balance equals the live vault balance.
- 24h volume: **20.8420 XNT on-chain vs 20.842042537 XDEX; 38 swaps vs XDEX `txns_24h` 38**.
- XDEX hourly close within 5% of on-chain last-swap price for 25/25 overlapping hours (worst 0.40%).
- All six timeframes (1m,5m,15m,1h,4h,1d) aggregate every swap, OHLC bounds consistent.
- Latest real swap: 2026-11-17 04:51:19Z SELL 59.32 404 / 0.2693 XNT @ 0.004540, maker `6cPH…mHwQ`, sig `4y4Vefk7…`.

**A2. `MODE=live npm run test:e2e` (real Chromium, built app, X1 RPC requests forwarded unmodified to mainnet): 18/18 pass** at 1280/820/390 px: price 0.004550 XNT (within 1% of XDEX), holders 57, market cap 1.84K XNT (= spot × supply), 20 real transactions with BUY/SELL, maker and time; chart with all six timeframes, volume toggle, crosshair, resize; holders tab 50 rows; no horizontal overflow; no uncaught page errors. Note: the browser→RPC hop is relayed through Node because the sandbox proxy cannot be used by Chromium; payloads are the real RPC responses.
**Reproduction of the reported bug on the real network** (Phase 1 build `01755a4`): stats `Loading… | 66 | Loading…`, chart "Pool validation failed: configured pool holds no 404 vault".

## B. MOCKED regression tests (fixtures; prove logic only, NOT chain state)
- `npm test` (vitest 5.1): **22/22 pass**, including parsing of two **real captured on-chain fixtures** (pool state account and a real swap tx) plus synthetic BUY/SELL, liquidity, failed tx, shared-authority/other-pool rejection, unique-holder aggregation, candles/timeframes, RPC retry/backoff/abort/failover, incremental sync, legacy-parser defect evidence.
- `npm run test:e2e` (mock RPC): **18/18 pass** (desktop/tablet/mobile, timeframes, volume, hover, resize, cache, error + Retry, empty state).

## C. Build / static
| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run lint` | pass (4 pre-existing warnings) |
| `npm run typecheck` | fails: **61** errors vs 64 on `main`; none in new files |
| `npm audit` | 25 vulns (1 low, 8 moderate, 16 high, 0 critical) vs 26 on `main` |
| Secrets in `dist/` | none found |

## Not verified
- `rpc.x1galaxy.io` (unreachable from sandbox) — failover covered by mock only.
- Vercel preview deployment itself, and Base44 runtime (auth, chat, DMs, game, etc.).
- `C:\Users\Riyaz\ARKBS-X1-Tools` (not accessible from this session).
- Touch devices (Chromium viewport emulation only).

## Screenshots (`docs/upgrade/screenshots/`)
Before (real network, Phase 1 build): `before-live-home-phase1a.png`. After (real network): `live-home-{desktop,tablet,mobile}.png`, `live-chart-{desktop,tablet,mobile,desktop-vol}.png`. Mock states: `mock-chart-{fail,empty}.png`, `mock-*`.
