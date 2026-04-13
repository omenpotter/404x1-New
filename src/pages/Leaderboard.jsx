import React, { useState, useEffect } from 'react';

const BASE = 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/';
const ROLE_COLORS = { member: '#888', trusted: '#5fffff', moderator: '#ffaa00', admin: '#ff4444', superuser: '#aa44ff' };

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
}

export default function Leaderboard() {
  const [chatBoard, setChatBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = getUser();

  const loadBoard = async () => {
    try {
      const r = await fetch(BASE + 'gameLeaderboard?limit=50&sortBy=reputation_points');
      const d = await r.json();
      if (d.success) setChatBoard(d.leaderboard || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadBoard();
    const t = setInterval(loadBoard, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ minHeight: 'calc(100vh - 54px)', background: '#0a0a0a', padding: '20px' }}>
      <style>{`
        .lb-wrap { max-width: 900px; margin: 0 auto; }
        .lb-title { font-family: 'Rubik Mono One', monospace; color: #7dff7d; font-size: 28px; text-align: center; margin-bottom: 8px; letter-spacing: 4px; text-shadow: 0 0 20px #7dff7d; }
        .lb-sub { text-align: center; color: #888; font-size: 12px; margin-bottom: 24px; }
        .lb-table { width: 100%; border-collapse: collapse; }
        .lb-thead th { padding: 10px 12px; text-align: left; font-size: 11px; color: #888; border-bottom: 1px solid #2a2a2a; font-family: 'Share Tech Mono', monospace; }
        .lb-row { border-bottom: 1px solid #111; transition: background 0.15s; }
        .lb-row:hover { background: #111; }
        .lb-row.top-rank { background: rgba(125,255,125,0.03); }
        .lb-row.is-me { background: rgba(125,255,125,0.08); }
        .lb-row td { padding: 10px 12px; font-size: 13px; font-family: 'Share Tech Mono', monospace; }
        .rank-cell { font-size: 18px; min-width: 40px; }
        .rp-val { color: #7dff7d; font-weight: bold; }
        .role-badge { font-size: 9px; padding: 2px 6px; border-radius: 2px; border: 1px solid; margin-left: 6px; }
        .loading-state { text-align: center; padding: 40px; color: #444; font-size: 12px; }
      `}</style>

      <div className="lb-wrap">
        <div className="lb-title">LEADERBOARD</div>
        <div className="lb-sub">Top players ranked by Reputation Points</div>

        {loading && <div className="loading-state">Loading leaderboard...</div>}

        {!loading && (
          <table className="lb-table">
            <thead>
              <tr className="lb-thead">
                <th>RANK</th>
                <th>PLAYER</th>
                <th>ROLE</th>
                <th>MESSAGES</th>
                <th>RP</th>
              </tr>
            </thead>
            <tbody>
              {chatBoard.map((p, i) => {
                const isMe = user && p.username === (user.chat_username || user.username);
                const roleColor = ROLE_COLORS[p.user_role] || '#888';
                return (
                  <tr key={i} className={`lb-row${p.rank <= 3 ? ' top-rank' : ''}${isMe ? ' is-me' : ''}`}>
                    <td className="rank-cell">{medal(p.rank)}</td>
                    <td>
                      <span style={{ color: roleColor }}>{p.username}</span>
                      {isMe && <span style={{ color: '#7dff7d', fontSize: '10px', marginLeft: '8px' }}>(YOU)</span>}
                    </td>
                    <td>
                      <span className="role-badge" style={{ color: roleColor, borderColor: roleColor + '66' }}>
                        {(p.user_role || 'member').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: '#888' }}>{(p.messages_sent || 0).toLocaleString()}</td>
                    <td className="rp-val">{(p.reputation_points || 0).toLocaleString()}</td>
                  </tr>
                );
              })}
              {chatBoard.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#444' }}>No players yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}