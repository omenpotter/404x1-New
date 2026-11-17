import { NATIVE_DECIMALS } from './config.js';

const toBig = (v) => { try { return BigInt(v ?? '0'); } catch { return 0n; } };
const keyOf = (k) => (typeof k === 'string' ? k : k?.pubkey);

/**
 * Parse one confirmed transaction (jsonParsed) into a 404/XNT swap for ONE specific pool, judged from
 * the pool's own two vault token accounts (looked up by ADDRESS in the transaction's account keys;
 * the vault authority is shared by many pools so it cannot be used to identify this pool).
 * Rejects failed txs, liquidity add/remove (vault deltas in the same direction), and transactions
 * that do not move both vaults. Price = XNT per 1 404 (execution price incl. pool fee).
 * BUY = trader received 404 (token vault decreased). Multi-hop routes through the pool are fine.
 * @param {any} tx @param {string} signature
 * @param {{tokenVault:string, quoteVault:string, tokenDecimals:number, quoteDecimals:number}} pool
 */
export function parseSwap(tx, signature, pool) {
  if (!tx?.meta || tx.meta.err || !tx.blockTime || !pool) return null;
  const keys = (tx.transaction?.message?.accountKeys || []).map(keyOf);
  const iTok = keys.indexOf(pool.tokenVault), iQuote = keys.indexOf(pool.quoteVault);
  if (iTok < 0 || iQuote < 0) return null;
  const delta = (i) => {
    const a = (tx.meta.preTokenBalances || []).find(b => b.accountIndex === i);
    const b = (tx.meta.postTokenBalances || []).find(x => x.accountIndex === i);
    if (!a || !b) return null;
    return toBig(b.uiTokenAmount?.amount) - toBig(a.uiTokenAmount?.amount);
  };
  const dTok = delta(iTok), dQuote = delta(iQuote);
  if (dTok === null || dQuote === null || dTok === 0n || dQuote === 0n) return null;
  if ((dTok > 0n) === (dQuote > 0n)) return null; // same direction => liquidity change, not a swap
  const abs = (x) => (x < 0n ? -x : x);
  const tok = Number(abs(dTok)) / 10 ** (pool.tokenDecimals ?? 9);
  const xnt = Number(abs(dQuote)) / 10 ** (pool.quoteDecimals ?? NATIVE_DECIMALS);
  const price = xnt / tok;
  if (!(price > 0) || !Number.isFinite(price)) return null;
  return { time: tx.blockTime, price, tok, xnt, side: dTok < 0n ? 'BUY' : 'SELL', maker: keys[0] || '', sig: signature };
}

/** Dedupe by signature, sort ascending by time (stable on sig). */
export function mergeTrades(a, b, max = Infinity) {
  const m = new Map();
  for (const t of [...a, ...b]) m.set(t.sig, t);
  const out = [...m.values()].sort((x, y) => x.time - y.time || (x.sig < y.sig ? -1 : 1));
  return out.length > max ? out.slice(out.length - max) : out;
}
