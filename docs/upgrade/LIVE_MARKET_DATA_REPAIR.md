# Phase 1B — Live Market Data Repair

Date: 2026-11-17. Base: `01755a4` (Phase 1). Network access to X1 RPC and XDEX was enabled for this phase; all LIVE results below are real, read-only calls. Mocked regression results are reported separately.

## Confirmed root cause (reproduced against the real network)
Phase 1 assumed `DY9uWCwi…vmq1` **owns** the pool's token vaults, and identified swaps by `owner === pool`. On chain that is false:

| Item | Verified value |
|---|---|
| `DY9u…vmq1` | AMM **pool state account**, 637 bytes, owned by AMM program `sEsYH97wqmfnkzHedjNcw3zyJdPvUmsa9AixhS4b4fN` |
| Vault authority (owner of all vaults) | `9Dpjw2pB5kXJr6ZTHiqzEMfJPic3om9jgNacnwpLCoaU` — a PDA **shared by every pool** of this AMM |
| 404 vault (token1) | `6G9EKKX3kF6UUyUtBbo731NGQnr88h9JD4zWzi1tf8DL` — Token-2022 (`TokenzQd…`), 9 decimals |
| WXNT vault (token0) | `5t5EsuS5kuofpT68j9qHfLuwZRpECJPk1zqRGHeJp922` — legacy SPL token program, native-mint (wrapped) account, 9 decimals |
| LP mint | `69VYWwidxk9J7HxbtSfMbNVroAeT32Uy8cX52hmJtt1h` |
| AMM config | `2eFPWosizV6nSAGeSvi5tRgXLoqhjnSesra23ALA248c` |
| 404 mint | Token-2022, 9 decimals, mint authority **null**, supply **404,402.625473771** (extensions: metadata only, no transfer fee) |

`getTokenAccountsByOwner(DY9u…)` therefore returns nothing, so: pool validation failed ("holds no 404 vault"), the swap parser matched nothing, and the legacy pool-price fallback returned 0.

Other failures that produced the reported symptoms (all verified live):
1. **Price/Market cap "Loading…"** — the legacy price path called XDEX only through the `xdexProxy` Base44 function, which requires a logged-in session token (anonymous visitors get 401). It also parsed the response wrongly: `/api/token-price/prices` returns an **array** of `{token_address, price (USD)…}`, but the code looked for `prices[TOKEN_CA]` / `x.address` / `x.mint`; and `/token-price/price` needs `token_address=`, not `address=`. XDEX itself sends **no CORS header**, so the browser cannot call it directly. All fallbacks failed, hence permanent "Loading".
2. **Holders "66"** — legacy code counted token accounts from a legacy-program-only filter (`dataSize:165`) plus unfiltered Token-2022 accounts, not unique wallets; 404 is a Token-2022 mint with 155 token accounts / 58 wallets with a balance.
3. **Market cap** used a hard-coded supply of 404,404; the real mint supply is 404,402.625473771.
4. **Transactions "Loading"** — followed from the failed pool validation.

Before-screenshot of exactly this state on the real network: `docs/upgrade/screenshots/before-live-home-phase1a.png` (stats `Loading… | 66 | Loading…`, chart error "Pool validation failed: configured pool holds no 404 vault").

## What was changed
- `src/lib/xchart/pool.js` (new): decodes the pool state account (layout verified byte-for-byte against live data), checks mints, token programs' vaults via `getMultipleAccounts`, decimals, equal authority; computes **net reserves = vault balance − accrued protocol/fund fees** and spot price (XNT per 404). Fails with a precise error otherwise; validation is **not** bypassed.
- `trades.js`: swaps are identified by the pool's **vault addresses** (not by owner), from both vault deltas; liquidity (same-direction) and failed txs rejected; multi-hop routes work. BUY = 404 left the pool.
- `market.js` (new): supply from the mint; holders as **unique owner wallets** (Token-2022 + legacy via `getProgramAccounts` with a 40-byte data slice), AMM pool authority separated out.
- `useTrades.js`: one shared hook (pool → supply → holders → swaps), each part failing independently; Home price, market cap, holders, holder list, feed and 24h change all derive from it. 24h change shows only when a swap ≥24 h old exists.
- `rpc.js`: ordered failover (`rpc.mainnet.x1.xyz` → `rpc.x1galaxy.io`).
- `Home.jsx`: removed the XDEX-proxy price chain and legacy RPC helpers; no layout/theme change.
- `scripts/live-verify.mjs`: reusable read-only live verification.

## XDEX endpoints (verified live 2026-11-17)
| Endpoint | Status / schema |
|---|---|
| `GET /api/xendex/pool/list?network=X1%20Mainnet&limit&skip` | 200; `{success,total,total_info,data[]}`; `total=134` listed pools (the 404/XNT pool is one) |
| `GET /api/xendex/pool/{address}?network=…` | 200; pool record incl. `pool_info.{token0Vault,token1Vault,lpMint,ammConfig,mint0Decimals,mint1Decimals}`, `token1/2_volume_24h`, `txns_24h`, `tvl` |
| `GET /api/xendex/pool/tokens/{t1}/{t2}?network=…` | 200; single pool object (not an array) |
| `GET /api/xendex/pool/status` | 200; global counters only, ignores `pool_address` |
| `GET /api/xendex/chart/history` | 200 with `from_token,to_token,time_from,time_to,network[,resolution (minutes)]` → `{bars:[{o,h,l,c,v,t}]}`. `from_token=404,to_token=WXNT` gives price in **XNT per 404**. Bars are **flat carry-forward** when no trade (13/39 hourly bars), and **`v` is the pool reserve of the from-token, not trade volume** — so it is not used for volume |
| `GET /api/xendex/chart/price` | **404 Cannot GET** — does not exist |
| `GET /api/token-price/price` | needs `token_address` (not `address`) |
| `GET /api/token-price/prices?token_addresses=a,b` | 200; `data` is an **array**; `price` is **USD**; also `xnt_usd_price`, `selected_pool`, `quote_is_xnt`, `candidates[]` |
| `POST/GET /api/xdex/swap/multi-hop/quote` | 400 "Missing required fields: token_in, token_out" (exists; not needed for market data; not exercised) |
Browser CORS: X1 RPC sends `access-control-allow-origin: *`; XDEX does **not** — so the app reads the chain directly and XDEX is used as an independent cross-check (live script) rather than a browser dependency.

## Other pools discovered
XDEX `candidates` for the 404 mint: `DY9u…` (404/XNT, depth ≈ $93.8, selected), `CGVNFTV…` (404/USDC.X, ≈ $11.3 depth), `7Jd2uqD…` (404/XNT, dust, ≈ $0.0001). The configured pool is the dominant 404/XNT pool; the chart intentionally tracks only it. The USDC.X pool is a possible later addition.

## Reused / reference material
- X1 Space Explorer (`omenpotter/X1Space-Explorer-new`, read-only clone): XDEX endpoint field names and `token-price/price?token_address=` usage (`base44/shared/xdex.ts`), supply×price market-cap method (`base44/shared/tokens.ts`), `rpcClient.js` multi-endpoint failover design and `X1_CONFIG` RPC list. Its Deno/TypeScript backend modules were not copied (404X1 has to run in-browser without a session); the failover/endpoint list were re-implemented in a few lines.
- `C:\Users\Riyaz\ARKBS-X1-Tools`: **not accessible** — it lives on the owner's Windows machine and no computer was attached to this session. Nothing from it was used or claimed.

## Remaining
- `rpc.x1galaxy.io` (fallback) was unreachable from this sandbox (connection reset); the failover path is covered by a mocked test only.
- Preview URL not re-verified from here (Vercel connector unavailable); the push to the branch should trigger the owner's existing preview build.
- History depth: first load = 200 signatures (~1.5 days). Longer ranges (1d candles over weeks) would need paging/XDEX history via a Base44 function; XDEX history is price-only and carry-forward-filled.
- Price is the **pool spot** (net of fees) in the header; swap rows show **execution price** incl. the pool fee (~0.3–0.4% difference observed).
