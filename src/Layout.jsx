import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import WalletModal from '@/components/WalletModal';
import { getSessionToken } from '@/lib/auth';
import BrandMark from '@/components/BrandMark';
import MatrixRain from '@/components/MatrixRain';
import { useNetworkStatus } from '@/lib/xchart/useNetworkStatus';
import { FUNCTIONS_BASE } from '@/lib/api';

const BASE_URL = FUNCTIONS_BASE;

const BASE = FUNCTIONS_BASE;

function getCurrentUser() {
  try {
    const s = localStorage.getItem('404x1_user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [rp, setRp] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const net = useNetworkStatus();

  const refreshRp = async (u) => {
    if (!u?.id) return;
    try {
      const res = await fetch(BASE + 'gameStats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u.id, session_token: getSessionToken() })
      });
      const data = await res.json();
      if (data.success && data.stats) {
        setRp(data.stats.reputation_points || 0);
        // Update localStorage so other reads are fresher
        const updated = { ...u, reputation_points: data.stats.reputation_points || 0 };
        localStorage.setItem('404x1_user', JSON.stringify(updated));
      }
    } catch {}
  };

  useEffect(() => {
    const u = getCurrentUser();
    setUser(u);
    setRp(u?.reputation_points || 0);
    if (u) refreshRp(u);
    try {
      const convs = JSON.parse(localStorage.getItem('404x1_conversations') || '[]');
      setUnread(convs.reduce((acc, c) => acc + (c.unread_count || 0), 0));
    } catch {}
    const onAuth = () => {
      const freshUser = getCurrentUser();
      setUser(freshUser);
      setRp(freshUser?.reputation_points || 0);
      if (freshUser) refreshRp(freshUser);
    };
    window.addEventListener('storage', onAuth);
    window.addEventListener('userAuthChanged', onAuth);
    // Poll every 30s to keep RP fresh
    const interval = setInterval(() => {
      const u2 = getCurrentUser();
      if (u2) refreshRp(u2);
    }, 30000);
    return () => {
      window.removeEventListener('storage', onAuth);
      window.removeEventListener('userAuthChanged', onAuth);
      clearInterval(interval);
    };
  }, [currentPageName]);

  const logout = () => {
    const token = getSessionToken();
    // Revoke server-side too: a token left valid after logout is a usable credential.
    if (token) fetch(BASE + 'logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: token }),
    }).catch(() => {});
    localStorage.removeItem('404x1_user');
    setUser(null);
    window.dispatchEvent(new Event('userAuthChanged'));
  };

  const isMod = user && ['moderator', 'admin', 'superuser'].includes(user.user_role);

  const navLinks = [
    { name: 'Home', page: 'Home', label: 'HOME' },
    { name: 'Chat', page: 'Chat', label: 'CHAT' },
    { name: 'Leaderboard', page: 'Leaderboard', label: 'RANKS' },
    { name: 'Messages', page: 'Messages', label: 'DMs' },
    { name: 'Profile', page: 'Profile', label: 'PROFILE' },
    { name: 'Docs', page: 'Docs', label: 'DOCS' },
    ...(isMod ? [
      { name: 'ModPanel', page: 'ModPanel', label: 'MOD' },
      { name: 'ModerationLogs', page: 'ModerationLogs', label: 'LOGS' },
    ] : []),
  ];

  const connect = () => { setMenuOpen(false); window.dispatchEvent(new CustomEvent('open_wallet_modal')); };

  // close the drawer on page change / Escape
  useEffect(() => { setMenuOpen(false); }, [currentPageName]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="ds-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="ds-atmos" aria-hidden="true">
        <div className="ds-vignette" /><div className="ds-grid" /><MatrixRain /><div className="ds-scan" />
      </div>

      <header className="ds-nav">
        <Link to={createPageUrl('Home')} className="ds-brand" aria-label="404X1 home">
          <BrandMark />
          <span className="ds-brand-word">404<b>X1</b></span>
        </Link>

        <nav className="ds-links" aria-label="Primary">
          {navLinks.map(l => (
            <Link key={l.page} to={createPageUrl(l.page)} className={`ds-link${l.page.startsWith('Mod') ? ' is-mod' : ''}`} aria-current={currentPageName === l.page ? 'page' : undefined}>
              {l.label}
              {l.page === 'Messages' && unread > 0 && <span className="ds-badge-dot" aria-label={`${unread} unread`}>{unread > 9 ? '9+' : unread}</span>}
            </Link>
          ))}
        </nav>

        <div className="ds-nav-right">
          <span className="ds-net" data-state={net.state} role="status" aria-live="polite" title={net.state === 'ok' ? 'X1 mainnet RPC reachable' : net.state === 'down' ? 'X1 RPC unreachable' : 'Checking X1 RPC'}>
            <span className="dot" aria-hidden="true" />
            <span className="label">{net.state === 'down' ? 'X1 RPC OFFLINE' : 'X1 MAINNET'}</span>
            {net.state === 'ok' && net.slot != null && <span className="num">{net.slot.toLocaleString('en-US')}</span>}
          </span>
          {user ? (
            <>
              <span className="ds-user"><span className="name">{user.username || user.chat_username}</span><span className="rp">{rp.toLocaleString()} RP</span></span>
              <button className="ds-btn ghost desktop-only" onClick={logout}>Logout</button>
            </>
          ) : (
            <button className="ds-btn desktop-only" onClick={connect}>Connect</button>
          )}
          <button className="ds-burger" aria-label="Menu" aria-expanded={menuOpen} aria-controls="ds-drawer" onClick={() => setMenuOpen(!menuOpen)}><span /><span /><span /></button>
        </div>
      </header>

      <div id="ds-drawer" className={`ds-drawer${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
        {navLinks.map(l => (
          <Link key={l.page} to={createPageUrl(l.page)} tabIndex={menuOpen ? 0 : -1} aria-current={currentPageName === l.page ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
            <span>{l.label}</span>{l.page === 'Messages' && unread > 0 && <span className="ds-badge-dot">{unread}</span>}
          </Link>
        ))}
        {user ? (
          <button className="row" tabIndex={menuOpen ? 0 : -1} style={{ color: 'var(--red)' }} onClick={() => { setMenuOpen(false); logout(); }}>LOGOUT <span className="num" style={{ color: 'var(--green)' }}>{rp.toLocaleString()} RP</span></button>
        ) : (
          <button className="row" tabIndex={menuOpen ? 0 : -1} style={{ color: 'var(--green)' }} onClick={connect}>CONNECT WALLET</button>
        )}
      </div>

      <main id="main" className="ds-main">{children}</main>

      {/* Global wallet modal — works on all pages */}
      <WalletModal />
    </div>
  );
}