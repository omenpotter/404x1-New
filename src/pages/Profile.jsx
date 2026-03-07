import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';

const BASE = 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/';
const ROLE_COLORS = { member: '#888', trusted: '#5fffff', moderator: '#ffaa00', admin: '#ff4444', superuser: '#aa44ff' };
const ROLE_ORDER = ['member', 'trusted', 'moderator', 'admin', 'superuser'];

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

export default function Profile() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [viewedPlayer, setViewedPlayer] = useState(null);

  // Read ?id= from URL
  const params = new URLSearchParams(window.location.search);
  const viewId = params.get('id');
  const isOwnProfile = !viewId || viewId === getUser()?.id;

  useEffect(() => {
    const u = getUser();
    setUser(u);
    const targetId = viewId || u?.id;
    if (targetId) fetchStats(targetId);
  }, [viewId]);

  const fetchStats = async (userId) => {
    try {
      const res = await fetch(BASE + `gameStats?user_id=${userId}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        // If viewing another player, use stats for display
        if (viewId && viewId !== getUser()?.id) {
          setViewedPlayer({
            username: data.stats.username,
            user_role: data.stats.user_role,
            reputation_points: data.stats.reputation_points,
            messages_sent: data.stats.messages_sent || 0,
          });
        }
      }
    } catch {}
    setLoading(false);
  };

  if (!user && isOwnProfile) {
    return (
      <div style={{ minHeight: 'calc(100vh - 54px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div style={{ textAlign: 'center', fontFamily: "'Share Tech Mono', monospace" }}>
          <div style={{ color: '#ff4444', fontSize: '16px', marginBottom: '12px' }}>⚠ LOGIN REQUIRED</div>
          <a href={createPageUrl('Home')} style={{ color: '#7dff7d', fontSize: '13px' }}>← Return to Home</a>
        </div>
      </div>
    );
  }

  const displayUser = (viewId && viewedPlayer) ? viewedPlayer : user;
  const role = displayUser?.user_role || 'member';
  const roleColor = ROLE_COLORS[role] || '#888';
  const roleIdx = ROLE_ORDER.indexOf(role);
  const nextRole = ROLE_ORDER[roleIdx + 1];
  const rp = displayUser?.reputation_points || 0;

  // RP thresholds for role display
  const RP_THRESHOLD = 10000;
  const progressToTrusted = role === 'member' ? Math.min((rp / RP_THRESHOLD) * 100, 100) : 100;

  return (
    <div style={{ minHeight: 'calc(100vh - 54px)', background: '#0a0a0a', padding: '20px', fontFamily: "'Share Tech Mono', monospace" }}>
      <style>{`
        .profile-wrap { max-width: 800px; margin: 0 auto; }
        .profile-hero { background: #111; border: 1px solid #2a2a2a; padding: 32px; margin-bottom: 20px; position: relative; overflow: hidden; }
        .profile-hero::before { content: ''; position: absolute; top: 0; right: 0; width: 200px; height: 200px; background: radial-gradient(circle, rgba(125,255,125,0.05), transparent); pointer-events: none; }
        .profile-avatar-large { width: 72px; height: 72px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-family: 'Rubik Mono One', monospace; font-size: 28px; border: 2px solid; flex-shrink: 0; }
        .profile-info { flex: 1; }
        .profile-username { font-family: 'Rubik Mono One', monospace; font-size: 24px; margin-bottom: 4px; }
        .profile-role-badge { display: inline-block; padding: 3px 10px; border: 1px solid; border-radius: 2px; font-size: 11px; margin-bottom: 12px; }
        .profile-wallet { font-size: 11px; color: #444; word-break: break-all; }
        .rp-bar-wrap { margin-top: 16px; }
        .rp-bar-label { font-size: 11px; color: #888; margin-bottom: 6px; display: flex; justify-content: space-between; }
        .rp-bar-track { background: #1a1a1a; height: 6px; border-radius: 3px; overflow: hidden; }
        .rp-bar-fill { height: 100%; background: linear-gradient(90deg, #7dff7d, #5fffff); border-radius: 3px; transition: width 0.5s; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .stat-card { background: #111; border: 1px solid #2a2a2a; padding: 16px; text-align: center; }
        .stat-val { font-family: 'Rubik Mono One', monospace; font-size: 24px; margin-bottom: 4px; }
        .stat-lbl { font-size: 10px; color: #888; }
        .tabs { display: flex; gap: 0; border: 1px solid #2a2a2a; margin-bottom: 16px; }
        .tab-btn { flex: 1; padding: 10px; border: none; background: transparent; color: #888; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 12px; }
        .tab-btn.active { background: #1a1a1a; color: #7dff7d; border-bottom: 2px solid #7dff7d; }
        .section-card { background: #111; border: 1px solid #2a2a2a; padding: 20px; }
        .section-title { font-size: 11px; color: #888; margin-bottom: 16px; border-bottom: 1px solid #1a1a1a; padding-bottom: 8px; }
        .score-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #111; font-size: 13px; }
        .score-row:last-child { border-bottom: none; }
        .badge-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .badge-chip { padding: 6px 12px; border: 1px solid #2a2a2a; background: #1a1a1a; font-size: 11px; border-radius: 2px; }
      `}</style>

      <div className="profile-wrap">
        {/* Hero */}
        <div className="profile-hero">
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="profile-avatar-large" style={{ color: roleColor, borderColor: roleColor, background: roleColor + '11' }}>
              {(displayUser?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="profile-info">
              <div className="profile-username" style={{ color: roleColor }}>
                {displayUser?.username || 'Unknown'}
              </div>
              <div className="profile-role-badge" style={{ color: roleColor, borderColor: roleColor + '66' }}>
                {role.toUpperCase()}
              </div>
              {isOwnProfile && (
                <div className="profile-wallet" style={{ color: '#444' }}>
                  {user?.wallet_address || 'No wallet connected'}
                </div>
              )}
              {isOwnProfile && user?.game_username && user.game_username !== user.username && (
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  Game: {user.game_username}
                </div>
              )}

              {isOwnProfile && role === 'member' && (
                <div className="rp-bar-wrap">
                  <div className="rp-bar-label">
                    <span>Progress to TRUSTED</span>
                    <span style={{ color: '#7dff7d' }}>{rp.toLocaleString()} / {RP_THRESHOLD.toLocaleString()} RP</span>
                  </div>
                  <div className="rp-bar-track">
                    <div className="rp-bar-fill" style={{ width: progressToTrusted + '%' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-val" style={{ color: '#7dff7d' }}>{rp.toLocaleString()}</div>
            <div className="stat-lbl">REPUTATION POINTS</div>
          </div>
          <div className="stat-card">
            <div className="stat-val" style={{ color: '#5fffff' }}>{(displayUser?.messages_sent || 0).toLocaleString()}</div>
            <div className="stat-lbl">MESSAGES SENT</div>
          </div>
          <div className="stat-card">
            <div className="stat-val" style={{ color: '#ffaa00' }}>{(stats?.games_played || user.games_played || 0).toLocaleString()}</div>
            <div className="stat-lbl">GAMES PLAYED</div>
          </div>
          <div className="stat-card">
            <div className="stat-val" style={{ color: '#aa44ff' }}>{(stats?.high_score || user.total_score || 0).toLocaleString()}</div>
            <div className="stat-lbl">HIGH SCORE</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>OVERVIEW</button>
          <button className={`tab-btn${tab === 'game' ? ' active' : ''}`} onClick={() => setTab('game')}>GAME STATS</button>
          <button className={`tab-btn${tab === 'badges' ? ' active' : ''}`} onClick={() => setTab('badges')}>BADGES</button>
        </div>

        {tab === 'overview' && (
          <div className="section-card">
            <div className="section-title">ACCOUNT INFO</div>
            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                { label: 'Username', value: displayUser?.username },
                { label: 'Role', value: role.toUpperCase(), color: roleColor },
                { label: 'Reputation Points', value: rp.toLocaleString(), color: '#7dff7d' },
                { label: 'Messages Sent', value: (displayUser?.messages_sent || 0).toLocaleString() },
                { label: 'Total Score', value: (stats?.total_score || 0).toLocaleString(), color: '#5fffff' },
                ...(isOwnProfile ? [{ label: 'Member Since', value: user?.created_date ? new Date(user.created_date).toLocaleDateString() : 'N/A' }] : []),
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #111', fontSize: '13px' }}>
                  <span style={{ color: '#888' }}>{item.label}</span>
                  <span style={{ color: item.color || '#e0e0e0' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'game' && (
          <div className="section-card">
            <div className="section-title">GAME STATISTICS</div>
            {loading ? (
              <div style={{ color: '#444', fontSize: '12px', textAlign: 'center', padding: '20px' }}>Loading...</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { label: 'Games Played', value: stats?.games_played || 0, color: '#ffaa00' },
                    { label: 'High Score', value: (stats?.high_score || 0).toLocaleString(), color: '#7dff7d' },
                    { label: 'Average Score', value: (stats?.average_score || 0).toLocaleString(), color: '#5fffff' },
                    { label: 'Total Score', value: (stats?.total_score || 0).toLocaleString(), color: '#aa44ff' },
                  ].map(item => (
                    <div key={item.label} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', padding: '12px', textAlign: 'center' }}>
                      <div style={{ color: item.color, fontSize: '20px', fontFamily: "'Rubik Mono One', monospace", marginBottom: '4px' }}>{item.value}</div>
                      <div style={{ color: '#888', fontSize: '10px' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                {stats?.recent_games?.length > 0 && (
                  <>
                    <div className="section-title" style={{ marginTop: '16px' }}>RECENT GAMES</div>
                    {stats.recent_games.map((g, i) => (
                      <div key={i} className="score-row">
                        <span style={{ color: '#888' }}>Game #{i + 1}</span>
                        <span style={{ color: '#7dff7d' }}>{(g.score || g).toLocaleString()}</span>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'badges' && (
          <div className="section-card">
            <div className="section-title">BADGES & ACHIEVEMENTS</div>
            <div className="badge-grid">
              {rp >= 1 && <div className="badge-chip">🏅 First RP</div>}
              {rp >= 100 && <div className="badge-chip">⭐ 100 RP Club</div>}
              {rp >= 1000 && <div className="badge-chip">🌟 1K RP Club</div>}
              {rp >= 10000 && <div className="badge-chip">💎 10K RP — Trusted</div>}
              {(displayUser?.messages_sent || 0) >= 1 && <div className="badge-chip">💬 First Message</div>}
              {(displayUser?.messages_sent || 0) >= 100 && <div className="badge-chip">🗣 100 Messages</div>}
              {(stats?.games_played || 0) >= 1 && <div className="badge-chip">🎮 First Game</div>}
              {(stats?.games_played || 0) >= 10 && <div className="badge-chip">🕹 10 Games</div>}
              {(stats?.high_score || 0) >= 1000 && <div className="badge-chip">🏆 1K Score</div>}
              {role !== 'member' && <div className="badge-chip" style={{ color: roleColor, borderColor: roleColor }}>👑 {role.toUpperCase()}</div>}
            </div>
            {!rp && <div style={{ color: '#444', fontSize: '12px', marginTop: '12px' }}>Start chatting and playing to earn badges!</div>}
          </div>
        )}
      </div>
    </div>
  );
}