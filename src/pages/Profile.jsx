import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

const ROLE_COLORS = { member: '#888', trusted: '#5fffff', moderator: '#ffaa00', admin: '#ff4444', superuser: '#aa44ff' };
const ROLE_ORDER = ['member', 'trusted', 'moderator', 'admin', 'superuser'];

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

export default function Profile() {
  const [user, setUser]               = useState(null);
  const [stats, setStats]             = useState(null);
  const [activity, setActivity]       = useState(null);
  const [loading, setLoading]         = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [tab, setTab]                 = useState('overview');
  const [viewedPlayer, setViewedPlayer] = useState(null);
  const [bio, setBio]                 = useState('');
  const [editingBio, setEditingBio]   = useState(false);
  const [bioInput, setBioInput]       = useState('');
  const [savingBio, setSavingBio]     = useState(false);
  const [bioMsg, setBioMsg]           = useState('');

  const params = new URLSearchParams(window.location.search);
  const viewId = params.get('id');
  const currentUser = getUser();
  const isOwnProfile = !viewId || viewId === currentUser?.id;

  useEffect(() => {
    const u = getUser();
    setUser(u);
    const targetId = viewId || u?.id;
    if (targetId) {
      fetchStats(targetId);
      fetchActivity(targetId);
    }
  }, [viewId]);

  const fetchStats = async (userId) => {
    try {
      const res = await base44.functions.invoke('gameStats', { user_id: userId });
      const data = res.data;
      if (data.success) {
        setStats(data.stats);
        if (viewId && viewId !== getUser()?.id) {
          setViewedPlayer({
            id: viewId,
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

  const fetchActivity = async (userId) => {
    setActivityLoading(true);
    try {
      const res = await base44.functions.invoke('getPlayerActivity', { player_id: userId });
      if (res.data.success) {
        setActivity(res.data);
        if (res.data.player?.bio) setBio(res.data.player.bio);
      }
    } catch {}
    setActivityLoading(false);
  };

  const saveBio = async () => {
    const u = getUser();
    if (!u) return;
    setSavingBio(true);
    try {
      const res = await base44.functions.invoke('updateProfile', { user_id: u.id, bio: bioInput });
      if (res.data.success) {
        setBio(bioInput);
        setEditingBio(false);
        setBioMsg('Bio saved!');
        setTimeout(() => setBioMsg(''), 3000);
        const updated = { ...u, bio: bioInput };
        localStorage.setItem('404x1_user', JSON.stringify(updated));
        setUser(updated);
      }
    } catch {}
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
  const role = displayUser?.user_role || 'member';
  const roleColor = ROLE_COLORS[role] || '#888';
  const rp = displayUser?.reputation_points || 0;
  const RP_THRESHOLD = 10000;
  const progressToTrusted = role === 'member' ? Math.min((rp / RP_THRESHOLD) * 100, 100) : 100;

  const BADGES = [
    { cond: rp >= 1,                              label: '🏅 First RP' },
    { cond: rp >= 100,                            label: '⭐ 100 RP Club' },
    { cond: rp >= 1000,                           label: '🌟 1K RP Club' },
    { cond: rp >= 10000,                          label: '💎 10K RP — Trusted', color: '#5fffff' },
    { cond: rp >= 50000,                          label: '🔥 50K RP Legend', color: '#ffaa00' },
    { cond: (displayUser?.messages_sent || 0) >= 1,    label: '💬 First Message' },
    { cond: (displayUser?.messages_sent || 0) >= 100,  label: '🗣 100 Messages' },
    { cond: (displayUser?.messages_sent || 0) >= 1000, label: '📢 1K Messages', color: '#5fffff' },
    { cond: (stats?.games_played || 0) >= 1,      label: '🎮 First Game' },
    { cond: (stats?.games_played || 0) >= 10,     label: '🕹 10 Games' },
    { cond: (stats?.games_played || 0) >= 50,     label: '🎯 50 Games', color: '#aa44ff' },
    { cond: (stats?.high_score || 0) >= 1000,     label: '🏆 1K Score' },
    { cond: (stats?.high_score || 0) >= 10000,    label: '🥇 10K Score', color: '#7dff7d' },
    { cond: role !== 'member',                    label: `👑 ${role.toUpperCase()}`, color: roleColor },
  ].filter(b => b.cond);

  return (
    <div style={{ minHeight: 'calc(100vh - 54px)', background: '#0a0a0a', padding: '20px', fontFamily: "'Share Tech Mono', monospace" }}>
      <style>{`
        .profile-wrap { max-width: 800px; margin: 0 auto; }
        .profile-hero { background: #111; border: 1px solid #2a2a2a; padding: 28px; margin-bottom: 20px; position: relative; overflow: hidden; }
        .profile-hero::before { content:''; position:absolute; top:0; right:0; width:200px; height:200px; background:radial-gradient(circle,rgba(125,255,125,0.04),transparent); pointer-events:none; }
        .profile-avatar { width:72px; height:72px; border-radius:4px; display:flex; align-items:center; justify-content:center; font-family:'Rubik Mono One',monospace; font-size:28px; border:2px solid; flex-shrink:0; }
        .profile-username { font-family:'Rubik Mono One',monospace; font-size:22px; margin-bottom:4px; }
        .role-badge { display:inline-block; padding:3px 10px; border:1px solid; border-radius:2px; font-size:11px; margin-bottom:10px; }
        .rp-bar-track { background:#1a1a1a; height:5px; border-radius:3px; overflow:hidden; margin-top:4px; }
        .rp-bar-fill { height:100%; background:linear-gradient(90deg,#7dff7d,#5fffff); border-radius:3px; transition:width 0.5s; }
        .stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(155px,1fr)); gap:12px; margin-bottom:20px; }
        .stat-card { background:#111; border:1px solid #2a2a2a; padding:16px; text-align:center; }
        .stat-val { font-family:'Rubik Mono One',monospace; font-size:22px; margin-bottom:4px; }
        .stat-lbl { font-size:10px; color:#888; }
        .tabs { display:flex; overflow-x:auto; border:1px solid #2a2a2a; margin-bottom:16px; }
        .tab-btn { flex:1; min-width:90px; padding:10px 8px; border:none; background:transparent; color:#888; cursor:pointer; font-family:'Share Tech Mono',monospace; font-size:11px; white-space:nowrap; transition:all 0.2s; }
        .tab-btn.active { background:#1a1a1a; color:#7dff7d; border-bottom:2px solid #7dff7d; }
        .section-card { background:#111; border:1px solid #2a2a2a; padding:20px; }
        .section-title { font-size:11px; color:#888; margin-bottom:14px; border-bottom:1px solid #1a1a1a; padding-bottom:8px; letter-spacing:1px; }
        .info-row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #111; font-size:13px; }
        .info-row:last-child { border-bottom:none; }
        .badge-grid { display:flex; flex-wrap:wrap; gap:8px; }
        .badge-chip { padding:6px 12px; border:1px solid #2a2a2a; background:#1a1a1a; font-size:11px; border-radius:2px; }
        .activity-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #111; font-size:12px; }
        .activity-row:last-child { border-bottom:none; }
        .msg-card { padding:10px 12px; border-bottom:1px solid #111; }
        .msg-card:last-child { border-bottom:none; }
        .bio-btn { padding:4px 10px; border:1px solid #2a2a2a; background:transparent; color:#888; cursor:pointer; font-size:10px; font-family:'Share Tech Mono',monospace; transition:all 0.2s; }
        .bio-btn:hover { border-color:#7dff7d; color:#7dff7d; }
        .bio-textarea { width:100%; padding:10px; background:#1a1a1a; border:1px solid #2a2a2a; color:#e0e0e0; font-family:'Share Tech Mono',monospace; font-size:13px; resize:vertical; min-height:80px; outline:none; margin-top:8px; border-radius:2px; }
        .bio-textarea:focus { border-color:#7dff7d; }
        .empty-state { color:#444; font-size:12px; text-align:center; padding:32px; }
      `}</style>

      <div className="profile-wrap">
        {/* Hero */}
        <div className="profile-hero">
          <div style={{ display:'flex', gap:'20px', alignItems:'flex-start', flexWrap:'wrap' }}>
            <div className="profile-avatar" style={{ color:roleColor, borderColor:roleColor, background:roleColor+'11' }}>
              {(displayUser?.username || 'U')[0].toUpperCase()}
            </div>
            <div style={{ flex:1 }}>
              <div className="profile-username" style={{ color:roleColor }}>
                {displayUser?.username || 'Unknown'}
              </div>
              <div className="role-badge" style={{ color:roleColor, borderColor:roleColor+'66' }}>
                {role.toUpperCase()}
              </div>
              {isOwnProfile && (
                <div style={{ fontSize:'11px', color:'#333', wordBreak:'break-all' }}>
                  {user?.wallet_address}
                </div>
              )}
              {bio && (
                <div style={{ fontSize:'13px', color:'#aaa', marginTop:'8px', lineHeight:1.6 }}>{bio}</div>
              )}
              {role === 'member' && (
                <div style={{ marginTop:'12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:'#888', marginBottom:'4px' }}>
                    <span>Progress to TRUSTED</span>
                    <span style={{ color:'#7dff7d' }}>{rp.toLocaleString()} / {RP_THRESHOLD.toLocaleString()} RP</span>
                  </div>
                  <div className="rp-bar-track">
                    <div className="rp-bar-fill" style={{ width:progressToTrusted+'%' }} />
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
              <div className="stat-val" style={{ color:s.color }}>{s.val}</div>
              <div className="stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs">
          {['overview','game','badges','activity','messages'].map(t => (
            <button key={t} className={`tab-btn${tab===t?' active':''}`} onClick={() => setTab(t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="section-card">
            <div className="section-title">ACCOUNT INFO</div>
            {[
              { label:'Username', value:displayUser?.username },
              { label:'Role', value:role.toUpperCase(), color:roleColor },
              { label:'Reputation Points', value:rp.toLocaleString(), color:'#7dff7d' },
              { label:'Messages Sent', value:(displayUser?.messages_sent||0).toLocaleString() },
              { label:'Total Game Score', value:(stats?.total_score||0).toLocaleString(), color:'#5fffff' },
              ...(isOwnProfile ? [{ label:'Member Since', value:user?.created_date ? new Date(user.created_date).toLocaleDateString() : 'N/A' }] : []),
            ].map(item => (
              <div key={item.label} className="info-row">
                <span style={{ color:'#888' }}>{item.label}</span>
                <span style={{ color:item.color||'#e0e0e0' }}>{item.value}</span>
              </div>
            ))}

            {/* Bio */}
            <div style={{ marginTop:'20px', paddingTop:'16px', borderTop:'1px solid #1a1a1a' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                <span style={{ fontSize:'11px', color:'#888', letterSpacing:'1px' }}>BIO</span>
                {isOwnProfile && !editingBio && (
                  <button className="bio-btn" onClick={() => { setEditingBio(true); setBioInput(bio); }}>
                    EDIT
                  </button>
                )}
              </div>
              {editingBio ? (
                <>
                  <textarea
                    className="bio-textarea"
                    value={bioInput}
                    onChange={e => setBioInput(e.target.value.slice(0,300))}
                    placeholder="Write something about yourself... (max 300 chars)"
                  />
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'6px' }}>
                    <div style={{ fontSize:'10px', color:bioInput.length>280?'#ff4444':'#444' }}>{bioInput.length}/300</div>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <button className="bio-btn" onClick={() => setEditingBio(false)}>CANCEL</button>
                      <button className="bio-btn" style={{ borderColor:'#7dff7d', color:'#7dff7d' }} onClick={saveBio} disabled={savingBio}>
                        {savingBio ? 'SAVING...' : 'SAVE'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ fontSize:'13px', color:bio?'#e0e0e0':'#333', lineHeight:1.6 }}>
                  {bio || (isOwnProfile ? 'No bio yet. Click EDIT to add one.' : 'No bio.')}
                </div>
              )}
              {bioMsg && <div style={{ color:'#7dff7d', fontSize:'11px', marginTop:'6px' }}>✓ {bioMsg}</div>}
            </div>
          </div>
        )}

        {/* GAME */}
        {tab === 'game' && (
          <div className="section-card">
            <div className="section-title">GAME STATISTICS</div>
            {loading ? (
              <div className="empty-state">Loading...</div>
            ) : (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px' }}>
                  {[
                    { label:'Games Played', value:stats?.games_played||0, color:'#ffaa00' },
                    { label:'High Score', value:(stats?.high_score||0).toLocaleString(), color:'#7dff7d' },
                    { label:'Average Score', value:(stats?.average_score||0).toLocaleString(), color:'#5fffff' },
                    { label:'Total Score', value:(stats?.total_score||0).toLocaleString(), color:'#aa44ff' },
                  ].map(item => (
                    <div key={item.label} style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', padding:'14px', textAlign:'center' }}>
                      <div style={{ color:item.color, fontSize:'20px', fontFamily:"'Rubik Mono One',monospace", marginBottom:'4px' }}>{item.value}</div>
                      <div style={{ color:'#888', fontSize:'10px' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                {stats?.recent_games?.length > 0 && (
                  <>
                    <div className="section-title">RECENT GAMES</div>
                    {stats.recent_games.map((g, i) => (
                      <div key={i} className="info-row">
                        <span style={{ color:'#888' }}>Game #{i+1}</span>
                        <span style={{ color:'#7dff7d' }}>{(g.score||g).toLocaleString()}</span>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* BADGES */}
        {tab === 'badges' && (
          <div className="section-card">
            <div className="section-title">BADGES & ACHIEVEMENTS</div>
            {BADGES.length > 0 ? (
              <div className="badge-grid">
                {BADGES.map((b, i) => (
                  <div key={i} className="badge-chip" style={b.color ? { color:b.color, borderColor:b.color+'66' } : {}}>
                    {b.label}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">Start chatting and playing to earn badges!</div>
            )}
          </div>
        )}

        {/* ACTIVITY */}
        {tab === 'activity' && (
          <div className="section-card">
            <div className="section-title">REPUTATION ACTIVITY</div>
            {activityLoading ? (
              <div className="empty-state">Loading activity...</div>
            ) : (
              <>
                {activity?.rp_received?.length > 0 && (
                  <>
                    <div style={{ fontSize:'11px', color:'#7dff7d', marginBottom:'8px' }}>RP RECEIVED</div>
                    {activity.rp_received.map((r, i) => (
                      <div key={i} className="activity-row">
                        <span style={{ color:'#888' }}>{r.reason || 'RP Award'}</span>
                        <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                          <span style={{ color:'#7dff7d' }}>+{r.amount} RP</span>
                          <span style={{ color:'#444', fontSize:'10px' }}>{r.created_date ? new Date(r.created_date).toLocaleDateString() : ''}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {activity?.rp_sent?.length > 0 && (
                  <>
                    <div style={{ fontSize:'11px', color:'#5fffff', margin:'16px 0 8px' }}>TIPS SENT</div>
                    {activity.rp_sent.map((r, i) => (
                      <div key={i} className="activity-row">
                        <span style={{ color:'#888' }}>{r.reason || 'Tip'}</span>
                        <span style={{ color:'#5fffff' }}>-{r.amount} RP</span>
                      </div>
                    ))}
                  </>
                )}
                {!activity?.rp_received?.length && !activity?.rp_sent?.length && (
                  <div className="empty-state">No RP activity yet.</div>
                )}
              </>
            )}
          </div>
        )}

        {/* MESSAGES */}
        {tab === 'messages' && (
          <div className="section-card">
            <div className="section-title">RECENT CHAT MESSAGES</div>
            {activityLoading ? (
              <div className="empty-state">Loading messages...</div>
            ) : activity?.recent_messages?.length > 0 ? (
              activity.recent_messages.map((m, i) => (
                <div key={i} className="msg-card">
                  <div style={{ fontSize:'10px', color:'#444', marginBottom:'4px' }}>
                    {m.created_date ? new Date(m.created_date).toLocaleString() : ''}
                  </div>
                  <div style={{ fontSize:'13px', color:'#e0e0e0', lineHeight:1.5, wordBreak:'break-word' }}>
                    {m.message || m.content}
                  </div>
                  {m.image_url && (
                    <img src={m.image_url} alt="" style={{ maxWidth:'200px', maxHeight:'120px', marginTop:'6px', border:'1px solid #2a2a2a' }} />
                  )}
                </div>
              ))
            ) : (
              <div className="empty-state">No recent messages.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}