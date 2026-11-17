# QA Regression, Responsive and Live Verification

Date of run: 2026-11-17. Branch: `claude/404x1-upgrade`. No production configuration, secret or workflow was modified.

## 1. Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Type safety | `npx tsc --noEmit -p ./jsconfig.json` | **0 errors** |
| Unit tests | `npx vitest run` | **34/34 passing, 4 files** |
| Production build | `npx vite build` | **exit 0** |
| Live mainnet verification | `node scripts/live-verify.mjs` | **24/24 checks passed** |

Unit test files: `rain.test.js`, `xchart.test.js`, `legacy-evidence.test.js`, and the new `session.test.js` (6 assertions covering token hashing determinism and collision properties).

Build output: `index` 570 KB + `react` vendor 180 KB (previously one 753 KB chunk).

## 2. Backend authorisation regression

Every probe below was sent with **no credential**. Expected and actual behaviour match in all eight cases.

| Function | Expected | Actual |
| --- | --- | --- |
| `chatSend` | 401 | **401 Unauthorized** |
| `spendRp` | 401 | **401 Unauthorized** |
| `gameStart` | 401 | **401 Unauthorized** |
| `gameStats` | 401 | **401 Unauthorized** |
| `playerSearch` | 401 | **401 Unauthorized** |
| `xdexProxy` | 401 before upstream call | **401 Unauthorized** |
| `chatHistory` (public feed) | 200 with messages | **200**, full message payload including reactions and reply metadata |
| `logout` (idempotent) | 200 | **200** `{ success: true }` |

`convertRp` could not be exercised: the platform refuses to run the function while the `LAUNCH_DATE` secret is unset (blocker B2). No authentication logic in it was changed by this work.

## 3. Live blockchain verification (X1 mainnet)

Executed read-only against X1 mainnet and the XDEX API. Evidence persisted to `docs/upgrade/live/live-verify.json`. All 24 checks passed, including:

- Pool state decodes; mints are 404/WXNT; vault decimals 9/9.
- XDEX pool address, vaults and LP mint match the configured pool.
- XDEX oracle selected the same pool; on-chain spot within 1% of XDEX-implied price.
- Supply read from the mint, mint authority revoked; holder balances sum to supply with no double counting.
- 20/20 swaps parsed; prices within 40% of spot (no unit errors).
- **Vault balance chain continuous across all 20 vault-touching transactions** — one chain head, meaning the parser accounts for every vault movement.
- Newest fetched post-balance equals the live vault balance (`113413388718388`), so vault state is fully explained rather than partially sampled.
- Candles aggregate correctly at 1m/5m/15m/60m/240m/1440m (53/44/41/26/11/3).
- On-chain 24h volume matches XDEX within tolerance: 12.9859 XNT vs 12.985882556 reported.

One documented discrepancy, unchanged by this work: XDEX bars carry the pool reserve in their `v` field, not trade volume, and 20 of 47 hourly bars are flat carry-forward bars. The app reads volume from on-chain swaps, which is why its figures match the chain rather than the API.

## 4. Responsive verification

Full browser-based breakpoint matrix could not be re-run: the installed Playwright core has no Chromium binary in this environment. Verification was therefore a source-level audit plus a targeted fix.

**Fix applied — Leaderboard (`src/pages/Leaderboard.jsx`).** A five-column table with unbounded usernames had no overflow container, so long names pushed the page wider than the viewport on phones. The table now sits in a horizontal scroll container with a 520px minimum width (columns stay readable, the page never widens), and a `max-width: 560px` block reduces the title to 20px/2px tracking and tightens cell padding. Desktop rendering at the preview width (1556px) is visually unchanged because the table already fits inside its 900px column.

**Audited clean:** global layout uses a shared `--nav-h` token, one nav with a drawer below the desktop breakpoint, and `overflow-x: hidden` on `body` only as a last-resort guard rather than a layout strategy. No fixed pixel widths above 900px outside the Leaderboard table.

Earlier full-matrix results remain valid for the pages they covered and are recorded in `RESPONSIVE_TEST_RESULTS.md` with the raw run in `docs/upgrade/live/responsive-results.json`.

## 5. What this run did not cover

- **Wallet login and score submission happy paths.** Both require a real signed wallet message and a server-issued play token; neither can be fabricated from a test harness without a funded key. Their negative paths (missing credential, banned account, consumed play token) are covered by the code-level review in the phase 3 report.
- **Automated workflow execution.** All four workflows are inactive and cannot be edited on a branch; see `09_WORKFLOW_AUTH_MIGRATION.md`.
- **Native app builds.** No iOS/Android build was produced here.
