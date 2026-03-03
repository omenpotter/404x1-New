import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const BASE_URL = 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/';

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

  useEffect(() => {
    setUser(getCurrentUser());
    // count unread DMs
    try {
      const convs = JSON.parse(localStorage.getItem('404x1_conversations') || '[]');
      setUnread(convs.reduce((acc, c) => acc + (c.unread_count || 0), 0));
    } catch {}
  }, [currentPageName]);

  const logout = () => {
    localStorage.removeItem('404x1_user');
    window.location.href = createPageUrl('Login');
  };

  const navLinks = [
    { name: 'Home', page: 'Home', label: 'HOME' },
    { name: 'Chat', page: 'Chat', label: 'CHAT' },
    { name: 'Game', page: 'Game', label: 'GAME' },
    { name: 'Leaderboard', page: 'Leaderboard', label: 'RANKS' },
    { name: 'Messages', page: 'Messages', label: 'DMs' },
    { name: 'Profile', page: 'Profile', label: 'PROFILE' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', color: 'var(--text)', fontFamily: "'Share Tech Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rubik+Mono+One&family=Share+Tech+Mono&display=swap');
        :root {
          --green: #7dff7d;
          --cyan: #5fffff;
          --dark: #0a0a0a;
          --dark2: #111111;
          --dark3: #1a1a1a;
          --dark4: #222222;
          --border: #2a2a2a;
          --text: #e0e0e0;
          --text-dim: #888888;
          --red: #ff4444;
          --orange: #ffaa00;
          --purple: #aa44ff;
        }
        * { box-sizing: border-box; }
        body { background: var(--dark) !important; }
        body::before {
          content: '';
          position: fixed;
          top:0;left:0;right:0;bottom:0;
          background: repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.06) 2px,rgba(0,0,0,0.06) 4px);
          pointer-events:none;
          z-index:9999;
        }
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:var(--dark2)}
        ::-webkit-scrollbar-thumb{background:var(--green);border-radius:2px}
        .nav-404 {
          position: sticky; top: 0; z-index: 1000;
          background: rgba(10,10,10,0.95);
          border-bottom: 1px solid var(--border);
          padding: 0 20px;
          display: flex; align-items: center; justify-content: space-between;
          height: 54px;
          backdrop-filter: blur(10px);
        }
        .nav-logo {
          font-family: 'Rubik Mono One', monospace;
          font-size: 22px;
          color: var(--green);
          text-decoration: none;
          letter-spacing: 2px;
          text-shadow: 0 0 10px var(--green);
        }
        .nav-links { display: flex; gap: 4px; align-items: center; }
        .nav-link {
          padding: 6px 12px;
          color: var(--text-dim);
          text-decoration: none;
          font-size: 12px;
          border: 1px solid transparent;
          transition: all 0.2s;
          font-family: 'Share Tech Mono', monospace;
          position: relative;
        }
        .nav-link:hover, .nav-link.active { color: var(--green); border-color: var(--border); }
        .nav-link.active { color: var(--green); border-color: var(--green); }
        .nav-right { display: flex; align-items: center; gap: 12px; }
        .nav-user { font-size: 11px; color: var(--text-dim); }
        .nav-rp { color: var(--green); font-size: 12px; }
        .nav-btn {
          padding: 5px 12px; border: 1px solid var(--green);
          background: transparent; color: var(--green);
          cursor: pointer; font-size: 11px; font-family: 'Share Tech Mono', monospace;
          transition: all 0.2s;
        }
        .nav-btn:hover { background: var(--green); color: var(--dark); }
        .dm-badge {
          background: var(--green); color: var(--dark);
          border-radius: 50%; width: 16px; height: 16px;
          font-size: 9px; display: inline-flex; align-items: center; justify-content: center;
          position: absolute; top: 2px; right: 2px;
        }
        .hamburger { display: none; flex-direction: column; gap: 4px; cursor: pointer; background: none; border: none; }
        .hamburger span { width: 20px; height: 2px; background: var(--green); display: block; }
        .mobile-menu {
          display: none; position: fixed; top: 54px; left: 0; right: 0;
          background: rgba(10,10,10,0.98); border-bottom: 1px solid var(--border);
          flex-direction: column; padding: 12px; z-index: 999;
        }
        .mobile-menu.open { display: flex; }
        .mobile-nav-link {
          padding: 12px 16px; color: var(--text-dim); text-decoration: none;
          font-size: 14px; border-bottom: 1px solid var(--border);
          font-family: 'Share Tech Mono', monospace;
        }
        .mobile-nav-link:hover, .mobile-nav-link.active { color: var(--green); }
        @media(max-width:768px) {
          .nav-links { display: none; }
          .hamburger { display: flex; }
          .nav-right .nav-user { display: none; }
        }
        @keyframes glitch {
          0%{text-shadow:2px 0 #5fffff,-2px 0 #ff4444}
          25%{text-shadow:-2px 0 #5fffff,2px 0 #ff4444}
          50%{text-shadow:2px 2px #5fffff,-2px -2px #ff4444}
          75%{text-shadow:0 0 0}
          100%{text-shadow:2px 0 #5fffff,-2px 0 #ff4444}
        }
      `}</style>

      {/* Navbar */}
      <nav className="nav-404">
        <Link to={createPageUrl('Home')} className="nav-logo">404x1</Link>

        <div className="nav-links">
          {navLinks.map(l => (
            <Link
              key={l.page}
              to={createPageUrl(l.page)}
              className={`nav-link${currentPageName === l.page ? ' active' : ''}`}
            >
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
            <Link to={createPageUrl('Login')}>
              <button className="nav-btn">CONNECT</button>
            </Link>
          )}
          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
            <span/><span/><span/>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        {navLinks.map(l => (
          <Link
            key={l.page}
            to={createPageUrl(l.page)}
            className={`mobile-nav-link${currentPageName === l.page ? ' active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            {l.label} {l.page === 'Messages' && unread > 0 ? `(${unread})` : ''}
          </Link>
        ))}
        {user ? (
          <button className="mobile-nav-link" style={{background:'none',border:'none',textAlign:'left',cursor:'pointer',color:'var(--red)'}} onClick={logout}>LOGOUT</button>
        ) : (
          <Link to={createPageUrl('Login')} className="mobile-nav-link" onClick={() => setMenuOpen(false)}>CONNECT WALLET</Link>
        )}
      </div>

      {/* Page content */}
      <main>{children}</main>
    </div>
  );
}