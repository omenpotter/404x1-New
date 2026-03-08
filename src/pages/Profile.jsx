import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const ROLE_COLORS = { member: '#888', trusted: '#5fffff', moderator: '#ffaa00', admin: '#ff4444', superuser: '#aa44ff' };
const ROLE_ORDER  = ['member', 'trusted', 'moderator', 'admin', 'superuser'];

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

export default function Profile() {
  const [user, setUser]               = useState(null);
  const [stats, setStats]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('overview');
  const [viewedPlayer, setViewedPlayer] = useState(null);
  const [recentMsgs, setRecentMsgs]   = useState([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [warnings, setWarnings]       = useState([]);
  const [editingBio, setEditingBio]   = useState(false);
  const [bioInput, setBioInput]       = useState('');
  const [savingBio, setSavingBio]     = useState(false);

  const params      = new URLSearchParams(window.location.search);
  const viewId      = params.get('id');
  const isOwnProfile = !viewId || viewId === getUser()?.id;

  useEffect(() => {
    const u = getUser();
    setUser(u);
    const targetId = viewId || u?.id;
    if (targetId) {
      fetchStats(targetId);
      fetchRecentMessages(targetId);
    }
    if (isOwnProfile && u) fetchMyWarnings(u.id);
  }, [viewId]);

  const fetchStats = async (userId) => {
    try {
      const res = await base44.functions.invoke('gameStats', { user_id: userId });
      const data = res.data;
      if (data.success) {
        setStats(data.stats);
        if (viewId && viewId !== getUser()?.id) {
          setViewedPlayer({
            id: userId,
            username: data.stats.username,
            user_role: data.stats.user_role,
            reputation_points: data.stats.reputation_points,
            messages_sent: data.stats.messages_sent || 0,
            bio: data.stats.bio || '',
          });
        }
      }
    } catch {}
    setLoading(false);
  };

  const fetchRecentMessages = async (userId) => {
    setMsgsLoading(true);
    try {
      const res = await base44.functions.invoke('getPlayerMessages', { player_id: userId, limit: 20 });
      if (res.data.success) setRecentMsgs(res.data.messages || []);
    } catch {}
    setMsgsLoading(false);
  };

  const fetchMyWarnings = async (userId) => {
    try {
      const data = await base44.entities.Warning.filter({ target_player_id: userId }, '-created_date', 20);
      setWarnings(data);
    } catch {}
  };

  const saveBio = async () => {
    const u = getUser();
    if (!u) return;
    setSavingBio(true);
    try {
      const res = await base44.functions.invoke('authWallet', { wallet_address: u.wallet_address, bio: bioInput });
      if (res.data.success) {
        const updated = { ...u, bio: bioInput };
        localStorage.setItem('404x1_user', JSON.stringify(updated));
        setUser(updated);
        setEditingBio(false);
        toast.success('Bio updated!');
      }
    } catch {
      // fallback: update directly in Player entity via updateMe-like pattern
      try {
        await base44.entities.Player.update(u.id, { bio: bioInput });
        const updated = { ...u, bio: bioInput };
        localStorage.setItem('404x1_user', JSON.stringify(updated));
        setUser(updated);
        setEditingBio(false);
        toast.success('Bio updated!');
      } catch (e2) {
        toast.error('Could not save bio');
      }
    }
    setSavingBio(false);
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
  const role        = displayUser?.user_role || 'member';
  const roleColor   = ROLE_COLORS[role] || '#888';
  const roleIdx     = ROLE_ORDER.indexOf(role);
  const rp          = displayUser?.reputation_points || 0;
  const RP_THRESHOLD = 10000;
  const progressToTrusted = role === 'member' ? Math.min((rp / RP_THRESHOLD) * 100, 100) : 100;

  const fmt = (iso) => iso ? new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div style={{ minHeight: 'calc(100vh - 54px)', background: '#0a0a0a', padding: '20px', fontFamily: "'Share Tech Mono', monospace" }}>
      <style>{`
        .profile-wrap { max-width: 800px; margin: 0 auto; }
        .profile-hero { background: #111; border: 1px solid #2a2a2a; padding: 32px; margin-bottom: 20px; position: relative; overflow: hidden; }
        .profile-hero::before { content: ''; position: absolute; top: 0; right: 0; width: 200px; height: 200px; background: radial-gradient(circle, rgba(125,255,125,0.05), transparent); pointer-events: none; }
        .profile-avatar-large { width: 72px; height: 72px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-family: 'Rubik Mono One', monospace; font-size: 28px; border: 2px solid; flex-shrink: 0; }
        .profile-username { font-family: 'Rubik Mono One', monospace; font-size: 24px; margin-bottom: 4px; }
        .profile-role-badge { display: inline-block; padding: 3px 10px; border: 1px solid; border-radius: 2px; font-size: 11px; margin-bottom: 8px; }
        .profile-wallet { font-size: 11px; color: #444; word-break: break-all; margin-top: 4px; }
        .rp-bar-wrap { margin-top: 16px; }
        .rp-bar-label { font-size: 11px; color: #888; margin-bottom: 6px; display: flex; justify-content: space-between; }
        .rp-bar-track { background: #1a1a1a; height: 6px; border-radius: 3px; overflow: hidden; }
        .rp-bar-fill { height: 100%; background: linear-gradient(90deg, #7dff7d, #5fffff); border-radius: 3px; transition: width 0.5s; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .stat-card { background: #111; border: 1px solid #2a2a2a; padding: 16px; text-align: center; }
        .stat-val { font-family: 'Rubik Mono One', monospace; font-size: 24px; margin-bottom: 4px; }
        .stat-lbl { font-size: 10px; color: #888; }
        .tabs { display: flex; gap: 0; border: 1px solid #2a2a2a; margin-bottom: 16px; overflow-x: auto; }
        .tab-btn { flex-shrink: 0; padding: 10px 14px; border: none; background: transparent; color: #888; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 11px; white-space: nowrap; }
        .tab-btn.active { background: #1a1a1a; color: #7dff7d; border-bottom: 2px solid #7dff7d; }
        .section-card { background: #111; border: 1px solid #2a2a2a; padding: 20px; }
        .section-title { font-size: 11px; color: #888; margin-bottom: 16px; border-bottom: 1px solid #1a1a1a; padding-bottom: 8px; letter-spacing: 1px; }
        .score-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #111; font-size: 13px; }
        .score-row:last-child { border-bottom: none; }
        .badge-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .badge-chip { padding: 6px 12px; border: 1px solid #2a2a2a; background: #1a1a1a; font-size: 11px; border-radius: 2px; }
        .bio-text { font-size: 13px; color: #e0e0e0; line-height: 1.6; min-height: 40px; }
        .bio-input { width: 100%; padding: 10px; background: #1a1a1a; border: 1px solid #2a2a2a; color: #e0e0e0; font-family: 'Share Tech Mono', monospace; font-size: 13px; outline: none; resize: vertical; min-height: 80px; box-sizing: border-box; }
        .bio-input:focus { border-color: #7dff7d; }
        .edit-btn { padding: 4px 10px; border: 1px solid #2a2a2a; background: transparent; color: #888; cursor: pointer; font-size: 10px; font-family: 'Share Tech Mono', monospace; }
        .edit-btn:hover { border-color: #7dff7d; color: #7dff7d; }
        .save-btn { padding: 6px 14px; border: 1px solid #7dff7d; background: transparent; color: #7dff7d; cursor: pointer; font-size: 11px; font-family: 'Share Tech Mono', monospace; }
        .save-btn:hover { background: #7dff7d; color: #0a0a0a; }
        .cancel-btn { padding: 6px 14px; border: 1px solid #2a2a2a; background: transparent; color: #888; cursor: pointer; font-size: 11px; font-family: 'Share Tech Mono', monospace; }
        .msg-item { padding: 10px 12px; border-bottom: 1px solid #1a1a1a; font-size: 12px; }
        .msg-item:last-child { border-bottom: none; }
        .msg-time { font-size: 10px; color: #444; }
        .warn-item { padding: 10px 12px; border-left: 3px solid; margin-bottom: 8px; background: #1a1a1a; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #111; font-size: 13px; }
        .info-row:last-child { border-bottom: none; }
      `}</style>

      <div className="profile-wrap">
        {/* Hero */}
        <div className="profile-hero">
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="profile-avatar-large" style={{ color: roleColor, borderColor: roleColor, background: roleColor + '11' }}>
              {(displayUser?.username || 'U')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div className="profile-username" style={{ color: roleColor }}>
                {displayUser?.username || 'Unknown'}
              </div>
              <div className="profile-role-badge" style={{ color: roleColor, borderColor: roleColor + '66' }}>
                {role.toUpperCase()}
              </div>
              {isOwnProfile && (
                <div className="profile-wallet">{user?.wallet_address || 'No wallet connected'}</div>
              )}

              {/* Bio */}
              <div style={{ marginTop: '12px' }}>
                {!editingBio ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <div className="bio-text" style={{ flex: 1 }}>
                      {displayUser?.bio || <span style={{ color: '#444' }}>{isOwnProfile ? 'No bio yet. Click edit to add one.' : 'No bio.'}</span>}
                    </div>
                    {isOwnProfile && (
                      <button className="edit-btn" onClick={() => { setBioInput(user?.bio || ''); setEditingBio(true); }}>✏ EDIT</button>
                    )}
                  </div>
                ) : (
                  <div>
                    <textarea
                      className="bio-input"
                      value={bioInput}
                      onChange={e => { if (e.target.value.length <= 300) setBioInput(e.target.value); }}
                      placeholder="Write something about yourself... (max 300 chars)"
                    />
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '10px', color: bioInput.length > 280 ? '#ff4444' : '#444', alignSelf: 'center' }}>{bioInput.length}/300</span>
                      <button className="cancel-btn" onClick={() => setEditingBio(false)}>CANCEL</button>
                      <button className="save-btn" onClick={saveBio} disabled={savingBio}>{savingBio ? '...' : 'SAVE'}</button>
                    </div>
                  </div>
                )}
              </div>

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
          {[
            { val: rp.toLocaleString(), lbl: 'REPUTATION POINTS', color: '#7dff7d' },
            { val: (displayUser?.messages_sent || 0).toLocaleString(), lbl: 'MESSAGES SENT', color: '#5fffff' },
            { val: (stats?.games_played || 0).toLocaleString(), lbl: 'GAMES PLAYED', color: '#ffaa00' },
            { val: (stats?.high_score || 0).toLocaleString(), lbl: 'HIGH SCORE', color: '#aa44ff' },
          ].map(s => (
            <div key={s.lbl} className="stat-card">
              <div className="stat-val" style={{ color: s.color }}>{s.val}</div>
              <div className="stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>OVERVIEW</button>
          <button className={`tab-btn${tab === 'game' ? ' active' : ''}`} onClick={() => setTab('game')}>GAME STATS</button>
          <button className={`tab-btn${tab === 'messages' ? ' active' : ''}`} onClick={() => setTab('messages')}>RECENT MSGS</button>
          <button className={`tab-btn${tab === 'badges' ? ' active' : ''}`} onClick={() => setTab('badges')}>BADGES</button>
          {isOwnProfile && <button className={`tab-btn${tab === 'warnings' ? ' active' : ''}`} onClick={() => setTab('warnings')} style={{ color: warnings.length ? '#ff4444' : undefined }}>⚠ WARNINGS {warnings.length > 0 ? `(${warnings.length})` : ''}</button>}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className="section-card">
            <div className="section-title">ACCOUNT INFO</div>
            <div>
              {[
                { label: 'Username', value: displayUser?.username },
                { label: 'Role', value: role.toUpperCase(), color: roleColor },
                { label: 'Reputation Points', value: rp.toLocaleString(), color: '#7dff7d' },
                { label: 'Messages Sent', value: (displayUser?.messages_sent || 0).toLocaleString() },
                { label: 'Total Score', value: (stats?.total_score || 0).toLocaleString(), color: '#5fffff' },
                ...(isOwnProfile ? [{ label: 'Member Since', value: user?.created_date ? new Date(user.created_date).toLocaleDateString() : 'N/A' }] : []),
              ].map(item => (
                <div key={item.label} className="info-row">
                  <span style={{ color: '#888' }}>{item.label}</span>
                  <span style={{ color: item.color || '#e0e0e0' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Game Stats */}
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

        {/* Recent Messages */}
        {tab === 'messages' && (
          <div className="section-card">
            <div className="section-title">RECENT CHAT MESSAGES</div>
            {msgsLoading ? (
              <div style={{ color: '#444', fontSize: '12px', textAlign: 'center', padding: '20px' }}>Loading...</div>
            ) : recentMsgs.length === 0 ? (
              <div style={{ color: '#444', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No messages yet.</div>
            ) : (
              recentMsgs.map(m => (
                <div key={m.id} className="msg-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="msg-time">{fmt(m.created_date)}</span>
                  </div>
                  <div style={{ color: '#e0e0e0', fontSize: '13px', lineHeight: '1.5' }}>{m.message}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Badges */}
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
              {(displayUser?.messages_sent || 0) >= 500 && <div className="badge-chip">📢 500 Messages</div>}
              {(stats?.games_played || 0) >= 1 && <div className="badge-chip">🎮 First Game</div>}
              {(stats?.games_played || 0) >= 10 && <div className="badge-chip">🕹 10 Games</div>}
              {(stats?.games_played || 0) >= 50 && <div className="badge-chip">🎯 50 Games</div>}
              {(stats?.high_score || 0) >= 1000 && <div className="badge-chip">🏆 1K Score</div>}
              {(stats?.high_score || 0) >= 10000 && <div className="badge-chip">🔥 10K Score</div>}
              {role !== 'member' && <div className="badge-chip" style={{ color: roleColor, borderColor: roleColor }}>👑 {role.toUpperCase()}</div>}
            </div>
            {!rp && <div style={{ color: '#444', fontSize: '12px', marginTop: '12px' }}>Start chatting and playing to earn badges!</div>}
          </div>
        )}

        {/* Warnings (own profile only) */}
        {tab === 'warnings' && isOwnProfile && (
          <div className="section-card">
            <div className="section-title">YOUR WARNINGS</div>
            {warnings.length === 0 ? (
              <div style={{ color: '#7dff7d', fontSize: '12px', textAlign: 'center', padding: '20px' }}>✓ No warnings on record.</div>
            ) : (
              warnings.map(w => {
                const sevColor = { low: '#ffaa00', medium: '#ff8800', high: '#ff4444' }[w.severity] || '#ff4444';
                return (
                  <div key={w.id} className="warn-item" style={{ borderLeftColor: sevColor }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: sevColor, fontSize: '11px', fontWeight: 'bold' }}>{(w.severity || 'medium').toUpperCase()} WARNING</span>
                      <span style={{ color: '#444', fontSize: '10px' }}>{fmt(w.created_date)}</span>
                    </div>
                    <div style={{ color: '#e0e0e0', fontSize: '12px', marginBottom: '4px' }}>{w.reason}</div>
                    <div style={{ color: '#666', fontSize: '10px' }}>Issued by: {w.issued_by_username}</div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}