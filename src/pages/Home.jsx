import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';
import PriceChart from '@/components/chart/PriceChart';
import { useTrades } from '@/lib/xchart/useTrades';
import { TOKEN_MINT as TOKEN_CA } from '@/lib/xchart/config';

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}
function saveUser(u) { localStorage.setItem('404x1_user', JSON.stringify(u)); }
function clearUser() { localStorage.removeItem('404x1_user'); }

export default function Home() {
  const [user, setUser] = useState(getUser());
  const [ohlcv, setOhlcv] = useState(null);
  const [currentTF, setCurrentTF] = useState(60);
  const [showVol, setShowVol] = useState(false);
  const [feedTab, setFeedTab] = useState('transactions');
  const [copyDone, setCopyDone] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);




  // Matrix rain background
  useEffect(() => {
    const el = document.getElementById('matrixBg404');
    if (!el) return;
    const chars = '404ERRORX1SVMNOTFOUND01';
    const cols = Math.floor(window.innerWidth / 30);
    el.innerHTML = '';
    for (let i = 0; i < cols; i++) {
      const col = document.createElement('div');
      col.className = 'matrix-col-404';
      col.style.left = i * 30 + 'px';
      col.style.animationDuration = (12 + Math.random() * 8) + 's';
      col.style.animationDelay = (-Math.random() * 20) + 's';
      col.textContent = Array.from({ length: 20 }, () => chars[Math.floor(Math.random() * chars.length)]).join('\n');
      el.appendChild(col);
    }
  }, []);

  // Unread conversations count
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem('404x1_conversations') || '[]');
      setUnreadCount(c.reduce((s, x) => s + (x.unread_count || 0), 0));
    } catch {}
  }, []);

  const { trades, status: tradeStatus, error: tradeError, updatedAt, retry: retryTrades, pool, poolError, supply, holders: holderData, holdersError } = useTrades();

  // ---- Derived market data (all from verified on-chain state; nothing is guessed) ----
  const spot = pool?.spot ?? null; // XNT per 1 404, from pool reserves net of accrued fees
  const fmtXnt = (c) => (c >= 1_000_000 ? (c / 1_000_000).toFixed(2) + 'M XNT' : c >= 1000 ? (c / 1000).toFixed(2) + 'K XNT' : c.toFixed(2) + ' XNT');
  const price = spot ? spot.toFixed(6) + ' XNT' : poolError ? 'N/A' : 'Loading...';
  const chartPrice = spot ? spot.toFixed(6) : '—';
  const marketCap = spot && supply ? fmtXnt(spot * supply) : poolError ? 'N/A' : 'Loading...';
  const holders = holderData ? holderData.holders.length.toLocaleString() : holdersError ? 'N/A' : 'Loading...';
  const holderList = React.useMemo(() => holderData
    ? [...holderData.excluded.map(h => ({ ...h, label: 'AMM POOLS' })), ...holderData.holders].slice(0, 50) : [], [holderData]);
  const transactions = React.useMemo(() => [...trades].reverse().slice(0, 20), [trades]);
  // 24h change only when we really have a swap at least 24h old; otherwise show nothing.
  const chartChange = React.useMemo(() => {
    if (!spot || !trades.length) return '';
    const cutoff = Math.floor(Date.now() / 1000) - 86400;
    const ref = [...trades].reverse().find(t => t.time <= cutoff);
    if (!ref) return '';
    const ch = ((spot - ref.price) / ref.price) * 100;
    return (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%';
  }, [spot, trades]);

  const handleCopy = () => {
    navigator.clipboard.writeText(TOKEN_CA).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = TOKEN_CA;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  };

  const handleTF = (tf) => setCurrentTF(tf);



  const fmt = (n, d = 6) => {
    if (!n || n <= 0) return (0).toFixed(d);
    if (d === 0) return Math.round(n).toLocaleString();
    if (n >= 1) return n.toFixed(4);
    const s = n.toFixed(12);
    const match = s.match(/^0\.0*/);
    const zeros = match ? match[0].length - 2 : 0;
    const sig = Math.max(4, zeros + 3);
    return n.toFixed(Math.min(sig, 10));
  };
  const truncWallet = (w) => w ? w.slice(0, 4) + '...' + w.slice(-4) : '';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e14', color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace", position: 'relative', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rubik+Mono+One&family=Share+Tech+Mono&display=swap');
        #matrixBg404 { position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden; }
        .matrix-col-404 { position:absolute;top:-100%;color:#7dff7d22;font-size:12px;white-space:pre;line-height:1.4;animation:matrixFall linear infinite;font-family:'Share Tech Mono',monospace; }
        @keyframes matrixFall { to { top:110%; } }
        .scanlines404 { position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:1;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px); }
        .page-content { position:relative;z-index:2; }
        /* Hero */
        .hero404 { max-width:1000px;margin:0 auto;padding:40px 20px 20px; }
        .hero-title404 { font-family:'Rubik Mono One',monospace;font-size:clamp(48px,10vw,96px);color:#7dff7d;text-align:center;margin:0;letter-spacing:4px;
          text-shadow:2px 0 #5fffff,-2px 0 #ff4444,0 0 30px #7dff7d;animation:glitch404 3s infinite; }
        .hero-sub404 { text-align:center;color:#888;font-size:14px;margin-top:8px;letter-spacing:4px; }
        /* Error list */
        .error-list404 { margin:24px auto;max-width:500px;display:flex;flex-direction:column;gap:8px;align-items:center; }
        .error-item404 { display:flex;gap:12px;align-items:center;opacity:0;animation:fadeIn404 0.5s forwards;font-size:13px;justify-content:center; }
        @keyframes fadeIn404 { to { opacity:1; } }
        .error-code404 { color:#ff4444;flex-shrink:0; }
        .error-text404 { color:#888; }
        /* CA */
        .ca-section404 { margin:24px 0; }
        .ca-label404 { font-size:10px;color:#888;margin-bottom:6px;letter-spacing:2px; }
        .ca-box404 { display:flex;align-items:center;gap:8px;background:#0d1219;border:1px solid #1a2a1a;padding:10px 14px;border-radius:2px; }
        .ca-addr404 { font-size:12px;color:#5fffff;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:1px; }
        .copy-btn404 { background:none;border:1px solid #2a3a2a;cursor:pointer;padding:4px 10px;font-size:14px;transition:all 0.2s;color:#7dff7d;flex-shrink:0; }
        .copy-btn404:hover { border-color:#7dff7d;background:rgba(125,255,125,0.1); }
        /* Stats grid */
        .stats-grid404 { display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0; }
        .stat-card404 { background:#0d1219;border:1px solid #1a2a1a;padding:16px;text-align:center;border-radius:2px; }
        .stat-label404 { font-size:10px;color:#888;margin-bottom:6px;letter-spacing:2px; }
        .stat-val404 { font-family:'Rubik Mono One',monospace;font-size:18px;color:#7dff7d; }
        /* Chart */
        .chart-wrap404 { background:#0d1219;border:1px solid #1a2a1a;margin:16px 0;border-radius:2px; }
        .chart-header404 { display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #1a2a1a;flex-wrap:wrap;gap:8px; }
        .chart-pair404 { display:flex;align-items:center;gap:8px;font-size:13px; }
        .chart-pair-name404 { color:#7dff7d;font-family:'Rubik Mono One',monospace; }
        .chart-dot404 { color:#7dff7d;font-size:8px;animation:blink404 1s step-end infinite; }
        @keyframes blink404 { 50% { opacity:0; } }
        .chart-tf-label404 { color:#888;font-size:11px; }
        .chart-price-wrap404 { display:flex;align-items:center;gap:8px; }
        .chart-price404 { color:#7dff7d;font-size:14px; }
        .chart-change404 { font-size:12px;color:#888; }
        .tf-btns404 { display:flex;gap:4px;padding:8px 14px;border-bottom:1px solid #1a2a1a; }
        .tf-btn404 { padding:3px 8px;border:1px solid #1a2a1a;background:transparent;color:#888;cursor:pointer;font-family:'Share Tech Mono',monospace;font-size:11px;transition:all 0.2s; }
        .tf-btn404.active { border-color:#7dff7d;color:#7dff7d; }
        .tf-btn404:hover:not(.active) { border-color:#2a3a2a;color:#e0e0e0; }
        .ohlcv404 { display:flex;flex-wrap:wrap;gap:12px;padding:8px 14px;border-bottom:1px solid #1a2a1a;font-size:11px;color:#888; }
        .ohlcv-val404 { color:#e0e0e0;margin-left:3px; }
        .ohlcv-h404 { color:#7dff7d; }
        .ohlcv-l404 { color:#ff4444; }
        .chart-canvas404 { height:380px;position:relative; }
        .chart-loading404 { z-index:5;color:#aaa !important;max-width:90%;line-height:1.6;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#444;font-size:12px; }
        /* Action buttons */
        .action-btns404 { display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0; }
        .action-btn404 { background:#0d1219;border:1px solid #1a2a1a;padding:14px;text-align:center;cursor:pointer;text-decoration:none;display:block;transition:all 0.2s;border-radius:2px; }
        .action-btn404:hover { border-color:#7dff7d;box-shadow:0 0 10px rgba(125,255,125,0.15); }
        .action-title404 { color:#7dff7d;font-size:13px;margin-bottom:3px; }
        .action-sub404 { color:#888;font-size:10px; }
        /* Feed */
        .feed-section404 { background:#0d1219;border:1px solid #1a2a1a;margin:16px 0;border-radius:2px; }
        .feed-tabs404 { display:flex;border-bottom:1px solid #1a2a1a; }
        .feed-tab404 { padding:10px 20px;background:none;border:none;cursor:pointer;font-family:'Share Tech Mono',monospace;font-size:12px;color:#888;border-bottom:2px solid transparent;transition:all 0.2s; }
        .feed-tab404.active { color:#7dff7d;border-bottom-color:#7dff7d; }
        .feed-header404 { display:grid;padding:8px 14px;font-size:10px;color:#888;border-bottom:1px solid #111;letter-spacing:1px; }
        .txn-header404 { grid-template-columns:80px 60px 1fr 1fr 1fr 80px; }
        .hld-header404 { grid-template-columns:50px 1fr 1fr 80px; }
        .feed-list404 { max-height:300px;overflow-y:auto; }
        .txn-row404 { display:grid;grid-template-columns:80px 60px 1fr 1fr 1fr 80px;padding:7px 14px;font-size:11px;border-bottom:1px solid #0a0e14;transition:background 0.15s; }
        .txn-row404:hover { background:#111; }
        .txn-buy404 { border-left:2px solid #7dff7d; }
        .txn-sell404 { border-left:2px solid #ff4444; }
        .txn-buy-label { color:#7dff7d; }
        .txn-sell-label { color:#ff4444; }
        .hld-row404 { display:grid;grid-template-columns:50px 1fr 1fr 80px;padding:7px 14px;font-size:11px;border-bottom:1px solid #0a0e14; }
        .loading-row404 { padding:20px;text-align:center;color:#444;font-size:12px; }
        /* Token description */
        .token-desc404 { text-align:center;padding:24px 0;border-top:1px solid #1a2a1a;margin-top:16px; }
        .token-intro404 { font-size:14px;color:#888;margin-bottom:8px; }
        .highlight404 { color:#7dff7d; }
        .token-philosophy404 { color:#e0e0e0;font-size:13px;line-height:1.6; }
        /* CTAs */
        .cta-section404 { display:flex;gap:12px;justify-content:center;margin:24px 0;flex-wrap:wrap; }
        .cta-btn404 { padding:14px 32px;font-family:'Share Tech Mono',monospace;font-size:14px;text-decoration:none;cursor:pointer;transition:all 0.2s;border-radius:2px;letter-spacing:1px; }
        .cta-primary404 { border:2px solid #7dff7d;color:#7dff7d;background:transparent; }
        .cta-primary404:hover { background:#7dff7d;color:#0a0e14;box-shadow:0 0 20px rgba(125,255,125,0.4); }
        .cta-secondary404 { border:2px solid #5fffff;color:#5fffff;background:transparent; }
        .cta-secondary404:hover { background:#5fffff;color:#0a0e14;box-shadow:0 0 20px rgba(95,255,255,0.4); }
        /* RP cards */
        .rp-cards404 { display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin:24px auto;max-width:600px; }
        .rp-card404 { background:#0d1219;border:1px solid #1a2a1a;padding:24px;text-align:center;border-radius:2px;transition:all 0.2s; }
        .rp-card404:hover { border-color:#7dff7d;box-shadow:0 0 15px rgba(125,255,125,0.1); }
        .rp-icon404 { font-size:32px;margin-bottom:12px; }
        .rp-title404 { font-family:'Rubik Mono One',monospace;font-size:13px;color:#7dff7d;margin-bottom:8px; }
        .rp-text404 { font-size:11px;color:#888;line-height:1.5; }
        /* Footer */
        .footer404 { border-top:1px solid #1a2a1a;padding:24px 20px;text-align:center;margin-top:40px; }
        .footer-note404 { font-size:11px;color:#444;line-height:1.6;margin-bottom:12px; }
        .footer-links404 { display:flex;gap:16px;justify-content:center; }
        .footer-link404 { color:#888;text-decoration:none;font-size:12px; }
        .footer-link404:hover { color:#7dff7d; }
        /* Modal */
        .modal404 { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px; }
        .modal-content404 { background:#0d1219;border:1px solid #2a3a2a;padding:32px;width:100%;max-width:420px;position:relative;border-radius:2px; }
        .modal-close404 { position:absolute;top:12px;right:16px;background:none;border:none;color:#888;cursor:pointer;font-size:20px; }
        .modal-close404:hover { color:#ff4444; }
        .modal-title404 { font-family:'Rubik Mono One',monospace;color:#7dff7d;font-size:18px;margin-bottom:20px;text-align:center;letter-spacing:3px; }
        .wallet-btns404 { display:flex;flex-direction:column;gap:10px;margin-bottom:16px; }
        .wallet-btn404 { padding:14px 16px;border:1px solid #2a3a2a;background:#111;color:#e0e0e0;cursor:pointer;display:flex;align-items:center;gap:12px;font-family:'Share Tech Mono',monospace;font-size:13px;transition:all 0.2s; }
        .wallet-btn404:hover { border-color:#7dff7d;color:#7dff7d; }
        .wallet-btn404.recommended { border-color:#5fffff;color:#5fffff; }
        .wallet-icon404 { font-size:20px; }
        .form-group404 { margin-bottom:14px; }
        .form-label404 { font-size:10px;color:#888;margin-bottom:5px;display:block;letter-spacing:1px; }
        .form-input404 { width:100%;padding:10px 12px;background:#1a1a2a;border:1px solid #2a2a4a;color:#e0e0e0;font-family:'Share Tech Mono',monospace;font-size:13px;outline:none; }
        .form-input404:focus { border-color:#7dff7d; }
        .submit-btn404 { width:100%;padding:12px;border:2px solid #7dff7d;background:transparent;color:#7dff7d;cursor:pointer;font-family:'Share Tech Mono',monospace;font-size:14px;transition:all 0.2s;margin-top:8px;letter-spacing:1px; }
        .submit-btn404:hover:not(:disabled) { background:#7dff7d;color:#0a0e14; }
        .submit-btn404:disabled { opacity:0.4;cursor:not-allowed; }
        .modal-error404 { color:#ff4444;font-size:11px;margin-top:8px;text-align:center; }
        .warning-txt404 { font-size:10px;color:#ffaa00;margin-bottom:12px;text-align:center; }
        .wallet-note404 { text-align:center;font-size:11px;color:#888;margin-top:8px; }
        .wallet-note404 a { color:#5fffff; }
        /* Floating elements */
        .float-item404 { position:fixed;color:#7dff7d11;font-family:'Rubik Mono One',monospace;font-size:14px;pointer-events:none;z-index:1;animation:floatAnim404 8s ease-in-out infinite; }
        @keyframes floatAnim404 { 0%,100%{transform:translateY(0) rotate(-10deg);opacity:0.3} 50%{transform:translateY(-20px) rotate(10deg);opacity:0.6} }
        @media(max-width:768px){
          .stats-grid404{grid-template-columns:1fr 1fr;}
          .action-btns404{grid-template-columns:1fr 1fr;}
          .rp-cards404{grid-template-columns:1fr 1fr;}
          .txn-row404{grid-template-columns:70px 50px 1fr 1fr;font-size:10px;}
          .txn-header404{grid-template-columns:70px 50px 1fr 1fr;}
        }
        @media(max-width:480px){
          .stats-grid404{grid-template-columns:1fr;}
          .action-btns404{grid-template-columns:1fr 1fr;}
          .chart-canvas404{height:260px;}
        }
      `}</style>


      {/* Matrix BG */}
      <div id="matrixBg404" />
      <div className="scanlines404" />

      {/* Floating items */}
      {[
        { text: '404 ERROR', style: { left: '10%', top: '20%', animationDelay: '0s' } },
        { text: 'X1 SVM', style: { left: '85%', top: '30%', animationDelay: '2s' } },
        { text: '404 ERROR', style: { left: '15%', top: '70%', animationDelay: '4s' } },
        { text: 'X1 SVM', style: { left: '80%', top: '65%', animationDelay: '6s' } },
      ].map((f, i) => <div key={i} className="float-item404" style={f.style}>{f.text}</div>)}

      <div className="page-content">
        {/* Hero */}
        <div className="hero404">
          <h1 className="hero-title404">404 ERROR</h1>
          <p className="hero-sub404">Page Not Found</p>

          <div className="error-list404">
            {[
              ['Error 404 —', 'Roadmap Not Found'],
              ['Error 404 —', 'Utility Not Found'],
              ['Error 404 —', 'Supply Expansion Not Found'],
              ['Error 404 —', 'Guarantees Not Found'],
              ['Error 404 —', 'Not Found'],
            ].map(([code, text], i) => (
              <div key={i} className="error-item404" style={{ animationDelay: `${(i + 1) * 0.1}s` }}>
                <span className="error-code404">{code}</span>
                <span className="error-text404">{text}</span>
              </div>
            ))}
          </div>

          {/* Token Info */}
          <div>
            {/* CA */}
            <div className="ca-section404">
              <div className="ca-label404">CONTRACT ADDRESS (CA)</div>
              <div className="ca-box404">
                <span className="ca-addr404">{TOKEN_CA}</span>
                <button className="copy-btn404" onClick={handleCopy}>{copyDone ? '✅' : '📋'}</button>
              </div>
            </div>

            {/* Stats */}
            <div className="stats-grid404">
              <div className="stat-card404">
                <div className="stat-label404">PRICE XNT</div>
                <div className="stat-val404">{price}</div>
              </div>
              <div className="stat-card404">
                <div className="stat-label404">HOLDERS</div>
                <div className="stat-val404">{holders}</div>
              </div>
              <div className="stat-card404">
                <div className="stat-label404">MARKET CAP XNT</div>
                <div className="stat-val404">{marketCap}</div>
              </div>
            </div>

            {/* Chart */}
            <div className="chart-wrap404">
              <div className="chart-header404">
                <div className="chart-pair404">
                  <span className="chart-pair-name404">WXNT / 404</span>
                  <span className="chart-dot404">●</span>
                  <span className="chart-tf-label404">
                    {currentTF >= 1440 ? '1d' : currentTF >= 240 ? '4h' : currentTF >= 60 ? '1h' : currentTF >= 15 ? '15m' : currentTF >= 5 ? '5m' : '1m'}
                  </span>
                </div>
                <div className="chart-price-wrap404">
                  <span className="chart-price404">{chartPrice}</span>
                  <span className="chart-change404">{chartChange}</span>
                </div>
              </div>

              <div className="tf-btns404">
                {[1, 5, 15, 60, 240, 1440].map(tf => (
                  <button
                    key={tf}
                    className={`tf-btn404${currentTF === tf ? ' active' : ''}`}
                    onClick={() => handleTF(tf)}
                  >
                    {tf === 1440 ? '1d' : tf === 240 ? '4h' : tf === 60 ? '1h' : tf === 15 ? '15m' : tf === 5 ? '5m' : '1m'}
                  </button>
                ))}
                <button
                  className={`tf-btn404${showVol ? ' active' : ''}`}
                  onClick={() => {
                    setShowVol(v => !v);
                  }}
                >
                  Vol
                </button>
              </div>

              <div className="ohlcv404">
                {ohlcv ? (
                  <>
                    <span>O<span className="ohlcv-val404">{fmt(ohlcv.o)}</span></span>
                    <span>H<span className="ohlcv-val404 ohlcv-h404">{fmt(ohlcv.h)}</span></span>
                    <span>L<span className="ohlcv-val404 ohlcv-l404">{fmt(ohlcv.l)}</span></span>
                    <span>C<span className="ohlcv-val404">{fmt(ohlcv.c)}</span></span>
                    <span>Volume <span className="ohlcv-val404">{fmt(ohlcv.v, 0)}</span></span>
                  </>
                ) : (
                  <span style={{ color: '#444' }}>Hover over a candle to see OHLCV</span>
                )}
              </div>

              {(tradeStatus === 'stale' || (tradeStatus === 'ready' && tradeError)) && (
                <div role="status" style={{ padding: '4px 14px', fontSize: 11, color: '#d6a400' }}>
                  {tradeStatus === 'stale' ? 'Showing cached data' : 'Partial data'}{tradeError ? ` (${tradeError})` : ''}
                  {updatedAt ? ` — last updated ${new Date(updatedAt).toLocaleTimeString()}` : ''}{' '}
                  <button className="tf-btn404" onClick={retryTrades}>Retry</button>
                </div>
              )}
              <div className="chart-canvas404">
                <PriceChart trades={trades} tf={currentTF} showVol={showVol} onHover={setOhlcv} />
                {tradeStatus === 'loading' && <div className="chart-loading404">Loading verified swaps from X1 RPC...</div>}
                {tradeStatus === 'empty' && <div className="chart-loading404">No 404/XNT swaps found yet. Nothing is shown rather than invented.</div>}
                {tradeStatus === 'error' && (
                  <div className="chart-loading404" role="alert" style={{ textAlign: 'center' }}>
                    Could not load chart data: {tradeError}<br />
                    <button className="tf-btn404" onClick={retryTrades}>Retry</button>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="action-btns404" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <a href="https://app.bridge.x1.xyz/" target="_blank" rel="noopener noreferrer" className="action-btn404">
                <div className="action-title404">Bridge</div>
                <div className="action-sub404">Solana ↔ X1</div>
              </a>
              <a
                href={`https://app.xdex.xyz/swap?fromTokenAddress=${TOKEN_CA}&toTokenAddress=111111111111111111111111111111111111111111`}
                target="_blank"
                rel="noopener noreferrer"
                className="action-btn404"
              >
                <div className="action-title404">Trade</div>
                <div className="action-sub404">xDEX Swap</div>
              </a>
              <a href="https://xdex.xyz/liquidity" target="_blank" rel="noopener noreferrer" className="action-btn404">
                <div className="action-title404">Liquidity Pool</div>
                <div className="action-sub404">Add/Remove</div>
              </a>
            </div>

            {/* Live Feed */}
            <div className="feed-section404">
              <div className="feed-tabs404">
                <button
                  className={`feed-tab404${feedTab === 'transactions' ? ' active' : ''}`}
                  onClick={() => setFeedTab('transactions')}
                >
                  Transactions
                </button>
                <button
                  className={`feed-tab404${feedTab === 'holders' ? ' active' : ''}`}
                  onClick={() => setFeedTab('holders')}
                >
                  Holders
                </button>
              </div>

              {feedTab === 'transactions' && (
                <>
                  <div className="feed-header404 txn-header404">
                    <div>Time</div><div>Type</div><div>XNT</div><div>404</div><div>Price</div><div>Maker</div>
                  </div>
                  <div className="feed-list404">
                    {transactions.length === 0 && <div className="loading-row404">Loading transactions from X1 RPC...</div>}
                    {transactions.map((tx, i) => (
                      <a
                        key={i}
                        href={`https://explorer.mainnet.x1.xyz/tx/${tx.sig}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`txn-row404 ${tx.side === 'BUY' ? 'txn-buy404' : 'txn-sell404'}`}
                        style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '80px 60px 1fr 1fr 1fr 80px' }}
                      >
                        <span style={{ color: '#666' }}>
                          {new Date(tx.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={tx.side === 'BUY' ? 'txn-buy-label' : 'txn-sell-label'}>
                          {tx.side}
                        </span>
                        <span>{tx.xnt.toFixed(4)}</span>
                        <span>{tx.tok.toFixed(0)}</span>
                        <span style={{ color: '#5fffff' }}>{tx.price.toFixed(6)}</span>
                        <span style={{ color: '#666' }}>{truncWallet(tx.maker)}</span>
                      </a>
                    ))}
                  </div>
                </>
              )}

              {feedTab === 'holders' && (
                <>
                  <div className="feed-header404 hld-header404">
                    <div>Rank</div><div>Wallet</div><div>Balance</div><div>Share</div>
                  </div>
                  <div className="feed-list404">
                    {holderList.length === 0 && <div className="loading-row404">Loading holder data from X1 RPC...</div>}
                    {holderList.map((h, i) => (
                      <a
                        key={i}
                        href={`https://explorer.mainnet.x1.xyz/address/${h.wallet}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hld-row404"
                        style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '50px 1fr 1fr 80px' }}
                      >
                        <span style={{ color: '#888' }}>#{i + 1}</span>
                        <span style={{ color: '#5fffff' }}>{h.label || truncWallet(h.wallet)}</span>
                        <span style={{ color: '#e0e0e0' }}>
                          {Number(h.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        <span style={{ color: '#7dff7d' }}>
                          {supply ? ((h.balance / supply) * 100).toFixed(2) + '%' : ''}
                        </span>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Token description */}
          <div className="token-desc404">
            <p className="token-intro404">
              <span className="highlight404">404 ERROR</span> is a minimal, experimental meme token on{' '}
              <span className="highlight404">X1 SVM</span>.
            </p>
            <p className="token-philosophy404">
              <strong>No Destination. No Direction.</strong><br />
              Only supply, liquidity, and the market.
            </p>
          </div>

          {/* CTAs */}
          <div className="cta-section404">
            <a href={createPageUrl('Chat')} className="cta-btn404 cta-primary404">
              ENTER CHAT
            </a>
            {!user && (
              <button
                className="cta-btn404 cta-primary404"
                onClick={() => window.dispatchEvent(new CustomEvent('open_wallet_modal'))}
                style={{ border: '2px solid #7dff7d', cursor: 'pointer', background: 'transparent' }}
              >
                CONNECT WALLET
              </button>
            )}
          </div>

          {/* RP Cards */}
          <div className="rp-cards404">
            <div className="rp-card404">
              <div className="rp-icon404">⚡</div>
              <div className="rp-title404">Reputation Points</div>
              <p className="rp-text404">Earn RP through chat participation and game progression.</p>
            </div>

            <div className="rp-card404">
              <div className="rp-icon404">🏆</div>
              <div className="rp-title404">Leaderboards</div>
              <p className="rp-text404">Compete in chat activity and game mastery.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="footer404">
          <p className="footer-note404">
            404x1 may integrate blockchain-based rewards in the future.<br />
            Existing accounts, RP, and achievements will remain valid.
          </p>
          <div className="footer-links404">
            <a href="https://x.com/rkbehelvi" target="_blank" rel="noopener noreferrer" className="footer-link404">
              Twitter
            </a>
            <a href="https://t.me/+jpYK0gMfA5o1MGFk" target="_blank" rel="noopener noreferrer" className="footer-link404">
              Telegram
            </a>
            <a href={createPageUrl('Profile')} className="footer-link404">
              Profile
            </a>
          </div>
        </footer>
      </div>

    </div>
  );
}