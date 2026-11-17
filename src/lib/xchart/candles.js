/**
 * Aggregate verified swaps into OHLCV candles. Only buckets that contain trades
 * are emitted: periods without trades stay empty (nothing is invented).
 * Volume = 404 tokens traded; quoteVolume = XNT.
 */
export function tradesToCandles(trades, tfMinutes) {
  const step = tfMinutes * 60;
  const sorted = [...trades].sort((a, b) => a.time - b.time);
  const out = [];
  let cur = null;
  for (const t of sorted) {
    const k = Math.floor(t.time / step) * step;
    if (!cur || cur.time !== k) {
      cur = { time: k, open: t.price, high: t.price, low: t.price, close: t.price, volume: 0, quoteVolume: 0, trades: 0 };
      out.push(cur);
    }
    cur.high = Math.max(cur.high, t.price);
    cur.low = Math.min(cur.low, t.price);
    cur.close = t.price;
    cur.volume += t.tok;
    cur.quoteVolume += t.xnt;
    cur.trades += 1;
  }
  return out;
}

export function fmtPrice(v) {
  if (!v || v <= 0) return '0';
  if (v >= 1) return v.toFixed(4);
  if (v >= 0.01) return v.toFixed(6);
  if (v >= 0.0001) return v.toFixed(8);
  return v.toFixed(10);
}
