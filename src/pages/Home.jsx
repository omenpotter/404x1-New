import React, { useState, useEffect, useMemo } from 'react';
import { createPageUrl } from '@/utils';
import PriceChart from '@/components/chart/PriceChart';
import { useTrades } from '@/lib/xchart/useTrades';
import { TOKEN_MINT as TOKEN_CA } from '@/lib/xchart/config';
import '@/styles/home.css';

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

const TF_LABEL = { 1: '1m', 5: '5m', 15: '15m', 60: '1h', 240: '4h', 1440: '1d' };
const nf = (n, max = 2, min = 0) => Number(n).toLocaleString('en-US', { maximumFractionDigits: max, minimumFractionDigits: min });
const compact = (n) => (n >= 1e6 ? nf(n / 1e6, 2) + 'M' : n >= 1e3 ? nf(n / 1e3, 2) + 'K' : nf(n, 2));
const trunc = (w) => (w ? w.slice(0, 4) + '…' + w.slice(-4) : '');
const fmtOhlc = (n) => { if (!n || n <= 0) return '0'; if (n >= 1) return n.toFixed(4); const z = (n.toFixed(12).match(/^0\.0*/)?.[0].length ?? 2) - 2; return n.toFixed(Math.min(Math.max(4, z + 3), 10)); };
const ago = (t) => { const s = Math.max(0, Math.floor(Date.now() / 1000 - t)); if (s < 60) return s + 's ago'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; };

function Copy({ text }) {
  const [done, setDone] = useState(false);
  const go = () => {
    const ok = () => { setDone(true); setTimeout(() => setDone(false), 1800); };
    navigator.clipboard?.writeText(text).then(ok).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch { /* ignore */ } document.body.removeChild(ta);
    });
  };
  return (
    <button className="hm-copy" onClick={go} aria-label={done ? 'Copied' : 'Copy contract address'}>
      {done ? (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
      )}
      <span className="sr-only" role="status">{done ? 'Copied' : ''}</span>
    </button>
  );
}

function Metric({ label, value, sub, tone = '', loading = false, title = undefined }) {
  return (
    <div className="hm-metric ds-glass" title={title}>
      <div className="hm-metric-label">{label}</div>
      <div className={`hm-metric-value num${loading ? ' ds-skeleton' : ''}${tone ? ' ' + tone : ''}`}>{loading ? '0000.00' : value}</div>
      <div className="hm-metric-sub">{sub}</div>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState(getUser());
  const [ohlcv, setOhlcv] = useState(null);
  const [currentTF, setCurrentTF] = useState(60);
  const [showVol, setShowVol] = useState(false);
  const [feedTab, setFeedTab] = useState('transactions');

  useEffect(() => {
    const on = () => setUser(getUser());
    window.addEventListener('userAuthChanged', on); window.addEventListener('storage', on);
    return () => { window.removeEventListener('userAuthChanged', on); window.removeEventListener('storage', on); };
  }, []);

  const { trades, status: tradeStatus, error: tradeError, updatedAt, retry: retryTrades, pool, poolError, supply, holders: holderData, holdersError } = useTrades();

  // ---- Derived market data (all from verified on-chain state; nothing is guessed) ----
  const spot = pool?.spot ?? null; // XNT per 1 404, from pool reserves net of accrued fees
  const holdersCount = holderData ? holderData.holders.length : null;
  const holderList = useMemo(() => holderData
    ? [...holderData.excluded.map(h => ({ ...h, label: 'AMM POOLS' })), ...holderData.holders].slice(0, 50) : [], [holderData]);
  const transactions = useMemo(() => [...trades].reverse().slice(0, 20), [trades]);
  const change24 = useMemo(() => {
    if (!spot || !trades.length) return null;
    const ref = [...trades].reverse().find(t => t.time <= Math.floor(Date.now() / 1000) - 86400);
    return ref ? ((spot - ref.price) / ref.price) * 100 : null; // only with a real swap >= 24h old
  }, [spot, trades]);
  const vol24 = useMemo(() => {
    if (!trades.length) return null;
    const cutoff = Math.floor(Date.now() / 1000) - 86400;
    const w = trades.filter(t => t.time > cutoff);
    return { xnt: w.reduce((a, t) => a + t.xnt, 0), n: w.length, full: trades[0].time <= cutoff, since: trades[0].time };
  }, [trades]);
  const dist = useMemo(() => {
    if (!holderData || !supply) return null;
    const amm = holderData.excluded.reduce((a, h) => a + h.balance, 0);
    const top10 = holderData.holders.slice(0, 10).reduce((a, h) => a + h.balance, 0);
    const rest = Math.max(0, supply - amm - top10);
    return [
      { k: 'amm', label: 'AMM vault authority', v: amm }, { k: 'top', label: 'Top 10 wallets', v: top10 }, { k: 'rest', label: `All other wallets (${Math.max(0, holderData.holders.length - 10)})`, v: rest },
    ].map(x => ({ ...x, pct: (x.v / supply) * 100 }));
  }, [holderData, supply]);

  const marketCap = spot && supply ? spot * supply : null;
  const live = tradeStatus === 'ready' ? 'live' : tradeStatus === 'stale' ? 'stale' : tradeStatus === 'error' ? 'error' : 'loading';
  const tfName = TF_LABEL[currentTF];

  return (
    <div className="hm">
      <div className="ds-page hm-page">
        {/* ============ HERO ============ */}
        <section className="hm-hero" aria-labelledby="hm-title">
          <p className="ds-eyebrow">TOKEN 404 · X1 MAINNET</p>
          <h1 id="hm-title" className="hm-title">
            <span className="hm-404 ds-glitch" data-text="404">404</span>
            <span className="hm-sysnf">SYSTEM NOT FOUND</span>
          </h1>
          <p className="hm-tagline">The Underground Has a New Address.</p>
          <p className="hm-intro"><strong>404 ERROR</strong> is a minimal, experimental meme token on <strong>X1 SVM</strong>. <span>No Destination. No Direction. Only supply, liquidity, and the market.</span></p>

          <div className="hm-term ds-glass" role="presentation">
            <div className="hm-term-bar"><i /><i /><i /><span className="mono">404x1://not-found</span></div>
            <ul className="hm-term-body mono">
              {['Roadmap Not Found', 'Utility Not Found', 'Supply Expansion Not Found', 'Guarantees Not Found', 'Not Found'].map((t, i) => (
                <li key={t} style={{ animationDelay: `${0.25 * i + 0.2}s` }}><span className="bad">Error 404 —</span> {t}</li>
              ))}
            </ul>
          </div>

          <div className="hm-cta">
            <a href={createPageUrl('Chat')} className="ds-btn solid">Enter chat</a>
            {!user && <button className="ds-btn" onClick={() => window.dispatchEvent(new CustomEvent('open_wallet_modal'))}>Connect wallet</button>}
            <a className="ds-btn ghost" href={`https://app.xdex.xyz/swap?fromTokenAddress=${TOKEN_CA}&toTokenAddress=111111111111111111111111111111111111111111`} target="_blank" rel="noopener noreferrer">Trade on xDEX ↗</a>
          </div>
        </section>

        {/* ============ CONTRACT ============ */}
        <section className="hm-ca ds-glass" aria-label="Contract address">
          <span className="hm-ca-label mono">CONTRACT ADDRESS (CA)</span>
          <code className="hm-ca-addr mono">{TOKEN_CA}</code>
          <Copy text={TOKEN_CA} />
          <a className="hm-ca-link mono" href={`https://explorer.mainnet.x1.xyz/address/${TOKEN_CA}`} target="_blank" rel="noopener noreferrer">Explorer ↗</a>
          <a className="hm-ca-link mono" href={`https://x1space.xyz/TokenExplorer?mint=${TOKEN_CA}`} target="_blank" rel="noopener noreferrer">X1 Space ↗</a>
        </section>

        {/* ============ MARKET DASHBOARD ============ */}
        <section aria-labelledby="hm-market" className="hm-section">
          <div className="hm-sechead">
            <h2 id="hm-market" className="ds-h2">Live market</h2>
            <span className={`ds-chip ${live === 'live' ? 'ok' : live === 'stale' ? 'warn' : live === 'error' ? 'bad' : ''}`} role="status">
              {live === 'live' ? `LIVE · ${updatedAt ? new Date(updatedAt).toLocaleTimeString() : ''}` : live === 'stale' ? 'STALE · cached' : live === 'error' ? 'DATA ERROR' : 'SYNCING…'}
            </span>
            <span className="hm-src mono">Source: X1 mainnet RPC · pool {trunc(pool?.pool || 'DY9uWCwiue23mmq14G2YVYWyXHSYn8ZjSvYJ36CAvmq1')}</span>
          </div>
          <div className="hm-metrics">
            <Metric label="PRICE · XNT" value={spot ? nf(spot, 6, 6) : 'N/A'} sub="XNT per 1 404 (pool spot)" loading={!spot && !poolError} tone="hero" title={poolError || undefined} />
            <Metric label="24H CHANGE" value={change24 == null ? '—' : (change24 >= 0 ? '+' : '') + change24.toFixed(2) + '%'} sub={change24 == null ? 'needs a swap ≥ 24h old' : 'vs last swap ≥ 24h ago'} tone={change24 == null ? '' : change24 >= 0 ? 'up' : 'down'} loading={tradeStatus === 'loading'} />
            <Metric label="MARKET CAP · XNT" value={marketCap ? compact(marketCap) : 'N/A'} sub={marketCap ? `${nf(marketCap, 2)} XNT = price × supply` : 'price × supply'} loading={!marketCap && !poolError} />
            <Metric label="SUPPLY · 404" value={supply ? nf(supply, 2) : 'N/A'} sub="mint supply · authority revoked" loading={!supply && !poolError} />
            <Metric label="24H VOLUME · XNT" value={vol24 ? nf(vol24.xnt, 2) : tradeStatus === 'empty' ? '0.00' : 'N/A'} sub={vol24 ? `${vol24.n} swaps${vol24.full ? '' : ' since ' + new Date(vol24.since * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'from verified pool swaps'} loading={tradeStatus === 'loading' && !vol24} />
            <Metric label="HOLDERS" value={holdersCount != null ? nf(holdersCount) : 'N/A'} sub="unique wallets · excl. AMM" loading={holdersCount == null && !holdersError} title={holdersError || undefined} />
            <Metric label="LIQUIDITY · XNT" value={pool ? compact(pool.quoteReserve * 2) : 'N/A'} sub={pool ? `${nf(pool.quoteReserve, 2)} XNT + ${nf(pool.tokenReserve, 0)} 404` : 'pool reserves'} loading={!pool && !poolError} />
          </div>
          {poolError && (
            <div className="hm-alert" role="alert">Market data unavailable: {poolError} <button className="ds-btn ghost" onClick={retryTrades}>Retry</button></div>
          )}
        </section>

        {/* ============ CHART ============ */}
        <section className="hm-chart ds-glass" aria-label="404 price chart">
          <header className="hm-chart-head">
            <div className="hm-pair">
              <span className="hm-pair-name">404 / XNT</span>
              <span className="ds-chip">{tfName}</span>
              <span className={`hm-dot ${live}`} aria-hidden="true" />
            </div>
            <div className="hm-chart-price num">
              <span>{spot ? nf(spot, 6, 6) : '—'}</span><small>XNT</small>
              {change24 != null && <em className={change24 >= 0 ? 'up' : 'down'}>{(change24 >= 0 ? '+' : '') + change24.toFixed(2)}%</em>}
            </div>
          </header>

          <div className="hm-chart-tools">
            <div className="hm-seg" role="group" aria-label="Timeframe">
              {Object.entries(TF_LABEL).map(([tf, l]) => (
                <button key={tf} className={currentTF === Number(tf) ? 'on' : ''} aria-pressed={currentTF === Number(tf)} onClick={() => setCurrentTF(Number(tf))}>{l}</button>
              ))}
            </div>
            <button className={`hm-vol${showVol ? ' on' : ''}`} aria-pressed={showVol} onClick={() => setShowVol(v => !v)}>Vol</button>
            <div className="hm-ohlcv num" aria-live="off">
              {ohlcv ? (<>
                <span>O <b>{fmtOhlc(ohlcv.o)}</b></span><span>H <b className="up">{fmtOhlc(ohlcv.h)}</b></span><span>L <b className="down">{fmtOhlc(ohlcv.l)}</b></span><span>C <b>{fmtOhlc(ohlcv.c)}</b></span><span>Volume <b>{nf(ohlcv.v, 0)}</b></span>
              </>) : <span className="faint">Hover a candle for OHLCV</span>}
            </div>
          </div>

          {(tradeStatus === 'stale' || (tradeStatus === 'ready' && tradeError)) && (
            <div role="status" className="hm-note">
              {tradeStatus === 'stale' ? 'Showing cached data' : 'Partial data'}{tradeError ? ` (${tradeError})` : ''}{updatedAt ? ` — last updated ${new Date(updatedAt).toLocaleTimeString()}` : ''}
              <button className="hm-link" onClick={retryTrades}>Retry</button>
            </div>
          )}
          <div className="chart-canvas404 hm-canvas">
            <PriceChart trades={trades} tf={currentTF} showVol={showVol} onHover={setOhlcv} />
            {tradeStatus === 'loading' && <div className="chart-loading404 hm-overlay"><span className="ds-spinner" aria-hidden="true" />Loading verified swaps from X1 RPC…</div>}
            {tradeStatus === 'empty' && <div className="chart-loading404 hm-overlay">No 404/XNT swaps found yet. Nothing is shown rather than invented.</div>}
            {tradeStatus === 'error' && (
              <div className="chart-loading404 hm-overlay" role="alert">
                <span>Could not load chart data: {tradeError}</span>
                <button className="ds-btn" onClick={retryTrades}>Retry</button>
              </div>
            )}
          </div>
          <footer className="hm-chart-foot mono">{trades.length ? `${trades.length} verified swaps · ${new Date(trades[0].time * 1000).toLocaleDateString()} → ${new Date(trades[trades.length - 1].time * 1000).toLocaleDateString()} · candles aggregate real swaps only` : 'candles aggregate real swaps only'}</footer>
        </section>

        {/* ============ ACTIONS ============ */}
        <nav className="hm-actions" aria-label="Ecosystem links">
          {[
            ['https://app.bridge.x1.xyz/', 'Bridge', 'Solana ↔ X1'],
            [`https://app.xdex.xyz/swap?fromTokenAddress=${TOKEN_CA}&toTokenAddress=111111111111111111111111111111111111111111`, 'Trade', 'xDEX Swap'],
            ['https://xdex.xyz/liquidity', 'Liquidity Pool', 'Add/Remove'],
          ].map(([href, t, s]) => (
            <a key={t} href={href} target="_blank" rel="noopener noreferrer" className="hm-action ds-glass">
              <span className="hm-action-t">{t}</span><span className="hm-action-s mono">{s}</span><span className="hm-action-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>

        {/* ============ FEED ============ */}
        <section className="hm-feed ds-glass" aria-label="Live feed">
          <div className="hm-tabs" role="tablist">
            <button role="tab" aria-selected={feedTab === 'transactions'} className={feedTab === 'transactions' ? 'on' : ''} onClick={() => setFeedTab('transactions')}>Transactions</button>
            <button role="tab" aria-selected={feedTab === 'holders'} className={feedTab === 'holders' ? 'on' : ''} onClick={() => setFeedTab('holders')}>Holders</button>
          </div>

          {feedTab === 'transactions' && (
            <div role="tabpanel">
              <div className="hm-row hm-th txn mono" aria-hidden="true"><span>Time</span><span>Type</span><span>XNT</span><span>404</span><span>Price</span><span>Maker</span></div>
              <div className="hm-list">
                {transactions.length === 0 && <div className="hm-empty">{tradeStatus === 'error' ? 'Transactions unavailable.' : tradeStatus === 'empty' ? 'No swaps yet.' : 'Loading transactions from X1 RPC…'}</div>}
                {transactions.map(tx => (
                  <a key={tx.sig} href={`https://explorer.mainnet.x1.xyz/tx/${tx.sig}`} target="_blank" rel="noopener noreferrer" className={`hm-row txn ${tx.side === 'BUY' ? 'buy' : 'sell'} num`} aria-label={`${tx.side} ${nf(tx.tok, 2)} 404 for ${nf(tx.xnt, 4)} XNT, ${ago(tx.time)}. Open in explorer`}>
                    <time dateTime={new Date(tx.time * 1000).toISOString()} title={new Date(tx.time * 1000).toLocaleString()}>{new Date(tx.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}<small>{ago(tx.time)}</small></time>
                    <span className={`pill ${tx.side === 'BUY' ? 'buy' : 'sell'}`}>{tx.side}</span>
                    <span data-l="XNT">{nf(tx.xnt, 4, 4)}</span>
                    <span data-l="404">{nf(tx.tok, 2)}</span>
                    <span data-l="PRICE" className="px">{tx.price.toFixed(6)}</span>
                    <span data-l="MAKER" className="mk" title={tx.maker}>{trunc(tx.maker)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {feedTab === 'holders' && (
            <div role="tabpanel">
              {dist && (
                <div className="hm-dist">
                  <div className="hm-dist-bar" role="img" aria-label={dist.map(d => `${d.label} ${d.pct.toFixed(1)} percent`).join(', ')}>
                    {dist.map(d => <i key={d.k} className={d.k} style={{ width: Math.max(d.pct, 0.4) + '%' }} />)}
                  </div>
                  <ul className="hm-dist-key mono">
                    {dist.map(d => <li key={d.k}><i className={d.k} />{d.label} <b>{d.pct.toFixed(2)}%</b></li>)}
                  </ul>
                  <p className="hm-dist-note">Computed from on-chain token accounts of the 404 mint ({nf(supply, 2)} supply). The AMM vault authority holds liquidity for all pools of that AMM, not only the 404/XNT pool.</p>
                </div>
              )}
              <div className="hm-row hm-th hld mono" aria-hidden="true"><span>Rank</span><span>Wallet</span><span>Balance</span><span>Share</span></div>
              <div className="hm-list">
                {holderList.length === 0 && <div className="hm-empty">{holdersError ? 'Holder data unavailable: ' + holdersError : 'Loading holder data from X1 RPC…'}</div>}
                {holderList.map((h, i) => (
                  <a key={h.wallet} href={`https://explorer.mainnet.x1.xyz/address/${h.wallet}`} target="_blank" rel="noopener noreferrer" className="hm-row hld num">
                    <span className="rk">#{i + 1}</span>
                    <span className="mk" title={h.wallet}>{h.label || trunc(h.wallet)}</span>
                    <span>{nf(h.balance, 2)}</span>
                    <span className="sh">{supply ? ((h.balance / supply) * 100).toFixed(2) + '%' : ''}<i style={{ width: supply ? Math.min(100, (h.balance / supply) * 100) + '%' : 0 }} /></span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ============ COMMUNITY ============ */}
        <section className="hm-rp" aria-label="Community">
          <div className="ds-glass hm-rp-card"><div className="hm-rp-t">Reputation Points</div><p>Earn RP through chat participation and game progression.</p></div>
          <div className="ds-glass hm-rp-card"><div className="hm-rp-t">Leaderboards</div><p>Compete in chat activity and game mastery.</p></div>
        </section>

        <footer className="hm-footer">
          <p>404x1 may integrate blockchain-based rewards in the future.<br />Existing accounts, RP, and achievements will remain valid.</p>
          <div className="hm-footer-links mono">
            <a href="https://x.com/rkbehelvi" target="_blank" rel="noopener noreferrer">Twitter</a>
            <a href="https://t.me/+jpYK0gMfA5o1MGFk" target="_blank" rel="noopener noreferrer">Telegram</a>
            <a href={createPageUrl('Profile')}>Profile</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
