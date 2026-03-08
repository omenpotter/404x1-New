import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const AUTH_URL = 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/authWallet';

function getCurrentUser() {
  try {
    const s = localStorage.getItem('404x1_user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // ── Wallet modal state ───────────────────────────────────────────────────
  const [showWalletModal, setShowWalletModal]     = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [tempAddress, setTempAddress]             = useState('');
  const [usernameInput, setUsernameInput]         = useState('');
  const [usernameError, setUsernameError]         = useState('');
  const [authStatus, setAuthStatus]               = useState(''); // 'connecting' | 'checking' | ''
  const [authError, setAuthError]                 = useState('');
  // ────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setUser(getCurrentUser());
    try {
      const convs = JSON.parse(localStorage.getItem('404x1_conversations') || '[]');
      setUnread(convs.reduce((acc, c) => acc + (c.unread_count || 0), 0));
    } catch {}
    const onAuth = () => setUser(getCurrentUser());
    window.addEventListener('storage', onAuth);
    window.addEventListener('userAuthChanged', onAuth);

    // Listen for open_wallet_modal event fired from nav CONNECT button
    // and from any page (e.g. Chat "Connect wallet to participate" link)
    const onOpenModal = () => setShowWalletModal(true);
    window.addEventListener('open_wallet_modal', onOpenModal);

    return () => {
      window.removeEventListener('storage', onAuth);
      window.removeEventListener('userAuthChanged', onAuth);
      window.removeEventListener('open_wallet_modal', onOpenModal);
    };
  }, [currentPageName]);

  const logout = () => {
    localStorage.removeItem('404x1_user');
    setUser(null);
    window.dispatchEvent(new Event('userAuthChanged'));
    window.location.href = createPageUrl('Home');
  };

  const isMod = user && ['moderator', 'admin', 'superuser'].includes(user.user_role);

  const navLinks = [
    { name: 'Home',           page: 'Home',           label: 'HOME'    },
    { name: 'Chat',           page: 'Chat',           label: 'CHAT'    },
    { name: 'Game',           page: 'Game',           label: 'GAME'    },
    { name: 'Leaderboard',   page: 'Leaderboard',   label: 'RANKS'   },
    { name: 'Messages',      page: 'Messages',      label: 'DMs'     },
    { name: 'Profile',       page: 'Profile',       label: 'PROFILE' },
    { name: 'Docs',          page: 'Docs',          label: 'DOCS'    },
    ...(isMod ? [
      { name: 'ModPanel',        page: 'ModPanel',        label: 'MOD'  },
      { name: 'ModerationLogs', page: 'ModerationLogs', label: 'LOGS' },
    ] : []),
  ];

  // ── WALLET CONNECT ───────────────────────────────────────────────────────
  //
  // RULE: wallet.connect() must be the VERY FIRST await inside the handler.
  // Browser extensions check that the call happens within the same synchronous
  // call stack as the user click. Any setState() or async work BEFORE .connect()
  // causes the browser to lose "user gesture" context → popup is silently blocked.
  //
  // Pattern:
  //   1. call .connect()  ← first thing, no setState before it
  //   2. get address back
  //   3. THEN update state, close modal, call backend
  // ────────────────────────────────────────────────────────────────────────

  const connectWallet = async (walletType) => {
    // Reset errors — these are simple synchronous setState, fine before connect
    setAuthError('');
    setAuthStatus('connecting');

    let address = '';
    try {
      // ── STEP 1: .connect() fires FIRST — before any modal state changes ──
      if (walletType === 'x1') {
        if (typeof window.x1Wallet === 'undefined') {
          setAuthError('X1 Wallet not installed. Click the link below to install.');
          setAuthStatus('');
          return;
        }
        const res = await window.x1Wallet.connect();
        address = res.publicKey.toString();

      } else if (walletType === 'phantom') {
        if (!window.phantom?.solana) {
          setAuthError('Phantom not installed.');
          setAuthStatus('');
          return;
        }
        const res = await window.phantom.solana.connect();
        address = res.publicKey.toString();

      } else if (walletType === 'backpack') {
        if (typeof window.backpack === 'undefined') {
          setAuthError('Backpack not installed.');
          setAuthStatus('');
          return;
        }
        const res = await window.backpack.connect();
        address = res.publicKey.toString();

      } else if (walletType === 'metamask') {
        if (typeof window.ethereum === 'undefined') {
          setAuthError('MetaMask not installed.');
          setAuthStatus('');
          return;
        }
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        address = accounts[0];
      }

      if (!address) {
        setAuthError('Could not get wallet address. Please try again.');
        setAuthStatus('');
        return;
      }

      // ── STEP 2: wallet connected — NOW close modal and hit backend ──
      setShowWalletModal(false);
      setTempAddress(address);
      setAuthStatus('checking');

      await checkWalletWithBackend(address);

    } catch (err) {
      // User rejected or extension error
      setAuthError(err.message || 'Connection cancelled or failed. Try again.');
      setAuthStatus('');
    }
  };

  const checkWalletWithBackend = async (walletAddress) => {
    try {
      const res  = await fetch(AUTH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ wallet_address: walletAddress }),
      });
      const data = await res.json();

      if (data.success && !data.is_new_user) {
        // Existing user → log in immediately
        const u = data.user || data.player;
        localStorage.setItem('404x1_user', JSON.stringify(u));
        setUser(u);
        setAuthStatus('');
        window.dispatchEvent(new Event('userAuthChanged'));

      } else if (data.is_new_user) {
        // New wallet → ask for username
        setAuthStatus('');
        setShowUsernameModal(true);

      } else {
        setAuthError(data.error || 'Authentication failed. Try again.');
        setAuthStatus('');
        setShowWalletModal(true);
      }
    } catch (err) {
      setAuthError(err.message || 'Server error. Please try again.');
      setAuthStatus('');
      setShowWalletModal(true);
    }
  };

  const submitUsername = async () => {
    const reserved = ['admin', 'mod', 'moderator', 'system', 'bot', 'null', 'undefined'];
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(usernameInput)) {
      setUsernameError('3–16 characters, letters/numbers/underscore only');
      return;
    }
    if (reserved.includes(usernameInput.toLowerCase())) {
      setUsernameError('That username is reserved.');
      return;
    }
    setUsernameError('');
    if (!tempAddress) {
      setUsernameError('Session lost. Please connect your wallet again.');
      return;
    }
    try {
      const res  = await fetch(AUTH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ wallet_address: tempAddress, username: usernameInput }),
      });
      const data = await res.json();
      if (data.success) {
        const u = data.user || data.player;
        localStorage.setItem('404x1_user', JSON.stringify(u));
        setUser(u);
        setShowUsernameModal(false);
        setUsernameInput('');
        window.dispatchEvent(new Event('userAuthChanged'));
      } else {
        setUsernameError(data.error || 'Registration failed. Try again.');
      }
    } catch (err) {
      setUsernameError(err.message || 'Server error. Please try again.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', color: 'var(--text)', fontFamily: "'Share Tech Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rubik+Mono+One&family=Share+Tech+Mono&display=swap');
        :root {
          --green: #7dff7d; --cyan: #5fffff; --dark: #0a0a0a; --dark2: #111111;
          --dark3: #1a1a1a; --dark4: #222222; --border: #2a2a2a; --text: #e0e0e0;
          --text-dim: #888888; --red: #ff4444; --orange: #ffaa00; --purple: #aa44ff;
        }
        * { box-sizing: border-box; }
        body { background: var(--dark) !important; }
        body::before {
          content: ''; position: fixed; top:0;left:0;right:0;bottom:0;
          background: repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.06) 2px,rgba(0,0,0,0.06) 4px);
          pointer-events:none; z-index:9999;
        }
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:var(--dark2)}
        ::-webkit-scrollbar-thumb{background:var(--green);border-radius:2px}
        .nav-404 {
          position:sticky;top:0;z-index:1000;background:rgba(10,10,10,0.95);
          border-bottom:1px solid var(--border);padding:0 20px;
          display:flex;align-items:center;justify-content:space-between;
          height:54px;backdrop-filter:blur(10px);
        }
        .nav-logo { font-family:'Rubik Mono One',monospace;font-size:22px;color:var(--green);text-decoration:none;letter-spacing:2px;text-shadow:0 0 10px var(--green); }
        .nav-links { display:flex;gap:4px;align-items:center; }
        .nav-link { padding:6px 12px;color:var(--text-dim);text-decoration:none;font-size:12px;border:1px solid transparent;transition:all 0.2s;font-family:'Share Tech Mono',monospace;position:relative; }
        .nav-link:hover,.nav-link.active { color:var(--green);border-color:var(--border); }
        .nav-link.active { color:var(--green);border-color:var(--green); }
        .nav-link[data-page="ModPanel"] { color:var(--red) !important; }
        .nav-link[data-page="ModPanel"]:hover,.nav-link[data-page="ModPanel"].active { border-color:var(--red) !important; }
        .nav-right { display:flex;align-items:center;gap:12px; }
        .nav-user { font-size:11px;color:var(--text-dim); }
        .nav-rp { color:var(--green);font-size:12px; }
        .nav-btn { padding:5px 12px;border:1px solid var(--green);background:transparent;color:var(--green);cursor:pointer;font-size:11px;font-family:'Share Tech Mono',monospace;transition:all 0.2s; }
        .nav-btn:hover { background:var(--green);color:var(--dark); }
        .dm-badge { background:var(--green);color:var(--dark);border-radius:50%;width:16px;height:16px;font-size:9px;display:inline-flex;align-items:center;justify-content:center;position:absolute;top:2px;right:2px; }
        .hamburger { display:none;flex-direction:column;gap:4px;cursor:pointer;background:none;border:none; }
        .hamburger span { width:20px;height:2px;background:var(--green);display:block; }
        .mobile-menu { display:none;position:fixed;top:54px;left:0;right:0;background:rgba(10,10,10,0.98);border-bottom:1px solid var(--border);flex-direction:column;padding:12px;z-index:999; }
        .mobile-menu.open { display:flex; }
        .mobile-nav-link { padding:12px 16px;color:var(--text-dim);text-decoration:none;font-size:14px;border-bottom:1px solid var(--border);font-family:'Share Tech Mono',monospace; }
        .mobile-nav-link:hover,.mobile-nav-link.active { color:var(--green); }
        @media(max-width:768px) { .nav-links{display:none;} .hamburger{display:flex;} .nav-right .nav-user{display:none;} }
        @keyframes glitch { 0%{text-shadow:2px 0 #5fffff,-2px 0 #ff4444} 25%{text-shadow:-2px 0 #5fffff,2px 0 #ff4444} 50%{text-shadow:2px 2px #5fffff,-2px -2px #ff4444} 75%{text-shadow:0 0 0} 100%{text-shadow:2px 0 #5fffff,-2px 0 #ff4444} }
        .wallet-overlay { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.92);z-index:2000;display:flex;align-items:center;justify-content:center; }
        .wallet-box { background:#111;border:2px solid var(--green);padding:32px;width:100%;max-width:420px;font-family:'Share Tech Mono',monospace; }
        .wallet-title { font-family:'Rubik Mono One',monospace;color:var(--green);font-size:20px;letter-spacing:3px;margin-bottom:24px;text-align:center; }
        .wallet-btn { width:100%;background:transparent;border:1px solid #444;color:var(--text);padding:14px 20px;cursor:pointer;font-family:'Share Tech Mono',monospace;font-size:14px;text-align:left;margin-bottom:10px;transition:all 0.2s;display:flex;align-items:center;justify-content:space-between; }
        .wallet-btn:hover { border-color:var(--green);color:var(--green); }
        .wallet-btn.primary { background:linear-gradient(135deg,rgba(125,255,125,0.12),rgba(125,255,125,0.06));border-color:var(--green);color:var(--green); }
        .wallet-status { text-align:center;color:var(--green);font-size:12px;margin-top:12px; }
        .wallet-error { margin-top:12px;padding:10px 14px;background:rgba(255,68,68,0.08);border:1px solid var(--red);color:var(--red);font-size:12px;text-align:center; }
        .wallet-cancel { background:transparent;border:none;color:#555;padding:14px;width:100%;margin-top:4px;cursor:pointer;font-family:'Share Tech Mono',monospace;font-size:12px; }
        .wallet-cancel:hover { color:#888; }
        .install-link { color:var(--green);display:block;margin-top:6px; }
      `}</style>

      {/* Navbar */}
      <nav className="nav-404">
        <Link to={createPageUrl('Home')} className="nav-logo">404x1</Link>

        <div className="nav-links">
          {navLinks.map(l => (
            <Link key={l.page} to={createPageUrl(l.page)}
              className={`nav-link${currentPageName === l.page ? ' active' : ''}`}
              data-page={l.page}>
              {l.label}
              {l.page === 'Messages' && unread > 0 && (
                <span className="dm-badge">{unread > 9 ? '9+' : unread}</span>
              )}
            </Link>
          ))}
        </div>

        <div className="nav-right">
          {user ? (
            <>
              <span className="nav-user">{user.username || user.chat_username}</span>
              <span className="nav-rp">{(user.reputation_points || 0).toLocaleString()} RP</span>
              <button className="nav-btn" onClick={logout}>LOGOUT</button>
            </>
          ) : (
            <button className="nav-btn" onClick={() => { setAuthError(''); setShowWalletModal(true); }}>
              CONNECT
            </button>
          )}
          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
            <span/><span/><span/>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        {navLinks.map(l => (
          <Link key={l.page} to={createPageUrl(l.page)}
            className={`mobile-nav-link${currentPageName === l.page ? ' active' : ''}`}
            onClick={() => setMenuOpen(false)}>
            {l.label} {l.page === 'Messages' && unread > 0 ? `(${unread})` : ''}
          </Link>
        ))}
        {user ? (
          <button className="mobile-nav-link" style={{background:'none',border:'none',textAlign:'left',cursor:'pointer',color:'var(--red)'}} onClick={logout}>LOGOUT</button>
        ) : (
          <button className="mobile-nav-link" style={{background:'none',border:'none',textAlign:'left',cursor:'pointer',color:'var(--green)'}}
            onClick={() => { setMenuOpen(false); setAuthError(''); setShowWalletModal(true); }}>
            CONNECT WALLET
          </button>
        )}
      </div>

      {/* Page content */}
      <main>{children}</main>

      {/* ── WALLET MODAL ─────────────────────────────────────────────────────── */}
      {showWalletModal && (
        <div className="wallet-overlay" onClick={() => setShowWalletModal(false)}>
          <div className="wallet-box" onClick={e => e.stopPropagation()}>
            <div className="wallet-title">CONNECT WALLET</div>

            {/* X1 Wallet — recommended */}
            <button className="wallet-btn primary" onClick={() => connectWallet('x1')}>
              <span>⭐ X1 Wallet</span>
              <span style={{background:'var(--green)',color:'#0a0a0a',padding:'2px 8px',fontSize:'10px',fontWeight:'bold'}}>RECOMMENDED</span>
            </button>

            <button className="wallet-btn" onClick={() => connectWallet('phantom')}>
              👻 Phantom
            </button>

            <button className="wallet-btn" onClick={() => connectWallet('backpack')}>
              🎒 Backpack
            </button>

            <button className="wallet-btn" onClick={() => connectWallet('metamask')}>
              🦊 MetaMask
            </button>

            {authStatus === 'connecting' && (
              <div className="wallet-status">Opening wallet... check your extension popup</div>
            )}

            {authError && (
              <div className="wallet-error">
                ⚠ {authError}
                {authError.includes('X1') && (
                  <a className="install-link" href="https://chromewebstore.google.com/detail/kcfmcpdmlchhbikbogddmgopmjbflnae" target="_blank" rel="noopener noreferrer">
                    Install X1 Wallet →
                  </a>
                )}
                {authError.includes('Phantom') && (
                  <a className="install-link" href="https://phantom.app" target="_blank" rel="noopener noreferrer">Install Phantom →</a>
                )}
                {authError.includes('Backpack') && (
                  <a className="install-link" href="https://www.backpack.app" target="_blank" rel="noopener noreferrer">Install Backpack →</a>
                )}
                {authError.includes('MetaMask') && (
                  <a className="install-link" href="https://metamask.io" target="_blank" rel="noopener noreferrer">Install MetaMask →</a>
                )}
              </div>
            )}

            <div style={{textAlign:'center',fontSize:'11px',color:'#555',marginTop:'14px'}}>
              No X1 Wallet?{' '}
              <a href="https://chromewebstore.google.com/detail/kcfmcpdmlchhbikbogddmgopmjbflnae" target="_blank" rel="noopener noreferrer" style={{color:'var(--green)'}}>
                Install Here
              </a>
            </div>

            <button className="wallet-cancel" onClick={() => setShowWalletModal(false)}>CANCEL</button>
          </div>
        </div>
      )}

      {/* ── USERNAME MODAL ──────────────────────────────────────────────────── */}
      {showUsernameModal && (
        <div className="wallet-overlay">
          <div className="wallet-box">
            <div className="wallet-title">SET USERNAME</div>
            <div style={{color:'var(--orange)',fontSize:'11px',textAlign:'center',marginBottom:'20px'}}>
              ⚠️ Username is PERMANENT and cannot be changed!
            </div>

            <label style={{fontSize:'10px',color:'#888',display:'block',marginBottom:'6px',letterSpacing:'1px'}}>
              USERNAME (3–16 chars, letters/numbers/underscore)
            </label>
            <input
              type="text"
              placeholder="your_username"
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitUsername()}
              maxLength={16}
              autoFocus
              style={{
                width:'100%',padding:'10px 12px',background:'#1a1a2a',
                border:'1px solid #2a2a4a',color:'var(--text)',
                fontFamily:"'Share Tech Mono',monospace",fontSize:'13px',
                outline:'none',boxSizing:'border-box',marginBottom:'10px',
              }}
            />

            {usernameError && (
              <div style={{color:'var(--red)',fontSize:'11px',marginBottom:'12px'}}>
                ⚠ {usernameError}
              </div>
            )}

            <button
              onClick={submitUsername}
              style={{
                width:'100%',padding:'12px',border:'2px solid var(--green)',
                background:'transparent',color:'var(--green)',cursor:'pointer',
                fontFamily:"'Share Tech Mono',monospace",fontSize:'14px',letterSpacing:'1px',
              }}>
              CONFIRM & LOCK USERNAME
            </button>

            <button
              className="wallet-cancel"
              onClick={() => { setShowUsernameModal(false); setUsernameInput(''); setUsernameError(''); }}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Checking indicator — shown globally after wallet connects */}
      {authStatus === 'checking' && (
        <div style={{position:'fixed',bottom:'20px',right:'20px',background:'#111',border:'1px solid var(--green)',padding:'10px 16px',color:'var(--green)',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',zIndex:1999}}>
          Checking wallet...
        </div>
      )}
    </div>
  );
}
