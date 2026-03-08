import React, { useState, useEffect, useRef } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

async function xdex(endpoint) {
  const res = await base44.functions.invoke('xdexProxy', { endpoint });
  return res.data;
}

const TOKEN_CA = '4o4UheANLdqF4gSV4zWTbCTCercQNSaTm6nVcDetzPb2';
const WXNT_ADDRESS = 'So11111111111111111111111111111111111111112';
const X1_RPC = 'https://rpc.mainnet.x1.xyz/';
const TOTAL_SUPPLY = 404404;
const AUTH_URL = 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/authWallet';

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}
function saveUser(u) { localStorage.setItem('404x1_user', JSON.stringify(u)); }
function clearUser() { localStorage.removeItem('404x1_user'); }

async function rpc(method, params) {
  const res = await fetch(X1_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const d = await res.json();
  return d.result;
}

// FIX 3: helper to read token amount, falling back to raw amount / 10^decimals when uiAmount is null
function getUiAmount(entry) {
  if (!entry?.uiTokenAmount) return 0;
  if (entry.uiTokenAmount.uiAmount != null) return entry.uiTokenAmount.uiAmount;
  const decimals = entry.uiTokenAmount.decimals ?? 9;
  const raw = entry.uiTokenAmount.amount || '0';
  return parseFloat(raw) / Math.pow(10, decimals);
}

function parseTrade(tx) {
  try {
    const pre  = tx.meta?.preTokenBalances  || [];
    const post = tx.meta?.postTokenBalances || [];
    let xntChange = 0, tokChange = 0;
    for (const p of post) {
      const pr = pre.find(x => x.accountIndex === p.accountIndex);
      if (!pr) continue;
      const mint = p.mint;
      const diff = getUiAmount(p) - getUiAmount(pr);
      if (mint === WXNT_ADDRESS) xntChange = diff;
      if (mint === TOKEN_CA)     tokChange = diff;
    }
    if (Math.abs(xntChange) < 0.000001 || Math.abs(tokChange) < 0.000001) return null;
    const price = Math.abs(xntChange / tokChange);
    if (price < 0.0001 || price > 0.1) return null;
    return {
      time:  tx.blockTime,
      xnt:   Math.abs(xntChange),
      tok:   Math.abs(tokChange),
      price,
      side:  xntChange < 0 ? 'SELL' : 'BUY',
      maker: tx.transaction?.message?.accountKeys?.[0]?.pubkey || tx.transaction?.message?.accountKeys?.[0] || ''
    };
  } catch { return null; }
}

const CHART_IFRAME_SRC = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin:0; background:#0a0e14; overflow:hidden; }
  #chart { width:100%; height:100%; }
</style>
</head>
<body>
<div id="chart"></div>
<script>
(async function() {
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Chart library failed to load'));
    document.head.appendChild(s);
  });

  const chart = window.LightweightCharts.createChart(document.getElementById('chart'), {
    width: window.innerWidth,
    height: window.innerHeight,
    layout: { background: { color: '#0a0e14' }, textColor: '#7dff7d' },
    grid: { vertLines: { color: '#1a2a1a' }, horzLines: { color: '#1a2a1a' } },
    crosshair: { mode: 1 },
    timeScale: { borderColor: '#2a3a2a', timeVisible: true, secondsVisible: false },
    rightPriceScale: { borderColor: '#2a3a2a' },
  });
  const candles = chart.addCandlestickSeries({
    upColor: '#7dff7d', downColor: '#ff4444',
    borderUpColor: '#7dff7d', borderDownColor: '#ff4444',
    wickUpColor: '#7dff7d', wickDownColor: '#ff4444',
    lastValueVisible: false,
    priceLineVisible: false,
  });
  let volSeries = null;
  let currentTF = 60;
  let allTrades = [];
  let showVol = false;

  // Remove default price line at 0
  chart.applyOptions({ handleScroll: true, handleScale: true });

  function tradesToCandles(trades, tf) {
    const buckets = {};
    for (const t of trades) {
      const k = Math.floor(t.time / (tf * 60)) * (tf * 60);
      if (!buckets[k]) buckets[k] = { time: k, open: t.price, high: t.price, low: t.price, close: t.price, volume: t.tok };
      else {
        buckets[k].high = Math.max(buckets[k].high, t.price);
        buckets[k].low = Math.min(buckets[k].low, t.price);
        buckets[k].close = t.price;
        buckets[k].volume += t.tok;
      }
    }
    return Object.values(buckets).sort((a,b) => a.time - b.time);
  }

  function render() {
    const c = tradesToCandles(allTrades, currentTF);
    if (c.length) {
      candles.setData(c);
      if (volSeries && showVol) volSeries.setData(c.map(x => ({ time: x.time, value: x.volume, color: x.close >= x.open ? 'rgba(125,255,125,0.3)' : 'rgba(255,68,68,0.3)' })));
    }
  }

  chart.subscribeCrosshairMove(p => {
    if (p.seriesData && p.seriesData.size > 0) {
      const d = p.seriesData.values().next().value;
      if (d) window.parent.postMessage({ type: 'ohlcv', o: d.open, h: d.high, l: d.low, cl: d.close, v: 0 }, '*');
    }
  });

  window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'candles') {
      // Direct OHLCV candles from xDEX chart/history
      const c = (msg.candles || []).filter(x => x.open > 0.000001 && x.close > 0.000001 && x.high > 0.000001);
      if (c.length) {
        candles.setData(c);
        if (volSeries && showVol) volSeries.setData(c.map(x => ({ time: x.time, value: x.volume || 0, color: x.close >= x.open ? 'rgba(125,255,125,0.3)' : 'rgba(255,68,68,0.3)' })));
      }
    } else if (msg.type === 'trades') {
      allTrades = msg.trades || [];
      currentTF = msg.tf || 60;
      render();
    } else if (msg.type === 'setTF') {
      currentTF = msg.tf;
      render();
    } else if (msg.type === 'setVol') {
      showVol = msg.vol;
      if (!volSeries && showVol) {
        volSeries = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol', scaleMargins: { top: 0.8, bottom: 0 } });
      }
      render();
    }
  });

  window.addEventListener('resize', () => chart.applyOptions({ width: window.innerWidth, height: window.innerHeight }));
  window.parent.postMessage({ type: 'chartReady' }, '*');
})();
</script>
</body>
</html>
`;

export default function Home() {
  const [user, setUser] = useState(getUser());
  const [price, setPrice] = useState('Loading...');
  const [holders, setHolders] = useState('Loading...');
  const [marketCap, setMarketCap] = useState('Loading...');
  const [chartPrice, setChartPrice] = useState('Loading...');
  const [chartChange, setChartChange] = useState('');
  const [ohlcv, setOhlcv] = useState({ o: 0, h: 0, l: 0, c: 0, v: 0 });
  const [currentTF, setCurrentTF] = useState(60);
  const [showVol, setShowVol] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [holderList, setHolderList] = useState([]);
  const [feedTab, setFeedTab] = useState('transactions');
  const [copyDone, setCopyDone] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [tempWalletAddress, setTempWalletAddress] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const iframeRef = useRef(null);
  const chartReadyRef = useRef(false);
  const pendingTradesRef = useRef(null);
  const currentPriceRef = useRef(0);

  // Matrix rain
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

  // Listen for chart messages
  useEffect(() => {
    const handler = (e) => {
      const msg = e.data;
      if (msg.type === 'chartReady') {
        chartReadyRef.current = true;
        if (pendingTradesRef.current && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(pendingTradesRef.current, '*');
          pendingTradesRef.current = null;
        }
      } else if (msg.type === 'ohlcv') {
        setOhlcv({ o: msg.o, h: msg.h, l: msg.l, c: msg.cl, v: msg.v });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Unread badge
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem('404x1_conversations') || '[]');
      setUnreadCount(c.reduce((s, x) => s + (x.unread_count || 0), 0));
    } catch {}
  }, []);

  // Deep-scan for output amount regardless of xDEX field naming
  function findOutputAmount(obj, depth = 0) {
    if (depth > 4 || obj == null) return null;
    if (typeof obj === 'number' && obj >= 10 && obj <= 999999) return obj;
    if (typeof obj === 'string') { const n = parseFloat(obj); if (!isNaN(n) && n >= 10 && n <= 999999) return n; }
    if (typeof obj !== 'object') return null;
    const priority = ['estimatedOutputAmount', 'output_amount', 'outputAmount', 'estimated_output_amount', 'result', 'amount', 'out'];
    for (const k of priority) { if (obj[k] != null) { const v = findOutputAmount(obj[k], depth + 1); if (v != null) return v; } }
    for (const k of Object.keys(obj)) { if (priority.includes(k)) continue; const v = findOutputAmount(obj[k], depth + 1); if (v != null) return v; }
    return null;
  }

  const applyPrice = (p) => {
    if (!p || p <= 0) return;
    currentPriceRef.current = p;
    setPrice(p.toFixed(6) + ' XNT');
    setChartPrice(p.toFixed(6));
    const cap = p * TOTAL_SUPPLY;
    if (cap >= 1_000_000) setMarketCap((cap / 1_000_000).toFixed(2) + 'M XNT');
    else if (cap >= 1000) setMarketCap((cap / 1000).toFixed(1) + 'k XNT');
    else setMarketCap(cap.toFixed(2) + ' XNT');
  };

  // Fetch price via backend proxy (avoids CORS)
  const fetchPrice = async () => {
    try {
      const d1 = await xdex(`/api/token-price/price?network=X1 Mainnet&token_address=${TOKEN_CA}`);
      const p1 = parseFloat(d1.data?.price || d1.price || d1.usdPrice || 0);
      if (p1 > 0) {
        applyPrice(p1);
        const ch = d1.change_24h ?? d1.data?.change_24h;
        if (ch != null) {
          setChartChange((ch >= 0 ? '+' : '') + parseFloat(ch).toFixed(2) + '%');
        }
        return;
      }
    } catch {}
    try {
      const d2 = await xdex(`/api/xendex/swap/quote?network=X1%20Mainnet&token_in=${WXNT_ADDRESS}&token_out=${TOKEN_CA}&token_in_amount=1`);
      const out2 = findOutputAmount(d2);
      if (out2 && out2 > 0) { applyPrice(1 / out2); }
    } catch (e) {
      console.warn('Price fetch failed:', e.message);
    }
  };

  // Fetch chart data from X1 RPC
  const fetchTrades = async () => {
    fetchTradesFromRpc();
  };

  const fetchTradesFromRpc = async () => {
    const cacheKey = 'chart_trades_cache';
    const cacheTs = 'chart_trades_ts';
    const now = Date.now();
    const cached = localStorage.getItem(cacheKey);
    const ts = parseInt(localStorage.getItem(cacheTs) || '0');
    if (cached && now - ts < 5 * 60 * 1000) {
      const trades = JSON.parse(cached);
      sendTradesToChart(trades);
      buildTransactions(trades);
      return;
    }
    try {
      const sigs = await rpc('getSignaturesForAddress', [TOKEN_CA, { limit: 200 }]);
      if (!sigs?.length) return;
      const trades = [];
      for (let i = 0; i < Math.min(sigs.length, 100); i += 10) {
        const batch = sigs.slice(i, i + 10);
        const txs = await Promise.all(batch.map(s =>
          rpc('getTransaction', [s.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }])
        ));
        for (const tx of txs) {
          if (!tx) continue;
          const t = parseTrade(tx);
          if (t) trades.push(t);
        }
      }
      trades.sort((a, b) => a.time - b.time);
      localStorage.setItem(cacheKey, JSON.stringify(trades));
      localStorage.setItem(cacheTs, String(now));
      sendTradesToChart(trades);
      buildTransactions(trades);
    } catch (e) {
      console.warn('RPC trades fetch failed:', e.message);
    }
  };

  const sendCandlesToChart = (candles) => {
    const msg = { type: 'candles', candles, tf: currentTF };
    if (chartReadyRef.current && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(msg, '*');
    } else {
      pendingTradesRef.current = msg;
    }
  };

  const sendTradesToChart = (trades) => {
    const msg = { type: 'trades', trades, tf: currentTF };
    if (chartReadyRef.current && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(msg, '*');
    } else {
      pendingTradesRef.current = msg;
    }
  };

  const buildTransactions = (trades) => {
    setTransactions([...trades].reverse().slice(0, 50));
  };

  // FIX 2: Fetch holders — query both legacy SPL and Token-2022 programs
  const fetchHolders = async () => {
    try {
      const LEGACY = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
      const T2022  = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
      const [legacyRes, t2022Res] = await Promise.all([
        rpc('getProgramAccounts', [LEGACY, {
          encoding: 'jsonParsed',
          filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: TOKEN_CA } }]
        }]).catch(() => []),
        rpc('getProgramAccounts', [T2022, {
          encoding: 'jsonParsed',
          filters: [{ memcmp: { offset: 0, bytes: TOKEN_CA } }]
        }]).catch(() => []),
      ]);
      const combined = [...(legacyRes || []), ...(t2022Res || [])];
      if (!combined.length) { setHolders('N/A'); return; }
      const accts = combined
        .map(a => ({
          wallet: a.account?.data?.parsed?.info?.owner || a.pubkey,
          tokenAccount: a.pubkey,
          balance: a.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0
        }))
        .filter(a => a.balance > 0)
        .sort((a, b) => b.balance - a.balance);
      setHolders(accts.length.toLocaleString());
      setHolderList(accts.slice(0, 50));
    } catch (e) {
      console.warn('Holders fetch failed:', e.message);
      setHolders('N/A');
    }
  };

  useEffect(() => {
    fetchPrice();
    fetchTrades();
    fetchHolders();
    const priceInt = setInterval(fetchPrice, 30000);
    const tradesInt = setInterval(fetchTrades, 60000);
    return () => { clearInterval(priceInt); clearInterval(tradesInt); };
  }, []);

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

  const handleTF = (tf) => {
    setCurrentTF(tf);
    iframeRef.current?.contentWindow?.postMessage({ type: 'setTF', tf }, '*');
  };

  const detectWallets = () => ({
    x1: typeof window.x1Wallet !== 'undefined',
    phantom: typeof window.phantom?.solana !== 'undefined',
    backpack: typeof window.backpack !== 'undefined',
    metamask: typeof window.ethereum !== 'undefined',
  });

  const connectWallet = async (walletType) => {
    setConnecting(true);
    setShowWalletModal(false);
    try {
      let address;
      if (walletType === 'x1') {
        const res = await window.x1Wallet.connect();
        address = res.publicKey.toString();
      } else if (walletType === 'phantom') {
        const res = await window.phantom.solana.connect();
        address = res.publicKey.toString();
      } else if (walletType === 'backpack') {
        const res = await window.backpack.connect();
        address = res.publicKey.toString();
      } else if (walletType === 'metamask') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        address = accounts[0];
      }
      setTempWalletAddress(address);
      await attemptAuth(address, 'temp_check_wallet');
    } catch (err) {
      console.error('Wallet connect error:', err);
    }
    setConnecting(false);
  };

  const attemptAuth = async (address, username) => {
    try {
      const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: address, username })
      });
      const data = await res.json();
      if (data.success) {
        const u = data.player || data.user;
        saveUser(u);
        setUser(u);
        setShowUsernameModal(false);
      } else if (data.error && (
        data.error.includes('Username must be') ||
        data.error.includes('Username already taken') ||
        data.error.includes('Invalid username') ||
        data.error.includes('already exists') ||
        data.error.includes('taken')
      )) {
        setShowUsernameModal(true);
      } else if (data.error && data.error.includes('temp_check_wallet')) {
        setShowUsernameModal(true);
      } else {
        // Any auth error on temp_check means new user
        setShowUsernameModal(true);
      }
    } catch (err) {
      console.error('Auth error:', err);
    }
  };

  const submitUsername = async () => {
    const reserved = ['admin','mod','moderator','system','bot','null','undefined'];
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(usernameInput)) {
      setUsernameError('3-16 characters, letters/numbers/underscore only');
      return;
    }
    if (reserved.includes(usernameInput.toLowerCase())) {
      setUsernameError('This username is reserved. Please choose another.');
      return;
    }
    setUsernameError('');
    await attemptAuth(tempWalletAddress, usernameInput);
  };

  const logout = () => {
    clearUser();
    setUser(null);
  };

  const fmt = (n, d = 6) => (n || 0).toFixed(d);
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
        .chart-loading404 { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#444;font-size:12px; }

        /* Action buttons */
        .action-btns404 { display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0; }
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
        .rp-cards404 { display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:24px 0; }
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
          .rp-cards404{grid-template-columns:1fr;}
          .nav-links404{display:none;}
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
                  <span className="chart-tf-label404">{currentTF >= 1440 ? '1d' : currentTF >= 240 ? '4h' : currentTF >= 60 ? '1h' : currentTF >= 15 ? '15m' : currentTF >= 5 ? '5m' : '1m'}</span>
                </div>
                <div className="chart-price-wrap404">
                  <span className="chart-price404">{chartPrice}</span>
                  <span className="chart-change404">{chartChange}</span>
                </div>
              </div>
              <div className="tf-btns404">
                {[1, 5, 15, 60, 240, 1440].map(tf => (
                  <button key={tf} className={`tf-btn404${currentTF === tf ? ' active' : ''}`} onClick={() => handleTF(tf)}>
                    {tf === 1440 ? '1d' : tf === 240 ? '4h' : tf === 60 ? '1h' : tf === 15 ? '15m' : tf === 5 ? '5m' : '1m'}
                  </button>
                ))}
                <button className={`tf-btn404${showVol ? ' active' : ''}`} onClick={() => { const next = !showVol; setShowVol(next); iframeRef.current?.contentWindow?.postMessage({ type: 'setVol', vol: next }, '*'); }}>Vol</button>
              </div>
              <div className="ohlcv404">
                <span>O<span className="ohlcv-val404">{fmt(ohlcv.o)}</span></span>
                <span>H<span className="ohlcv-val404 ohlcv-h404">{fmt(ohlcv.h)}</span></span>
                <span>L<span className="ohlcv-val404 ohlcv-l404">{fmt(ohlcv.l)}</span></span>
                <span>C<span className="ohlcv-val404">{fmt(ohlcv.c)}</span></span>
                <span>Volume <span className="ohlcv-val404">{fmt(ohlcv.v, 0)}</span></span>
              </div>
              <div className="chart-canvas404">
                <div className="chart-loading404">Loading chart data from X1 RPC...</div>
                <iframe
                  ref={iframeRef}
                  sandbox="allow-scripts allow-same-origin"
                  srcDoc={CHART_IFRAME_SRC}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="action-btns404" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <a href="https://app.bridge.x1.xyz/" target="_blank" rel="noopener noreferrer" className="action-btn404">
                <div className="action-title404">Bridge</div>
                <div className="action-sub404">Solana ↔ X1</div>
              </a>
              <a href={`https://app.xdex.xyz/swap?fromTokenAddress=${TOKEN_CA}&toTokenAddress=111111111111111111111111111111111111111111`} target="_blank" rel="noopener noreferrer" className="action-btn404">
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
                <button className={`feed-tab404${feedTab === 'transactions' ? ' active' : ''}`} onClick={() => setFeedTab('transactions')}>Transactions</button>
                <button className={`feed-tab404${feedTab === 'holders' ? ' active' : ''}`} onClick={() => setFeedTab('holders')}>Holders</button>
              </div>

              {feedTab === 'transactions' && (
                <>
                  <div className="feed-header404 txn-header404">
                    <div>Time</div><div>Type</div><div>XNT</div><div>404</div><div>Price</div><div>Maker</div>
                  </div>
                  <div className="feed-list404">
                    {transactions.length === 0 && <div className="loading-row404">Loading transactions from X1 RPC...</div>}
                    {transactions.map((tx, i) => (
                      <div key={i} className={`txn-row404 ${tx.side === 'BUY' ? 'txn-buy404' : 'txn-sell404'}`}>
                        <span style={{ color: '#666' }}>{new Date(tx.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className={tx.side === 'BUY' ? 'txn-buy-label' : 'txn-sell-label'}>{tx.side}</span>
                        <span>{tx.xnt.toFixed(4)}</span>
                        <span>{tx.tok.toFixed(0)}</span>
                        <span style={{ color: '#5fffff' }}>{tx.price.toFixed(6)}</span>
                        <span style={{ color: '#666' }}>{truncWallet(tx.maker)}</span>
                      </div>
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
                    {holderList.length === 0 && <div className="loading-row404">Loading holder data from xDEX...</div>}
                    {holderList.map((h, i) => (
                      <div key={i} className="hld-row404">
                        <span style={{ color: '#888' }}>#{i + 1}</span>
                        <span style={{ color: '#5fffff' }}>{h.label || truncWallet(h.wallet)}</span>
                        <span style={{ color: '#e0e0e0' }}>{Number(h.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        <span style={{ color: '#7dff7d' }}>{((h.balance / TOTAL_SUPPLY) * 100).toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Token description */}
          <div className="token-desc404">
            <p className="token-intro404"><span className="highlight404">404 ERROR</span> is a minimal, experimental meme token on <span className="highlight404">X1 SVM</span>.</p>
            <p className="token-philosophy404"><strong>No Destination. No Direction.</strong><br />Only supply, liquidity, and the market.</p>
          </div>

          {/* CTAs */}
          <div className="cta-section404">
            <a href={createPageUrl('Chat')} className="cta-btn404 cta-primary404">ENTER CHAT</a>
            {!user && <button className="cta-btn404 cta-primary404" onClick={() => setShowWalletModal(true)} style={{border:'2px solid #7dff7d',cursor:'pointer',background:'transparent'}}>CONNECT WALLET</button>}
          <a href={createPageUrl('Game')} className="cta-btn404 cta-secondary404">PLAY GAME</a>
          </div>

          {/* RP Cards */}
          <div className="rp-cards404">
            <div className="rp-card404">
              <div className="rp-icon404">⚡</div>
              <div className="rp-title404">Reputation Points</div>
              <p className="rp-text404">Earn RP through chat participation and game progression.</p>
            </div>
            <div className="rp-card404">
              <div className="rp-icon404">🎮</div>
              <div className="rp-title404">Runner Game</div>
              <p className="rp-text404">Dodge enemies, collect tokens, score points. Submit for RP.</p>
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
          <p className="footer-note404">404x1 may integrate blockchain-based rewards in the future.<br />Existing accounts, RP, and achievements will remain valid.</p>
          <div className="footer-links404">
            <a href="https://x.com/rkbehelvi" target="_blank" rel="noopener noreferrer" className="footer-link404">Twitter</a>
            <a href="https://t.me/+jpYK0gMfA5o1MGFk" target="_blank" rel="noopener noreferrer" className="footer-link404">Telegram</a>
            <a href={createPageUrl('Profile')} className="footer-link404">Profile</a>
          </div>
        </footer>
      </div>

      {/* Auth Modal */}
      {showModal && (
        <div className="modal404" onClick={(e) => { if (e.target.className === 'modal404') setShowModal(false); }}>
          <div className="modal-content404">
            <button className="modal-close404" onClick={() => setShowModal(false)}>×</button>

            {modalStep === 'wallets' && (
              <>
                <div className="modal-title404">CONNECT WALLET</div>
                <div className="wallet-btns404">
                  <button className="wallet-btn404 recommended" onClick={() => connectWallet('x1')} disabled={authLoading}>
                    <span className="wallet-icon404">⭐</span><span>X1 Wallet (Recommended)</span>
                  </button>
                  <button className="wallet-btn404" onClick={() => connectWallet('phantom')} disabled={authLoading}>
                    <span className="wallet-icon404">👻</span><span>Phantom Wallet</span>
                  </button>
                  <button className="wallet-btn404" onClick={() => connectWallet('backpack')} disabled={authLoading}>
                    <span className="wallet-icon404">🎒</span><span>Backpack Wallet</span>
                  </button>
                  <button className="wallet-btn404" onClick={() => connectWallet('metamask')} disabled={authLoading}>
                    <span className="wallet-icon404">🦊</span><span>MetaMask</span>
                  </button>
                </div>
                {authLoading && <div style={{ textAlign: 'center', color: '#7dff7d', fontSize: '12px' }}>Connecting...</div>}
                {authError && <div className="modal-error404">⚠ {authError}</div>}
                <div className="wallet-note404">
                  No X1 Wallet? <a href="https://chromewebstore.google.com/detail/kcfmcpdmlchhbikbogddmgopmjbflnae" target="_blank" rel="noopener noreferrer">Install Here</a>
                </div>
              </>
            )}

            {modalStep === 'username' && (
              <>
                <div className="modal-title404">SET USERNAME</div>
                <div className="warning-txt404">⚠️ Username is PERMANENT and cannot be changed!</div>
                <div className="form-group404">
                  <label className="form-label404">CHAT NAME (3-16 chars, permanent)</label>
                  <input className="form-input404" type="text" placeholder="username" value={chatName} onChange={e => setChatName(e.target.value)} maxLength={16} />
                </div>
                <div className="form-group404">
                  <label className="form-label404">GAME NAME (3-16 chars, permanent)</label>
                  <input className="form-input404" type="text" placeholder="playername (leave blank = same as chat)" value={gameName} onChange={e => setGameName(e.target.value)} maxLength={16} />
                </div>
                <button className="submit-btn404" onClick={confirmUsername} disabled={authLoading}>
                  {authLoading ? 'CREATING...' : 'CONFIRM & LOCK USERNAME'}
                </button>
                {authError && <div className="modal-error404">⚠ {authError}</div>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}