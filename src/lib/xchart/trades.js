import { TOKEN_MINT, WXNT_MINT, POOL_ADDRESS, NATIVE_DECIMALS } from './config.js';

const toBig = (v) => { try { return BigInt(v ?? '0'); } catch { return 0n; } };
const scale = (raw, dec) => Number(raw) / 10 ** dec; // raw is small enough after delta

function keyOf(k) { return typeof k === 'string' ? k : k?.pubkey; }

/**
 * Parse one confirmed transaction (jsonParsed) into a 404/XNT swap, judged from the
 * POOL's perspective: the pool's 404 vault and quote-side balance must move in
 * opposite directions. Returns null for anything that is not a genuine swap
 * (failed tx, liquidity add/remove, transfers, unrelated txs).
 * Price = XNT per 1 404. BUY = trader received 404 (pool 404 decreased).
 */
export function parseSwap(tx, signature = '', cfg = {}) {
  const token = cfg.token ?? TOKEN_MINT, wxnt = cfg.wxnt ?? WXNT_MINT, pool = cfg.pool ?? POOL_ADDRESS;
  if (!tx || !tx.meta || tx.meta.err) return null;
  if (!tx.blockTime) return null;
  const pre = tx.meta.preTokenBalances || [], post = tx.meta.postTokenBalances || [];

  let tokDelta = 0n, tokDec = null, quoteDelta = 0n, quoteDec = NATIVE_DECIMALS, sawQuoteToken = false;
  const idxs = new Set([...pre, ...post].filter(b => b.owner === pool).map(b => b.accountIndex));
  for (const i of idxs) {
    const a = pre.find(b => b.accountIndex === i), b = post.find(x => x.accountIndex === i);
    const mint = (b || a).mint;
    const d = toBig(b?.uiTokenAmount?.amount) - toBig(a?.uiTokenAmount?.amount);
    const dec = (b || a).uiTokenAmount?.decimals;
    if (mint === token) { tokDelta += d; tokDec = dec; }
    else if (mint === wxnt) { quoteDelta += d; quoteDec = dec ?? NATIVE_DECIMALS; sawQuoteToken = true; }
  }
  if (tokDec == null) return null; // pool vault for the token not touched -> not our pool

  // Native XNT held directly by the pool account (only if no wrapped vault moved).
  if (!sawQuoteToken || quoteDelta === 0n) {
    const keys = (tx.transaction?.message?.accountKeys || []).map(keyOf);
    const i = keys.indexOf(pool);
    if (i >= 0 && tx.meta.preBalances && tx.meta.postBalances) {
      quoteDelta = BigInt(tx.meta.postBalances[i]) - BigInt(tx.meta.preBalances[i]);
      quoteDec = NATIVE_DECIMALS;
    }
  }
  if (tokDelta === 0n || quoteDelta === 0n) return null;
  if ((tokDelta > 0n) === (quoteDelta > 0n)) return null; // same direction => liquidity/transfer, not a swap

  const tok = Math.abs(scale(tokDelta, tokDec)), xnt = Math.abs(scale(quoteDelta, quoteDec));
  const price = xnt / tok;
  if (!(price > 0) || !Number.isFinite(price)) return null;
  const keys = tx.transaction?.message?.accountKeys || [];
  return {
    time: tx.blockTime, price, tok, xnt,
    side: tokDelta < 0n ? 'BUY' : 'SELL',
    maker: keyOf(keys[0]) || '', sig: signature,
  };
}

/** Dedupe by signature, sort ascending by time (stable on sig). */
export function mergeTrades(a, b, max = Infinity) {
  const m = new Map();
  for (const t of [...a, ...b]) m.set(t.sig, t);
  const out = [...m.values()].sort((x, y) => x.time - y.time || (x.sig < y.sig ? -1 : 1));
  return out.length > max ? out.slice(out.length - max) : out;
}
