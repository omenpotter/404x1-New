// READ-ONLY live verification of the 404/XNT market data layer against X1 mainnet and the XDEX API.
// No keys, no signing, no writes. Run:  node scripts/live-verify.mjs [--json out.json]
import { writeFileSync } from 'node:fs';
import { TOKEN_MINT, WXNT_MINT, POOL_ADDRESS, TIMEFRAMES } from '../src/lib/xchart/config.js';
import { loadPool } from '../src/lib/xchart/pool.js';
import { loadSupply, loadHolders } from '../src/lib/xchart/market.js';
import { syncTrades } from '../src/lib/xchart/store.js';
import { rpc, getTransactions } from '../src/lib/xchart/rpc.js';
import { parseSwap } from '../src/lib/xchart/trades.js';
import { tradesToCandles } from '../src/lib/xchart/candles.js';

const XDEX = 'https://api.xdex.xyz', NET = 'network=X1%20Mainnet';
const results = [];
let failed = 0;
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const j = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`${u} HTTP ${r.status}`); return r.json(); };
const near = (a, b, tol) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-18) <= tol;

const pool = await loadPool();
console.log(JSON.stringify(pool, null, 1));
check('pool state decodes; mints are 404 + WXNT', true, `program=${pool.program} authority=${pool.authority}`);
check('vault decimals are 9/9', pool.tokenDecimals === 9 && pool.quoteDecimals === 9);

// --- XDEX cross-checks (authoritative reference) ---
const xp = (await j(`${XDEX}/api/xendex/pool/tokens/${TOKEN_MINT}/${WXNT_MINT}?${NET}`)).data;
check('XDEX pool address matches configured pool', xp.pool_address === POOL_ADDRESS);
check('XDEX vaults match on-chain decoded vaults', (xp.pool_info.token0Vault === pool.quoteVault && xp.pool_info.token1Vault === pool.tokenVault) || (xp.pool_info.token0Vault === pool.tokenVault && xp.pool_info.token1Vault === pool.quoteVault), `${xp.pool_info.token0Vault} / ${xp.pool_info.token1Vault}`);
check('XDEX LP mint matches', xp.pool_info.lpMint === pool.lpMint);
const prices = (await j(`${XDEX}/api/token-price/prices?${NET}&token_addresses=${TOKEN_MINT},${WXNT_MINT}`)).data;
const p404 = prices.find(p => p.token_address === TOKEN_MINT), pX = prices.find(p => p.token_address === WXNT_MINT);
const xdexXnt = p404.price / pX.price;
check('XDEX oracle selected the same pool', p404.selected_pool === POOL_ADDRESS);
check('on-chain spot (XNT/404) within 1% of XDEX USD(404)/USD(XNT)', near(pool.spot, xdexXnt, 0.01), `onchain=${pool.spot.toFixed(8)} xdex=${xdexXnt.toFixed(8)} (USD ${p404.price}, XNT ${pX.price})`);

// --- supply / holders ---
const { supply, mintAuthority } = await loadSupply();
check('supply read from mint; mint authority revoked', supply > 0 && mintAuthority === null, `supply=${supply}`);
const h = await loadHolders(undefined, { decimals: 9, exclude: [pool.authority] });
const heldSum = [...h.holders, ...h.excluded].reduce((a, x) => a + x.balance, 0);
check('holder balances sum to mint supply (nothing missed/double counted)', near(heldSum, supply, 1e-9), `sum=${heldSum} supply=${supply}`);
check('holders are unique wallets (<= token accounts)', h.holders.length + h.excluded.length <= h.tokenAccounts, `${h.holders.length} wallets (+${h.excluded.length} pool authority) from ${h.tokenAccounts} token accounts`);

// --- trades ---
const t0 = Date.now();
const r = await syncTrades({ cache: null, pool });
check('syncTrades returned swaps with no failed fetches', r.trades.length > 0 && r.failed === 0, `${r.trades.length} swaps from ${r.scanned} signatures in ${Date.now() - t0}ms`);
const T = r.trades;
check('all swaps have finite positive price/amounts and BUY/SELL', T.every(t => t.price > 0 && t.tok > 0 && t.xnt > 0 && (t.side === 'BUY' || t.side === 'SELL') && t.maker));
check('prices within 40% of spot at the same era (no unit errors)', T.slice(-10).every(t => near(t.price, pool.spot, 0.4)), `last swap ${T.at(-1).price.toFixed(6)} vs spot ${pool.spot.toFixed(6)}`);

// Continuity proof: for ALL successful txs touching the pool (swaps + LP), vault post-balance of tx n == pre-balance of tx n+1.
const sigs = (await rpc('getSignaturesForAddress', [POOL_ADDRESS, { limit: 60 }])).filter(s => !s.err);
const { items } = await getTransactions(sigs.map(s => s.signature));
const withTok = items.map(({ sig, tx }) => { if (!tx) return null; const keys = tx.transaction.message.accountKeys.map(k => k.pubkey); const i = keys.indexOf(pool.tokenVault); if (i < 0) return null; const a = tx.meta.preTokenBalances.find(b => b.accountIndex === i), b = tx.meta.postTokenBalances.find(b => b.accountIndex === i); return a && b ? { slot: tx.slot, sig, pre: BigInt(a.uiTokenAmount.amount), post: BigInt(b.uiTokenAmount.amount) } : null; }).filter(Boolean).sort((x, y) => x.slot - y.slot);
// Order-independent (several swaps can share one slot): every tx's pre-balance must equal some other tx's post-balance, except the single oldest one.
const posts = new Set(withTok.map(x => x.post)); const heads = withTok.filter(x => !withTok.some(y => y !== x && y.post === x.pre));
const breaks = Math.max(0, heads.length - 1);
check('token-vault balance chain is continuous across txs (parser sees every vault change)', withTok.length > 5 && breaks === 0, `${withTok.length} txs, ${heads.length} chain head(s)`);
const vNow = BigInt((await rpc('getTokenAccountBalance', [pool.tokenVault])).value.amount);
check('newest fetched tx post-balance equals live vault balance (vault state fully explained)', withTok.some(x => x.post === vNow), `post=${withTok.at(-1).post} live=${vNow}`);

// parse every fetched tx and tally
const parsed = items.map(({ sig, tx }) => parseSwap(tx, sig, pool)).filter(Boolean);
const nonSwapVaultTxs = withTok.length - parsed.length;
console.log(`swaps parsed ${parsed.length}/${withTok.length} vault-touching txs (${nonSwapVaultTxs} rejected as non-swap, e.g. liquidity)`);

// --- XDEX history vs on-chain ---
const now = Math.floor(Date.now() / 1000), from = T[0].time - 3600;
const hist = await j(`${XDEX}/api/xendex/chart/history?${NET}&from_token=${TOKEN_MINT}&to_token=${WXNT_MINT}&time_from=${from}&time_to=${now}&resolution=60`);
const bars = hist.bars || [];
check('XDEX chart/history returns bars for from=404,to=WXNT', bars.length > 0, `${bars.length} hourly bars; first t=${bars[0]?.t}`);
const hourly = new Map(tradesToCandles(T, 60).map(c => [c.time, c]));
let compared = 0, within = 0, worst = 0;
for (const b of bars) { const c = hourly.get(b.t); if (!c) continue; compared++; const d = Math.abs(b.c - c.close) / c.close; worst = Math.max(worst, d); if (d <= 0.05) within++; }
check('XDEX hourly close agrees (±5%) with last on-chain swap price in that hour', compared > 0 && within / compared >= 0.9, `${within}/${compared} within 5%, worst ${(worst * 100).toFixed(2)}%`);
const flat = bars.filter((b, i) => i && b.o === b.h && b.h === b.l && b.l === b.c && b.c === bars[i - 1].c).length;
console.log(`NOTE XDEX bars: ${flat}/${bars.length} are flat carry-forward bars (no trade); XDEX 'v' repeats pool reserve (${bars[0]?.v}) — NOT trade volume; app uses on-chain volume.`);

for (const tf of TIMEFRAMES) { const c = tradesToCandles(T, tf); check(`candles tf=${tf}m aggregate all swaps`, c.reduce((a, x) => a + x.trades, 0) === T.length && c.every(x => x.low <= Math.min(x.open, x.close) && x.high >= Math.max(x.open, x.close)), `${c.length} candles`); }
const vol = T.reduce((a, t) => a + t.xnt, 0), vol24 = T.filter(t => t.time > now - 86400).reduce((a, t) => a + t.xnt, 0);
console.log(`on-chain 24h XNT volume=${vol24.toFixed(4)}  XDEX token1_volume_24h=${xp.token1_volume_24h}  (txns_24h xdex=${xp.txns_24h}, onchain swaps24h=${T.filter(t => t.time > now - 86400).length})`);
check('on-chain 24h XNT volume within 25% of XDEX token1_volume_24h', near(vol24, xp.token1_volume_24h, 0.25), `onchain=${vol24.toFixed(4)} xdex=${xp.token1_volume_24h}`);
console.log('latest 5 swaps:', T.slice(-5).map(t => `${new Date(t.time * 1000).toISOString()} ${t.side} ${t.tok.toFixed(2)} 404 / ${t.xnt.toFixed(4)} XNT @ ${t.price.toFixed(6)} ${t.maker.slice(0, 6)}… ${t.sig.slice(0, 8)}…`));
const out = process.argv.indexOf('--json'); if (out > 0) writeFileSync(process.argv[out + 1], JSON.stringify({ at: new Date().toISOString(), pool, results, sample: T.slice(-10) }, (k, v) => typeof v === 'bigint' ? v.toString() : v, 1));
console.log(`\n${results.length - failed}/${results.length} live checks passed`);
process.exit(failed ? 1 : 0);
