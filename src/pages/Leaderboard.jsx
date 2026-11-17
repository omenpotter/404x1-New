import React, { useState, useEffect } from 'react';
import { FUNCTIONS_BASE } from '@/lib/api';

const BASE = FUNCTIONS_BASE;
const ROLE_COLORS = { member: '#82998b', trusted: '#4fe3ff', moderator: '#ffb020', admin: '#ff4560', superuser: '#a974ff' };

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
    <div style={{ minHeight: 'calc(100vh - var(--nav-h))', background: 'transparent', padding: '20px' }}>
      <style>{`
        .lb-wrap { max-width: 900px; margin: 0 auto; }
        .lb-title { font-family: var(--font-display); color: #00ff88; font-size: 28px; text-align: center; margin-bottom: 8px; letter-spacing: 4px; text-shadow: 0 0 20px #00ff88; }
        .lb-sub { text-align: center; color: #82998b; font-size: 12px; margin-bottom: 24px; }
        .lb-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .lb-table { width: 100%; border-collapse: collapse; min-width: 520px; }
        @media (max-width: 560px) {
          .lb-title { font-size: 20px; letter-spacing: 2px; }
          .lb-thead th { padding: 8px 6px; }
          .lb-row td { padding: 8px 6px; font-size: 12px; }
          .rank-cell { font-size: 15px; min-width: 30px; }
        }
        .lb-thead th { padding: 10px 12px; text-align: left; font-size: 11px; color: #82998b; border-bottom: 1px solid #1d2b22; font-family: var(--font-body); }
        .lb-row { border-bottom: 1px solid #080d0a; transition: background 0.15s; }
        .lb-row:hover { background: #080d0a; }
        .lb-row.top-rank { background: rgba(0,255,136,0.03); }
        .lb-row.is-me { background: rgba(0,255,136,0.08); }
        .lb-row td { padding: 10px 12px; font-size: 13px; font-family: var(--font-body); }
        .rank-cell { font-size: 18px; min-width: 40px; }
        .rp-val { color: #00ff88; font-weight: bold; }
        .role-badge { font-size: 9px; padding: 2px 6px; border-radius: 2px; border: 1px solid; margin-left: 6px; }
        .loading-state { text-align: center; padding: 40px; color: #74897c; font-size: 12px; }
      `}</style>

      <div className="lb-wrap">
        <div className="lb-title">LEADERBOARD</div>
        <div className="lb-sub">Top players ranked by Reputation Points</div>

        {loading && <div className="loading-state">Loading leaderboard...</div>}

        {!loading && (
          <div className="lb-scroll">
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
                const roleColor = ROLE_COLORS[p.user_role] || '#82998b';
                return (
                  <tr key={i} className={`lb-row${p.rank <= 3 ? ' top-rank' : ''}${isMe ? ' is-me' : ''}`}>
                    <td className="rank-cell">{medal(p.rank)}</td>
                    <td>
                      <span style={{ color: roleColor }}>{p.username}</span>
                      {isMe && <span style={{ color: '#00ff88', fontSize: '10px', marginLeft: '8px' }}>(YOU)</span>}
                    </td>
                    <td>
                      <span className="role-badge" style={{ color: roleColor, borderColor: roleColor + '66' }}>
                        {(p.user_role || 'member').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: '#82998b' }}>{(p.messages_sent || 0).toLocaleString()}</td>
                    <td className="rp-val">{(p.reputation_points || 0).toLocaleString()}</td>
                  </tr>
                );
              })}
              {chatBoard.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#74897c' }}>No players yet</td></tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}