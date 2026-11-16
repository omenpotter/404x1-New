import { POOL_ADDRESS, TOKEN_MINT, WXNT_MINT, TOKEN_PROGRAMS, FIRST_LOAD_SIGNATURES, INCREMENTAL_SIGNATURES, MAX_CACHED_TRADES, CACHE_KEY } from './config.js';
import { rpc, getTransactions } from './rpc.js';
import { parseSwap, mergeTrades } from './trades.js';

export function loadCache(storage = globalThis.localStorage) {
  try {
    const c = JSON.parse(storage.getItem(CACHE_KEY) || 'null');
    if (c?.v === 3 && c.pool === POOL_ADDRESS && c.token === TOKEN_MINT && Array.isArray(c.trades)) return c;
  } catch { /* unavailable or corrupt: ignore */ }
  return null;
}
export function saveCache(c, storage = globalThis.localStorage) {
  try { storage.setItem(CACHE_KEY, JSON.stringify({ v: 3, pool: POOL_ADDRESS, token: TOKEN_MINT, ...c })); } catch { /* quota/private mode */ }
}

/** Confirm the configured pool really holds the 404 mint and the wrapped-XNT/native quote side. */
/** @param {any} [opts] */
export async function validatePool(opts) {
  const mints = new Set();
  for (const programId of TOKEN_PROGRAMS) {
    const r = await rpc('getTokenAccountsByOwner', [POOL_ADDRESS, { programId }, { encoding: 'jsonParsed' }], opts);
    for (const a of r?.value || []) { const m = a.account?.data?.parsed?.info?.mint; if (m) mints.add(m); }
  }
  if (!mints.has(TOKEN_MINT)) throw new Error('Pool validation failed: configured pool holds no 404 vault');
  if (!mints.has(WXNT_MINT)) { // may hold native XNT: require account to exist
    const bal = await rpc('getBalance', [POOL_ADDRESS], opts);
    if (!(bal?.value > 0)) throw new Error('Pool validation failed: no XNT quote side found');
  }
  return true;
}

/**
 * Incremental sync: only signatures newer than the cached newest one are fetched.
 * Returns { trades, newestSig, failed }.
 */
/** @param {{cache?: any, signal?: AbortSignal}} [arg] */
export async function syncTrades({ cache, signal } = {}) {
  const opts = { signal };
  const until = cache?.newestSig;
  const pageSize = until ? INCREMENTAL_SIGNATURES : FIRST_LOAD_SIGNATURES;
  const sigs = [];
  let before;
  for (let page = 0; page < 4; page++) { // page back to the cursor so no new swaps are skipped
    const params = { limit: pageSize, commitment: 'confirmed' };
    if (until) params.until = until;
    if (before) params.before = before;
    const part = (await rpc('getSignaturesForAddress', [POOL_ADDRESS, params], opts)) || [];
    sigs.push(...part);
    if (!until || part.length < pageSize) break;
    before = part[part.length - 1].signature;
  }
  const ok = sigs.filter(s => !s.err);
  const { items, failed } = await getTransactions(ok.map(s => s.signature), opts);
  const fresh = items.map(({ sig, tx }) => parseSwap(tx, sig)).filter(Boolean);
  const trades = mergeTrades(cache?.trades || [], fresh, MAX_CACHED_TRADES);
  // Only advance the cursor if every fetch succeeded, otherwise we'd skip transactions forever.
  const newestSig = failed === 0 && sigs.length ? sigs[0].signature : until;
  return { trades, newestSig, failed, scanned: ok.length };
}
