import { describe, it, expect } from 'vitest';
import { legacyParseTrade } from './legacy/parseTradeLegacy.js';
import { parseSwap } from '../src/lib/xchart/trades.js';
import { TOKEN_MINT as T, WXNT_MINT as W, POOL_ADDRESS as P } from '../src/lib/xchart/config.js';

const b = (i, mint, owner, amt, dec) => ({ accountIndex: i, mint, owner, uiTokenAmount: { amount: String(amt), decimals: dec, uiAmount: amt / 10 ** dec } });
// Real-shaped BUY: trader pays 1 XNT (wSOL) and receives 10 404; pool vaults move opposite.
// Trader accounts appear AFTER pool vaults in the balance arrays, as is typical.
const buy = {
  blockTime: 1700000000,
  meta: {
    err: null,
    preTokenBalances: [b(1, T, P, 100e6, 6), b(2, W, P, 5e9, 9), b(3, T, 'trader', 0, 6), b(4, W, 'trader', 2e9, 9)],
    postTokenBalances: [b(1, T, P, 90e6, 6), b(2, W, P, 6e9, 9), b(3, T, 'trader', 10e6, 6), b(4, W, 'trader', 1e9, 9)],
    preBalances: [5_000_000_000, 0], postBalances: [4_999_000_000, 0],
  },
  transaction: { message: { accountKeys: ['trader', P] } },
};
describe('legacy parser defects (evidence)', () => {
  it('legacy parser inverts BUY/SELL: later trader wSOL account overwrites the pool vault delta', () => {
    expect(legacyParseTrade(buy, 'x').side).toBe('SELL'); // WRONG: trader bought 404
  });
  it('new parser reads the pool vaults and reports BUY with price 0.1', () => {
    expect(parseSwap(buy, 'x')).toMatchObject({ side: 'BUY', price: 0.1, tok: 10, xnt: 1 });
  });
  it('legacy parser records a plain 404 transfer as a trade using an unrelated lamport delta (fee)', () => {
    const transfer = { blockTime: 1, meta: { err: null,
      preTokenBalances: [b(3, T, 'a', 50e6, 6), b(5, T, 'b', 0, 6)], postTokenBalances: [b(3, T, 'a', 40e6, 6), b(5, T, 'b', 10e6, 6)],
      preBalances: [1e9], postBalances: [1e9 - 5000] }, transaction: { message: { accountKeys: ['a'] } } };
    expect(legacyParseTrade(transfer, 't')).not.toBeNull(); // WRONG: not a swap
    expect(parseSwap(transfer, 't')).toBeNull();
  });
});
