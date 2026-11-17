import { describe, it, expect, vi } from 'vitest';
import { parseSwap, mergeTrades } from '../src/lib/xchart/trades.js';
import { tradesToCandles } from '../src/lib/xchart/candles.js';
import { rpcPost, getTransactions } from '../src/lib/xchart/rpc.js';
import { syncTrades } from '../src/lib/xchart/store.js';
import { TOKEN_MINT, WXNT_MINT, POOL_ADDRESS } from '../src/lib/xchart/config.js';
import { decodePoolState, b64decode } from '../src/lib/xchart/pool.js';
import { aggregateHolders } from '../src/lib/xchart/market.js';
import { readFileSync } from 'node:fs';

const POOL = { tokenVault: 'TOKVAULT', quoteVault: 'XNTVAULT', tokenDecimals: 6, quoteDecimals: 9 };
const bal = (i, mint, owner, amount, decimals) => ({ accountIndex: i, mint, owner, uiTokenAmount: { amount: String(amount), decimals } });
// Vaults are shared-authority token accounts located by ADDRESS (indexes 1 and 2).
function tx({ tokPre, tokPost, xPre, xPost, err = null, time = 1000, keys = ['trader', 'TOKVAULT', 'XNTVAULT'] }) {
  return { blockTime: time, meta: { err,
    preTokenBalances: [bal(1, TOKEN_MINT, 'AUTH', tokPre, 6), bal(2, WXNT_MINT, 'AUTH', xPre, 9)],
    postTokenBalances: [bal(1, TOKEN_MINT, 'AUTH', tokPost, 6), bal(2, WXNT_MINT, 'AUTH', xPost, 9)] },
    transaction: { message: { accountKeys: keys.map(pubkey => ({ pubkey })) } } };
}

describe('parseSwap (vault-address based)', () => {
  it('BUY: token vault down, quote vault up; price = XNT/404 using decimals', () => {
    expect(parseSwap(tx({ tokPre: 100_000_000, tokPost: 90_000_000, xPre: 5e9, xPost: 6e9 }), 's1', POOL)).toMatchObject({ side: 'BUY', tok: 10, xnt: 1, price: 0.1, sig: 's1', maker: 'trader' });
  });
  it('SELL: token vault up, quote vault down', () => {
    const t = parseSwap(tx({ tokPre: 90_000_000, tokPost: 100_000_000, xPre: 6e9, xPost: 5e9 }), 's2', POOL);
    expect(t.side).toBe('SELL'); expect(t.price).toBeCloseTo(0.1);
  });
  it('rejects liquidity add (same direction), failed tx, no blockTime', () => {
    expect(parseSwap(tx({ tokPre: 1e8, tokPost: 1.1e8, xPre: 5e9, xPost: 6e9 }), '', POOL)).toBeNull();
    expect(parseSwap(tx({ tokPre: 1e8, tokPost: 9e7, xPre: 5e9, xPost: 6e9, err: { x: 1 } }), '', POOL)).toBeNull();
    const nb = tx({ tokPre: 1e8, tokPost: 9e7, xPre: 5e9, xPost: 6e9 }); nb.blockTime = null;
    expect(parseSwap(nb, '', POOL)).toBeNull();
  });
  it('rejects a tx that does not include this pool\'s vaults (other pool sharing the same authority)', () => {
    expect(parseSwap(tx({ tokPre: 1e8, tokPost: 9e7, xPre: 5e9, xPost: 6e9, keys: ['trader', 'OTHER1', 'OTHER2'] }), '', POOL)).toBeNull();
  });
  it('rejects a vault-untouched transfer', () => {
    expect(parseSwap(tx({ tokPre: 1e8, tokPost: 1e8, xPre: 5e9, xPost: 5e9 }), '', POOL)).toBeNull();
  });
});

describe('REAL on-chain fixtures (captured from X1 mainnet 2026-11-17)', () => {
  const pstate = JSON.parse(readFileSync(new URL('./fixtures/pool_state_DY9u.json', import.meta.url)));
  it('decodes the real pool state account', () => {
    const st = decodePoolState(b64decode(pstate.data[0]));
    expect(pstate.owner).toBe('sEsYH97wqmfnkzHedjNcw3zyJdPvUmsa9AixhS4b4fN');
    expect(st).toMatchObject({ token0Mint: WXNT_MINT, token1Mint: TOKEN_MINT, token0Vault: '5t5EsuS5kuofpT68j9qHfLuwZRpECJPk1zqRGHeJp922', token1Vault: '6G9EKKX3kF6UUyUtBbo731NGQnr88h9JD4zWzi1tf8DL', lpMint: '69VYWwidxk9J7HxbtSfMbNVroAeT32Uy8cX52hmJtt1h', mint0Decimals: 9, mint1Decimals: 9 });
    expect(st.protocolFees0 + st.fundFees0).toBe(2822151576n + 1545363423n);
  });
  it('parses a real swap: SELL 59.32 404 for 0.2693 XNT', () => {
    const f = JSON.parse(readFileSync(new URL('./fixtures/real_swap_sell.json', import.meta.url)));
    const pool = { tokenVault: '6G9EKKX3kF6UUyUtBbo731NGQnr88h9JD4zWzi1tf8DL', quoteVault: '5t5EsuS5kuofpT68j9qHfLuwZRpECJPk1zqRGHeJp922', tokenDecimals: 9, quoteDecimals: 9 };
    const t = parseSwap(f.tx, f.signature, pool);
    expect(t.side).toBe('SELL'); expect(t.tok).toBeCloseTo(59.323027482, 6); expect(t.xnt).toBeCloseTo(0.269316939, 6); expect(t.price).toBeCloseTo(0.0045396, 5);
    expect(t.maker).toBe('6cPHtBUqQrCBYyjhpbzBdq3jnDsxQ712mXV1PzUMmHwQ');
  });
  it('a different pool sharing the authority does not match the real tx', () => {
    const f = JSON.parse(readFileSync(new URL('./fixtures/real_swap_sell.json', import.meta.url)));
    expect(parseSwap(f.tx, 'x', { tokenVault: 'a', quoteVault: 'b', tokenDecimals: 9, quoteDecimals: 9 })).toBeNull();
  });
});

describe('holders', () => {
  it('counts unique owner wallets, not token accounts, and drops zero balances', () => {
    const h = aggregateHolders([{ owner: 'a', amount: 5n * 10n ** 9n }, { owner: 'a', amount: 3n * 10n ** 9n }, { owner: 'b', amount: 0n }, { owner: 'c', amount: 1n * 10n ** 9n }]);
    expect(h).toEqual([{ wallet: 'a', balance: 8 }, { wallet: 'c', balance: 1 }]);
  });
});

describe('candles', () => {
  const T = (time, price, tok) => ({ time, price, tok, xnt: price * tok, sig: String(time) });
  it('OHLCV aggregation, gaps not filled', () => {
    const c = tradesToCandles([T(3700, 3, 1), T(60, 1, 2), T(100, 2, 3), T(110, 0.5, 4)], 60);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ time: 0, open: 1, high: 2, low: 0.5, close: 0.5, volume: 9, trades: 3 });
    expect(c[1].time).toBe(3600);
  });
  it('timeframes bucket correctly', () => {
    const tr = [T(0, 1, 1), T(299, 2, 1), T(300, 3, 1)];
    expect(tradesToCandles(tr, 5)).toHaveLength(2);
    expect(tradesToCandles(tr, 1)).toHaveLength(3);
    expect(tradesToCandles(tr, 1440)).toHaveLength(1);
  });
  it('empty input -> empty', () => expect(tradesToCandles([], 5)).toEqual([]));
  it('mergeTrades dedupes and sorts', () => {
    expect(mergeTrades([T(2, 1, 1)], [T(1, 1, 1), T(2, 9, 9)]).map(t => t.time)).toEqual([1, 2]);
  });
});

const res = (status, body) => ({ status, ok: status < 400, json: async () => body });
describe('rpc', () => {
  it('retries 429 then succeeds', async () => {
    const f = vi.fn().mockResolvedValueOnce(res(429)).mockResolvedValueOnce(res(200, { ok: 1 }));
    expect(await rpcPost({}, { fetchImpl: f })).toEqual({ ok: 1 }); expect(f).toHaveBeenCalledTimes(2);
  }, 10000);
  it('does not retry 4xx', async () => {
    const f = vi.fn().mockResolvedValue(res(403));
    await expect(rpcPost({}, { fetchImpl: f, url: 'https://x.test' })).rejects.toThrow('403'); expect(f).toHaveBeenCalledTimes(1);
  });
  it('fails over to the fallback endpoint when the primary is rejected', async () => {
    const f = vi.fn().mockResolvedValueOnce(res(403)).mockResolvedValueOnce(res(200, { ok: 2 }));
    expect(await rpcPost({}, { fetchImpl: f })).toEqual({ ok: 2 });
    expect(f.mock.calls[0][0]).not.toBe(f.mock.calls[1][0]);
  });
  it('abort rejects with AbortError', async () => {
    const c = new AbortController(); c.abort();
    await expect(rpcPost({}, { signal: c.signal, fetchImpl: vi.fn() })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('syncTrades (mocked RPC)', () => {
  it('fetches signatures for the POOL, parses swaps, skips failed sigs, advances cursor', async () => {
    const good = tx({ tokPre: 1e8, tokPost: 9e7, xPre: 5e9, xPost: 6e9 });
    const f = vi.fn(async (_u, init) => {
      const b = JSON.parse(init.body);
      if (Array.isArray(b)) return res(200, b.map(r => ({ id: r.id, result: r.params[0] === 'a' ? good : null })));
      expect(b.params[0]).toBe(POOL_ADDRESS);
      return res(200, { result: [{ signature: 'a', err: null }, { signature: 'bad', err: {} }] });
    });
    vi.stubGlobal('fetch', f);
    const r = await syncTrades({ pool: POOL });
    expect(r.trades).toHaveLength(1); expect(r.newestSig).toBe('a'); expect(r.failed).toBe(0);
    vi.unstubAllGlobals();
  });
  it('getTransactions falls back to singles when batch is rejected', async () => {
    const f = vi.fn(async (_u, init) => {
      const b = JSON.parse(init.body);
      return Array.isArray(b) ? res(400) : res(200, { result: { blockTime: 1 } });
    });
    vi.stubGlobal('fetch', f);
    const r = await getTransactions(['x', 'y']);
    expect(r.items).toHaveLength(2); expect(r.failed).toBe(0);
    vi.unstubAllGlobals();
  });
});
