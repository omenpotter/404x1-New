import { describe, it, expect, vi } from 'vitest';
import { parseSwap, mergeTrades } from '../src/lib/xchart/trades.js';
import { tradesToCandles } from '../src/lib/xchart/candles.js';
import { rpcPost, getTransactions } from '../src/lib/xchart/rpc.js';
import { syncTrades } from '../src/lib/xchart/store.js';
import { TOKEN_MINT, WXNT_MINT, POOL_ADDRESS } from '../src/lib/xchart/config.js';

const bal = (i, mint, owner, amount, decimals) => ({ accountIndex: i, mint, owner, uiTokenAmount: { amount: String(amount), decimals } });
function tx({ tokPre, tokPost, xPre, xPost, err = null, native, time = 1000 }) {
  const m = { err, preTokenBalances: [bal(1, TOKEN_MINT, POOL_ADDRESS, tokPre, 6), bal(2, WXNT_MINT, POOL_ADDRESS, xPre, 9)],
    postTokenBalances: [bal(1, TOKEN_MINT, POOL_ADDRESS, tokPost, 6), bal(2, WXNT_MINT, POOL_ADDRESS, xPost, 9)], preBalances: [1, 1], postBalances: [1, 1] };
  if (native) { m.preTokenBalances = [m.preTokenBalances[0]]; m.postTokenBalances = [m.postTokenBalances[0]]; m.preBalances = [0, native[0]]; m.postBalances = [0, native[1]]; }
  return { blockTime: time, meta: m, transaction: { message: { accountKeys: [{ pubkey: 'trader' }, POOL_ADDRESS] } } };
}

describe('parseSwap', () => {
  it('BUY: pool 404 down, WXNT up; price = XNT/404 using decimals', () => {
    const t = parseSwap(tx({ tokPre: 100_000_000, tokPost: 90_000_000, xPre: 5e9, xPost: 6e9 }), 's1');
    expect(t).toMatchObject({ side: 'BUY', tok: 10, xnt: 1, price: 0.1, sig: 's1', maker: 'trader' });
  });
  it('SELL: pool 404 up, WXNT down', () => {
    const t = parseSwap(tx({ tokPre: 90_000_000, tokPost: 100_000_000, xPre: 6e9, xPost: 5e9 }), 's2');
    expect(t.side).toBe('SELL'); expect(t.price).toBeCloseTo(0.1);
  });
  it('native XNT held by pool account', () => {
    const t = parseSwap(tx({ tokPre: 100_000_000, tokPost: 90_000_000, native: [5e9, 6e9] }), 's3');
    expect(t).toMatchObject({ side: 'BUY', xnt: 1, price: 0.1 });
  });
  it('rejects liquidity add (same direction), failed tx, no blockTime, unrelated pool', () => {
    expect(parseSwap(tx({ tokPre: 1e8, tokPost: 1.1e8, xPre: 5e9, xPost: 6e9 }))).toBeNull();
    expect(parseSwap(tx({ tokPre: 1e8, tokPost: 9e7, xPre: 5e9, xPost: 6e9, err: { x: 1 } }))).toBeNull();
    const nb = tx({ tokPre: 1e8, tokPost: 9e7, xPre: 5e9, xPost: 6e9 }); nb.blockTime = null;
    expect(parseSwap(nb)).toBeNull();
    expect(parseSwap(tx({ tokPre: 1e8, tokPost: 9e7, xPre: 5e9, xPost: 6e9 }), '', { pool: 'other' })).toBeNull();
  });
  it('ignores a wallet that merely transfers 404 (pool untouched)', () => {
    const t = tx({ tokPre: 1e8, tokPost: 1e8, xPre: 5e9, xPost: 5e9 });
    expect(parseSwap(t)).toBeNull();
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
    await expect(rpcPost({}, { fetchImpl: f })).rejects.toThrow('403'); expect(f).toHaveBeenCalledTimes(1);
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
    const r = await syncTrades({});
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
