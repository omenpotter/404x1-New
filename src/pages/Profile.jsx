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
  const [showConvert, setShowConvert]   = useState(false);
  const [convertAmount, setConvertAmount] = useState('');
  const [convertMsg, setConvertMsg]     = useState('');
  const [convertLoading, setConvertLoading] = useState(false);
  const [spendLoading, setSpendLoading] = useState({});
  const [spendMsg, setSpendMsg]         = useState({});
  const [selectedColor, setSelectedColor] = useState('#ff44ff');
  const [selectedFrame, setSelectedFrame] = useState('green_glow');
  const [colorWeeks, setColorWeeks]     = useState(1);
  const [frameWeeks, setFrameWeeks]     = useState(1);

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

  const handleConvert = async () => {
    const amount = parseInt(convertAmount);
    if (!amount || amount < 500 || amount % 500 !== 0) { setConvertMsg('Amount must be a multiple of 500, min 500'); return; }
    setConvertLoading(true); setConvertMsg('');
    try {
      const res = await base44.functions.invoke('convertRp', { amount });
      const data = res.data;
      if (data.success) {
        setConvertMsg(`✅ Converted! You received ${data.rpx_earned} RPx`);
        setConvertAmount('');
        const u = getUser();
        if (u) { fetchStats(u.id); fetchActivity(u.id); }
      } else { setConvertMsg(data.error || 'Conversion failed'); }
    } catch (e) { setConvertMsg(e.message || 'Conversion failed'); }
    setConvertLoading(false);
  };

  const handleSpend = async (action, extraParams = {}) => {
    setSpendLoading(p => ({ ...p, [action]: true }));
    setSpendMsg(p => ({ ...p, [action]: '' }));
    try {
      const res = await base44.functions.invoke('spendRp', { action, ...extraParams });
      const data = res.data;
      if (data.success) {
        setSpendMsg(p => ({ ...p, [action]: `✅ Done! Cost: ${data.cost} RP burned: ${data.burned_rp}` }));
        const u = getUser();
        if (u) { fetchStats(u.id); fetchActivity(u.id); }
      } else { setSpendMsg(p => ({ ...p, [action]: data.error || 'Failed' })); }
    } catch (e) { setSpendMsg(p => ({ ...p, [action]: e.message || 'Failed' })); }
    setSpendLoading(p => ({ ...p, [action]: false }));
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

    { cond: role !== 'member',                    label: `👑 ${role.toUpperCase()}`, color: roleColor },
  ].filter(b => b.cond);

  const economyPlayer = activity?.player || user || {};
  const lockedRp = economyPlayer.locked_rp || 0;
  const eligibleRp = economyPlayer.is_404_holder
    ? Math.max(0, (economyPlayer.reputation_points || 0) - lockedRp - 10000)
    : Math.max(0, (economyPlayer.reputation_points || 0) - lockedRp);
  const weeklyRemaining = Math.max(0, 3000 - (economyPlayer.conversion_week_rp || 0));
  const halvingRate = 1 / Math.pow(2, Math.floor(Math.max(0, (Date.now() - new Date('2025-01-01').getTime()) / (365.25 * 24 * 3600 * 1000)) / 2));

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

      {/* Convert Modal */}
      {showConvert && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.88)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:'#111', border:'2px solid #aa44ff', padding:'28px', width:'100%', maxWidth:'420px', fontFamily:"'Share Tech Mono',monospace" }}>
            <div style={{ fontFamily:"'Rubik Mono One',monospace", color:'#aa44ff', fontSize:'16px', marginBottom:'20px', letterSpacing:'2px' }}>CONVERT RP → RPx</div>
            <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', padding:'12px', marginBottom:'16px', fontSize:'13px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                <span style={{ color:'#888' }}>Eligible RP</span><span style={{ color:'#aa44ff' }}>{eligibleRp.toLocaleString()}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                <span style={{ color:'#888' }}>Current Rate</span><span style={{ color:'#7dff7d' }}>1 RP → {halvingRate} RPx</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'#888' }}>Weekly Remaining</span><span style={{ color:'#ffaa00' }}>{weeklyRemaining.toLocaleString()} RP</span>
              </div>
            </div>
            <input
              type="number" step="500" min="500" max={Math.min(eligibleRp, weeklyRemaining)}
              value={convertAmount} onChange={e => setConvertAmount(e.target.value)}
              placeholder="Amount (multiples of 500)"
              style={{ width:'100%', padding:'10px 12px', background:'#1a1a1a', border:'1px solid #aa44ff', color:'#e0e0e0', fontFamily:"'Share Tech Mono',monospace", fontSize:'14px', outline:'none', marginBottom:'8px', boxSizing:'border-box' }}
            />
            {convertAmount && parseInt(convertAmount) >= 500 && (
              <div style={{ fontSize:'12px', color:'#aa44ff', marginBottom:'8px' }}>You will receive: {(parseInt(convertAmount) * halvingRate).toFixed(4)} RPx</div>
            )}
            {convertMsg && (
              <div style={{ fontSize:'12px', marginBottom:'12px', color: convertMsg.startsWith('✅') ? '#7dff7d' : '#ff4444' }}>{convertMsg}</div>
            )}
            <div style={{ display:'flex', gap:'8px' }}>
              <button
                style={{ flex:1, padding:'10px', border:'1px solid #aa44ff', background:'transparent', color:'#aa44ff', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'12px' }}
                onClick={handleConvert} disabled={convertLoading}
              >{convertLoading ? 'CONVERTING...' : 'CONFIRM'}</button>
              <button
                style={{ padding:'10px 16px', border:'1px solid #2a2a2a', background:'transparent', color:'#888', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'12px' }}
                onClick={() => { setShowConvert(false); setConvertMsg(''); setConvertAmount(''); }}
              >CANCEL</button>
            </div>
          </div>
        </div>
      )}

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
          ].map(s => (
            <div key={s.lbl} className="stat-card">
              <div className="stat-val" style={{ color:s.color }}>{s.val}</div>
              <div className="stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs">
          {['overview','badges','activity','messages',...(isOwnProfile ? ['economy'] : [])].map(t => (
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
              ...(isOwnProfile ? [{ label:'Member Since', value:user?.created_date ? new Date(user.created_date).toLocaleDateString() : 'N/A' }] : []),
            ].map(item => (
              <div key={item.label} className="info-row">
                <span style={{ color:'#888' }}>{item.label}</span>
                <span style={{ color:item.color||'#e0e0e0' }}>{item.value}</span>
              </div>
            ))}

            {/* Economy Stats (own profile) */}
            {isOwnProfile && (
              <>
                <div style={{ marginTop:'20px', paddingTop:'16px', borderTop:'1px solid #1a1a1a' }}>
                  <div style={{ fontSize:'11px', color:'#888', letterSpacing:'1px', marginBottom:'10px' }}>RP ECONOMY</div>
                  {[
                    { label:'RPx Balance', value:(economyPlayer.rpx_balance||0).toFixed(2), color:'#aa44ff' },
                    { label:'Locked RP', value:(lockedRp).toLocaleString(), color:'#ffaa00', note:'Cannot be spent or converted' },
                    { label:'Total Converted', value:(economyPlayer.total_rp_converted||0).toLocaleString(), color:'#5fffff' },
                    { label:'Weekly Cap Left', value:weeklyRemaining.toLocaleString(), color:'#7dff7d', note:'Resets Monday' },
                  ].map(item => (
                    <div key={item.label} className="info-row">
                      <span style={{ color:'#888' }}>{item.label}{item.note ? <span style={{ color:'#444', fontSize:'9px', marginLeft:'6px' }}>({item.note})</span> : ''}</span>
                      <span style={{ color:item.color }}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:'12px' }}>
                  <button
                    style={{ padding:'8px 16px', border:'1px solid #aa44ff', background:'transparent', color:'#aa44ff', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'12px', transition:'all 0.2s' }}
                    onClick={() => { setShowConvert(true); setConvertMsg(''); }}
                  >CONVERT RP → RPx</button>
                </div>
              </>
            )}

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

        {/* ECONOMY */}
        {tab === 'economy' && isOwnProfile && (
          <div className="section-card">
            <div className="section-title">RP ECONOMY — SPEND RP ON PERKS</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'12px' }}>

              {/* Highlight Message */}
              <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', padding:'16px' }}>
                <div style={{ color:'#7dff7d', fontSize:'13px', marginBottom:'6px', fontFamily:"'Rubik Mono One',monospace" }}>HIGHLIGHT MESSAGE</div>
                <div style={{ color:'#888', fontSize:'11px', marginBottom:'10px', lineHeight:1.5 }}>Highlight your next message in chat</div>
                <div style={{ color:'#ffaa00', fontSize:'12px', marginBottom:'8px' }}>25 RP — one-time</div>
                {economyPlayer.highlight_expires_at && new Date(economyPlayer.highlight_expires_at) > Date.now() && (
                  <div style={{ color:'#7dff7d', fontSize:'11px', marginBottom:'8px' }}>✓ Active until {new Date(economyPlayer.highlight_expires_at).toLocaleTimeString()}</div>
                )}
                {spendMsg['highlight_message'] && <div style={{ fontSize:'11px', marginBottom:'8px', color:spendMsg['highlight_message'].startsWith('✅')?'#7dff7d':'#ff4444' }}>{spendMsg['highlight_message']}</div>}
                <button style={{ padding:'7px 14px', border:'1px solid #7dff7d', background:'transparent', color:'#7dff7d', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'11px', marginBottom:'6px' }}
                  onClick={() => handleSpend('highlight_message')} disabled={spendLoading['highlight_message']}
                >{spendLoading['highlight_message'] ? '...' : 'BUY — 25 RP'}</button>
                <div style={{ color:'#444', fontSize:'10px' }}>25% of cost is permanently burned</div>
              </div>

              {/* Pin Message */}
              <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', padding:'16px' }}>
                <div style={{ color:'#ffaa00', fontSize:'13px', marginBottom:'6px', fontFamily:"'Rubik Mono One',monospace" }}>PIN MESSAGE</div>
                <div style={{ color:'#888', fontSize:'11px', marginBottom:'10px', lineHeight:1.5 }}>Request a message pin (mod review required)</div>
                <div style={{ color:'#ffaa00', fontSize:'12px', marginBottom:'8px' }}>100 RP — one-time</div>
                {spendMsg['pin_message'] && <div style={{ fontSize:'11px', marginBottom:'8px', color:spendMsg['pin_message'].startsWith('✅')?'#7dff7d':'#ff4444' }}>{spendMsg['pin_message']}</div>}
                <button style={{ padding:'7px 14px', border:'1px solid #ffaa00', background:'transparent', color:'#ffaa00', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'11px', marginBottom:'6px' }}
                  onClick={() => handleSpend('pin_message')} disabled={spendLoading['pin_message']}
                >{spendLoading['pin_message'] ? '...' : 'BUY — 100 RP'}</button>
                <div style={{ color:'#444', fontSize:'10px' }}>25% of cost is permanently burned</div>
              </div>

              {/* Username Color */}
              <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', padding:'16px' }}>
                <div style={{ color:'#5fffff', fontSize:'13px', marginBottom:'6px', fontFamily:"'Rubik Mono One',monospace" }}>USERNAME COLOR</div>
                <div style={{ color:'#888', fontSize:'11px', marginBottom:'10px', lineHeight:1.5 }}>Custom username color in chat</div>
                <div style={{ color:'#ffaa00', fontSize:'12px', marginBottom:'8px' }}>500 RP/week</div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                  <input type="color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)}
                    style={{ width:'32px', height:'32px', cursor:'pointer', border:'1px solid #2a2a2a', background:'none', borderRadius:'2px' }} />
                  <span style={{ color:'#888', fontSize:'11px' }}>{selectedColor}</span>
                </div>
                <div style={{ display:'flex', gap:'6px', marginBottom:'8px' }}>
                  {[1,2,4].map(w => (
                    <button key={w} onClick={() => setColorWeeks(w)} style={{ padding:'4px 10px', border:`1px solid ${colorWeeks===w?'#5fffff':'#2a2a2a'}`, background:'transparent', color:colorWeeks===w?'#5fffff':'#888', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'10px' }}>{w}W</button>
                  ))}
                </div>
                {economyPlayer.username_color_expires_at && new Date(economyPlayer.username_color_expires_at) > Date.now() && (
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px' }}>
                    <div style={{ width:'12px', height:'12px', borderRadius:'50%', background: economyPlayer.username_color || '#fff' }} />
                    <span style={{ color:'#7dff7d', fontSize:'11px' }}>Active until {new Date(economyPlayer.username_color_expires_at).toLocaleDateString()}</span>
                  </div>
                )}
                {spendMsg['username_color'] && <div style={{ fontSize:'11px', marginBottom:'8px', color:spendMsg['username_color'].startsWith('✅')?'#7dff7d':'#ff4444' }}>{spendMsg['username_color']}</div>}
                <button style={{ padding:'7px 14px', border:'1px solid #5fffff', background:'transparent', color:'#5fffff', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'11px', marginBottom:'6px' }}
                  onClick={() => handleSpend('username_color', { color: selectedColor, duration_weeks: colorWeeks })} disabled={spendLoading['username_color']}
                >{spendLoading['username_color'] ? '...' : `BUY — ${500*colorWeeks} RP`}</button>
                <div style={{ color:'#444', fontSize:'10px' }}>25% of cost is permanently burned</div>
              </div>

              {/* Profile Frame */}
              <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', padding:'16px' }}>
                <div style={{ color:'#aa44ff', fontSize:'13px', marginBottom:'6px', fontFamily:"'Rubik Mono One',monospace" }}>PROFILE FRAME</div>
                <div style={{ color:'#888', fontSize:'11px', marginBottom:'10px', lineHeight:1.5 }}>Glowing profile frame</div>
                <div style={{ color:'#ffaa00', fontSize:'12px', marginBottom:'8px' }}>300 RP/week</div>
                <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginBottom:'8px' }}>
                  {['green_glow','cyan_pulse','purple_flame'].map(f => (
                    <button key={f} onClick={() => setSelectedFrame(f)} style={{ padding:'4px 8px', border:`1px solid ${selectedFrame===f?'#aa44ff':'#2a2a2a'}`, background:'transparent', color:selectedFrame===f?'#aa44ff':'#888', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'9px' }}>{f.replace('_',' ').toUpperCase()}</button>
                  ))}
                </div>
                <div style={{ display:'flex', gap:'6px', marginBottom:'8px' }}>
                  {[1,2,4].map(w => (
                    <button key={w} onClick={() => setFrameWeeks(w)} style={{ padding:'4px 10px', border:`1px solid ${frameWeeks===w?'#aa44ff':'#2a2a2a'}`, background:'transparent', color:frameWeeks===w?'#aa44ff':'#888', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'10px' }}>{w}W</button>
                  ))}
                </div>
                {economyPlayer.profile_frame_expires_at && new Date(economyPlayer.profile_frame_expires_at) > Date.now() && (
                  <div style={{ color:'#7dff7d', fontSize:'11px', marginBottom:'8px' }}>✓ Active until {new Date(economyPlayer.profile_frame_expires_at).toLocaleDateString()}</div>
                )}
                {spendMsg['profile_frame'] && <div style={{ fontSize:'11px', marginBottom:'8px', color:spendMsg['profile_frame'].startsWith('✅')?'#7dff7d':'#ff4444' }}>{spendMsg['profile_frame']}</div>}
                <button style={{ padding:'7px 14px', border:'1px solid #aa44ff', background:'transparent', color:'#aa44ff', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'11px', marginBottom:'6px' }}
                  onClick={() => handleSpend('profile_frame', { frame: selectedFrame, duration_weeks: frameWeeks })} disabled={spendLoading['profile_frame']}
                >{spendLoading['profile_frame'] ? '...' : `BUY — ${300*frameWeeks} RP`}</button>
                <div style={{ color:'#444', fontSize:'10px' }}>25% of cost is permanently burned</div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}