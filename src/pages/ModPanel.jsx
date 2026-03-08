import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

const ROLE_COLORS = { member: '#888', trusted: '#5fffff', moderator: '#ffaa00', admin: '#ff4444', superuser: '#aa44ff' };
const ROLES = ['member', 'trusted', 'moderator', 'admin', 'superuser'];
const ACTION_COLORS = {
  mute: '#ff4444', unmute: '#7dff7d', spam_penalty: '#ffaa00', warning: '#ffaa00',
  delete_message: '#ff4444', change_role: '#5fffff', award_rp: '#7dff7d',
  permanent_ban: '#aa44ff', ban: '#aa44ff',
};

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

export default function ModPanel() {
  const [user, setUser] = useState(null);
  const [tab, setTab]   = useState('mute');

  // Search
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  // Action fields
  const [reason, setReason]     = useState('');
  const [duration, setDuration] = useState(60);
  const [newRole, setNewRole]   = useState('member');
  const [rpAmount, setRpAmount] = useState(100);
  const [rpReason, setRpReason] = useState('');
  const [messageId, setMessageId] = useState('');

  // Status
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');

  // Logs
  const [logs, setLogs]           = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => { setUser(getUser()); }, []);

  // Debounced player search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); return; }
      setSearching(true);
      try {
        const res = await base44.functions.invoke('playerSearch', { query: searchQuery });
        if (res.data.success) setSearchResults(res.data.players || []);
      } catch {}
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (tab === 'logs') fetchLogs();
  }, [tab, selectedPlayer]);

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await base44.functions.invoke('getModLogs', {
        limit: 50,
        target_player_id: selectedPlayer?.id || null,
      });
      if (res.data.success) setLogs(res.data.logs || []);
    } catch {}
    setLogsLoading(false);
  };

  const selectPlayer = (p) => {
    setSelectedPlayer(p);
    setSearchResults([]);
    setSearchQuery('');
    setResult(null);
    setError('');
  };

  const callAPI = async (endpoint, body) => {
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const res = await base44.functions.invoke(endpoint, body);
      const data = res.data;
      if (data.success) {
        setResult(data);
        if (tab === 'logs') fetchLogs();
      } else {
        setError(data.error || 'Action failed');
      }
    } catch (e) {
      setError(e.message || 'Network error');
    }
    setLoading(false);
  };

  const tid = selectedPlayer?.id || '';

  const handleMute       = () => callAPI('moderateUser', { moderator_id: user.id, action_type: 'mute', target_player_id: tid, duration_hours: Math.max(1, Math.round(duration / 60)), reason });
  const handleUnmute     = () => callAPI('moderateUser', { moderator_id: user.id, action_type: 'unmute', target_player_id: tid, reason });
  const handleSpam       = () => callAPI('moderateUser', { moderator_id: user.id, action_type: 'spam_penalty', target_player_id: tid, rp_penalty: 10, reason });
  const handleWarn       = () => callAPI('issueWarning', { moderator_id: user.id, target_player_id: tid, reason });
  const handleDeleteMsg  = () => callAPI('moderateUser', { moderator_id: user.id, action_type: 'delete_message', target_player_id: tid, message_id: messageId, reason });
  const handleChangeRole = () => callAPI('changeRole', { admin_id: user.id, target_player_id: tid, new_role: newRole });
  const handleGrantRp    = () => callAPI('awardRp', { from_player_id: user.id, to_player_id: tid, amount: rpAmount, reason: rpReason });

  if (!user) return (
    <div style={{ minHeight: 'calc(100vh - 54px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
      <div style={{ color: '#ff4444', fontFamily: "'Share Tech Mono',monospace", textAlign: 'center' }}>
        <div style={{ fontSize: '16px', marginBottom: '12px' }}>⚠ LOGIN REQUIRED</div>
        <a href={createPageUrl('Chat')} style={{ color: '#7dff7d', fontSize: '12px' }}>← Back</a>
      </div>
    </div>
  );

  const canAccess  = ['moderator', 'admin', 'superuser'].includes(user.user_role);
  const isSuperuser = user.user_role === 'superuser';

  if (!canAccess) return (
    <div style={{ minHeight: 'calc(100vh - 54px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
      <div style={{ color: '#ff4444', fontFamily: "'Share Tech Mono',monospace", textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚫</div>
        <div style={{ fontSize: '16px', marginBottom: '8px' }}>ACCESS DENIED</div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>Moderator role required</div>
        <a href={createPageUrl('Chat')} style={{ color: '#7dff7d', fontSize: '12px' }}>← Back to Chat</a>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 54px)', background: '#0a0a0a', padding: '20px', fontFamily: "'Share Tech Mono',monospace" }}>
      <style>{`
        .mod-wrap { max-width: 900px; margin: 0 auto; }
        .mod-title { font-family:'Rubik Mono One',monospace; color:#ff4444; font-size:22px; letter-spacing:3px; text-shadow:0 0 12px #ff4444; }
        .mod-sub { color:#888; font-size:11px; margin-bottom:20px; margin-top:4px; }
        .role-badge { display:inline-block; padding:3px 10px; border-radius:2px; font-size:11px; border:1px solid; margin-left:10px; vertical-align:middle; }

        /* Search */
        .search-wrap { position:relative; margin-bottom:16px; }
        .search-input { width:100%; padding:12px 16px; background:#111; border:1px solid #2a2a2a; color:#e0e0e0; font-family:'Share Tech Mono',monospace; font-size:13px; outline:none; }
        .search-input:focus { border-color:#ff4444; }
        .search-results { position:absolute; top:100%; left:0; right:0; background:#111; border:1px solid #2a2a2a; border-top:none; z-index:100; max-height:260px; overflow-y:auto; }
        .search-item { padding:10px 16px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1a1a1a; font-size:12px; }
        .search-item:hover { background:#1a1a1a; }
        .search-item:last-child { border-bottom:none; }
        .status-chip { display:inline-block; padding:1px 6px; border-radius:2px; font-size:9px; border:1px solid; margin-left:6px; }

        /* Selected player */
        .sel-player { background:#111; border:1px solid #ff4444; padding:14px 18px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; }
        .sel-name { font-family:'Rubik Mono One',monospace; font-size:15px; }
        .sel-meta { font-size:11px; color:#888; margin-top:3px; }
        .empty-target { background:#111; border:1px dashed #2a2a2a; padding:14px; margin-bottom:20px; text-align:center; font-size:11px; color:#333; }

        /* Tabs */
        .tabs { display:flex; flex-wrap:wrap; border:1px solid #2a2a2a; margin-bottom:20px; }
        .tab-btn { padding:10px 14px; border:none; background:transparent; color:#888; cursor:pointer; font-family:'Share Tech Mono',monospace; font-size:11px; transition:all 0.2s; }
        .tab-btn.active { background:#1a1a1a; color:#ff4444; border-bottom:2px solid #ff4444; }
        .tab-btn:hover:not(.active) { color:#e0e0e0; }
        .tab-btn:disabled { opacity:0.3; cursor:not-allowed; }

        /* Panel */
        .panel { background:#111; border:1px solid #2a2a2a; padding:22px; }
        .field { margin-bottom:14px; }
        .field-label { font-size:11px; color:#888; margin-bottom:5px; display:block; letter-spacing:0.5px; }
        .field-input { width:100%; padding:10px 12px; background:#1a1a1a; border:1px solid #2a2a2a; color:#e0e0e0; font-family:'Share Tech Mono',monospace; font-size:13px; outline:none; }
        .field-input:focus { border-color:#ff4444; }
        .action-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:18px; }
        .mod-btn { padding:10px 18px; border:1px solid; background:transparent; cursor:pointer; font-family:'Share Tech Mono',monospace; font-size:12px; transition:all 0.2s; }
        .mod-btn.danger { border-color:#ff4444; color:#ff4444; }
        .mod-btn.danger:hover { background:#ff4444; color:#fff; }
        .mod-btn.warn { border-color:#ffaa00; color:#ffaa00; }
        .mod-btn.warn:hover { background:#ffaa00; color:#0a0a0a; }
        .mod-btn.safe { border-color:#7dff7d; color:#7dff7d; }
        .mod-btn.safe:hover { background:#7dff7d; color:#0a0a0a; }
        .mod-btn.info { border-color:#5fffff; color:#5fffff; }
        .mod-btn.info:hover { background:#5fffff; color:#0a0a0a; }
        .mod-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .result-box { margin-top:14px; padding:12px; border:1px solid #7dff7d; background:rgba(125,255,125,0.05); font-size:12px; color:#7dff7d; }
        .error-box { margin-top:14px; padding:12px; border:1px solid #ff4444; background:rgba(255,68,68,0.05); font-size:12px; color:#ff4444; }
        .dur-grid { display:flex; gap:6px; flex-wrap:wrap; }
        .dur-btn { padding:6px 12px; border:1px solid #2a2a2a; background:transparent; color:#888; cursor:pointer; font-family:'Share Tech Mono',monospace; font-size:11px; }
        .dur-btn.active { border-color:#ff4444; color:#ff4444; }
        select.field-input { cursor:pointer; }

        /* Logs */
        .log-row { padding:10px 0; border-bottom:1px solid #1a1a1a; }
        .log-row:last-child { border-bottom:none; }
        .log-action { display:inline-block; padding:2px 8px; border-radius:2px; font-size:10px; border:1px solid; margin-right:8px; }
        .warn-notice { padding:10px 14px; background:rgba(255,170,0,0.06); border:1px solid #ffaa0066; font-size:11px; color:#ffaa00; margin-bottom:14px; border-radius:2px; }
      `}</style>

      <div className="mod-wrap">
        <div>
          <span className="mod-title">MOD PANEL</span>
          <span className="role-badge" style={{ color:ROLE_COLORS[user.user_role], borderColor:ROLE_COLORS[user.user_role]+'66' }}>
            {user.user_role?.toUpperCase()}
          </span>
        </div>
        <div className="mod-sub">Logged in as {user.username} · Community moderation tools</div>

        {/* Player Search */}
        <div className="search-wrap">
          <input
            className="search-input"
            placeholder="🔍 Search player by username..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searching && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#111', border:'1px solid #2a2a2a', borderTop:'none', padding:'10px 16px', fontSize:'11px', color:'#444' }}>
              Searching...
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map(p => (
                <div key={p.id} className="search-item" onClick={() => selectPlayer(p)}>
                  <div>
                    <span style={{ color:ROLE_COLORS[p.user_role]||'#888', fontFamily:"'Rubik Mono One',monospace" }}>{p.username}</span>
                    {p.is_muted && <span className="status-chip" style={{ color:'#ff4444', borderColor:'#ff4444' }}>MUTED</span>}
                    {p.is_banned && <span className="status-chip" style={{ color:'#aa44ff', borderColor:'#aa44ff' }}>BANNED</span>}
                  </div>
                  <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                    <span style={{ color:ROLE_COLORS[p.user_role]||'#888', fontSize:'10px' }}>{p.user_role?.toUpperCase()}</span>
                    <span style={{ color:'#7dff7d', fontSize:'11px' }}>{(p.reputation_points||0).toLocaleString()} RP</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Player */}
        {selectedPlayer ? (
          <div className="sel-player">
            <div>
              <div className="sel-name" style={{ color:ROLE_COLORS[selectedPlayer.user_role]||'#888' }}>
                {selectedPlayer.username}
                {selectedPlayer.is_muted && <span className="status-chip" style={{ color:'#ff4444', borderColor:'#ff4444', marginLeft:'8px' }}>MUTED</span>}
                {selectedPlayer.is_banned && <span className="status-chip" style={{ color:'#aa44ff', borderColor:'#aa44ff', marginLeft:'8px' }}>BANNED</span>}
              </div>
              <div className="sel-meta">
                {selectedPlayer.user_role?.toUpperCase()} · {(selectedPlayer.reputation_points||0).toLocaleString()} RP
                <span style={{ color:'#333', marginLeft:'12px', fontSize:'10px' }}>ID: {selectedPlayer.id}</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button className="mod-btn info" style={{ padding:'6px 12px', fontSize:'10px' }}
                onClick={() => window.open(createPageUrl('Profile') + '?id=' + selectedPlayer.id, '_blank')}>
                VIEW PROFILE
              </button>
              <button className="mod-btn danger" style={{ padding:'6px 12px', fontSize:'10px' }} onClick={() => setSelectedPlayer(null)}>
                ✕ CLEAR
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-target">Search and select a player above to begin moderation</div>
        )}

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn${tab==='mute'?' active':''}`} onClick={() => setTab('mute')}>🔇 MUTE</button>
          <button className={`tab-btn${tab==='warn'?' active':''}`} onClick={() => setTab('warn')}>⚠ WARN</button>
          <button className={`tab-btn${tab==='message'?' active':''}`} onClick={() => setTab('message')}>🗑 MESSAGE</button>
          <button className={`tab-btn${tab==='role'?' active':''}`} onClick={() => setTab('role')} disabled={!isSuperuser}>
            👑 ROLES{!isSuperuser && ' 🔒'}
          </button>
          {isSuperuser && (
            <button className={`tab-btn${tab==='rp'?' active':''}`} onClick={() => setTab('rp')}>💎 GRANT RP</button>
          )}
          <button className={`tab-btn${tab==='logs'?' active':''}`} onClick={() => setTab('logs')}>📋 LOGS</button>
        </div>

        <div className="panel">

          {/* MUTE */}
          {tab === 'mute' && (
            <>
              <div className="field">
                <label className="field-label">REASON</label>
                <input className="field-input" placeholder="Reason for action..." value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">MUTE DURATION</label>
                <div className="dur-grid">
                  {[5,15,30,60,120,1440].map(d => (
                    <button key={d} className={`dur-btn${duration===d?' active':''}`} onClick={() => setDuration(d)}>
                      {d>=1440 ? `${d/1440}d` : d>=60 ? `${d/60}h` : `${d}m`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="action-row">
                <button className="mod-btn danger" onClick={handleMute} disabled={!selectedPlayer||loading}>{loading?'...':'🔇 MUTE'}</button>
                <button className="mod-btn warn"   onClick={handleUnmute} disabled={!selectedPlayer||loading}>🔊 UNMUTE</button>
                <button className="mod-btn warn"   onClick={handleSpam} disabled={!selectedPlayer||loading}>⚡ SPAM PENALTY (-RP)</button>
              </div>
            </>
          )}

          {/* WARN */}
          {tab === 'warn' && (
            <>
              <div className="warn-notice">
                ⚠ Warnings are formally logged in the audit trail but do not restrict the user automatically. Use them as an official notice before escalating to a mute or ban.
              </div>
              <div className="field">
                <label className="field-label">WARNING REASON *</label>
                <input className="field-input" placeholder="Be specific about the rule violation..." value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              <div className="action-row">
                <button className="mod-btn warn" onClick={handleWarn} disabled={!selectedPlayer||!reason||loading}>
                  {loading ? '...' : '⚠ ISSUE WARNING'}
                </button>
              </div>
            </>
          )}

          {/* MESSAGE */}
          {tab === 'message' && (
            <>
              <div className="field">
                <label className="field-label">MESSAGE ID *</label>
                <input className="field-input" placeholder="Message ID to delete..." value={messageId} onChange={e => setMessageId(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">REASON</label>
                <input className="field-input" placeholder="Reason for deletion..." value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              <div className="action-row">
                <button className="mod-btn danger" onClick={handleDeleteMsg} disabled={!messageId||!selectedPlayer||loading}>
                  {loading ? '...' : '🗑 DELETE MESSAGE'}
                </button>
              </div>
            </>
          )}

          {/* ROLE */}
          {tab === 'role' && isSuperuser && (
            <>
              <div className="field">
                <label className="field-label">NEW ROLE</label>
                <select className="field-input" value={newRole} onChange={e => setNewRole(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                </select>
              </div>
              <div style={{ padding:'10px', background:'#1a1a1a', border:'1px solid #2a2a2a', fontSize:'11px', color:'#666', marginBottom:'14px' }}>
                Role hierarchy: member → trusted → moderator → admin → superuser · Only superusers can assign roles.
              </div>
              <div className="action-row">
                <button className="mod-btn info" onClick={handleChangeRole} disabled={!selectedPlayer||loading}>
                  {loading ? '...' : '👑 CHANGE ROLE'}
                </button>
              </div>
            </>
          )}

          {/* RP */}
          {tab === 'rp' && isSuperuser && (
            <>
              <div className="field">
                <label className="field-label">RP AMOUNT</label>
                <input className="field-input" type="number" value={rpAmount} onChange={e => setRpAmount(parseInt(e.target.value)||0)} min={1} />
              </div>
              <div className="field">
                <label className="field-label">REASON *</label>
                <input className="field-input" placeholder="Reason for RP grant..." value={rpReason} onChange={e => setRpReason(e.target.value)} />
              </div>
              <div className="action-row">
                <button className="mod-btn safe" onClick={handleGrantRp} disabled={!selectedPlayer||!rpReason||loading}>
                  {loading ? '...' : '💎 GRANT RP'}
                </button>
              </div>
            </>
          )}

          {/* LOGS */}
          {tab === 'logs' && (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                <span style={{ fontSize:'11px', color:'#888' }}>
                  {selectedPlayer ? `Filtered: ${selectedPlayer.username}` : 'All recent moderation logs'}
                </span>
                <button className="mod-btn info" style={{ padding:'5px 12px', fontSize:'10px' }} onClick={fetchLogs} disabled={logsLoading}>
                  {logsLoading ? '...' : '↻ REFRESH'}
                </button>
              </div>
              {logsLoading ? (
                <div style={{ textAlign:'center', color:'#444', fontSize:'12px', padding:'20px' }}>Loading logs...</div>
              ) : logs.length > 0 ? logs.map((log, i) => {
                const c = ACTION_COLORS[log.action_type] || '#888';
                return (
                  <div key={i} className="log-row">
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'6px' }}>
                      <div>
                        <span className="log-action" style={{ color:c, borderColor:c+'66' }}>{log.action_type?.toUpperCase()}</span>
                        <span style={{ color:'#e0e0e0', fontSize:'12px' }}>
                          <span style={{ color:ROLE_COLORS[log.moderator_role]||'#888' }}>{log.moderator_username}</span>
                          {' → '}
                          <span style={{ color:'#5fffff' }}>{log.target_username}</span>
                        </span>
                      </div>
                      <span style={{ color:'#333', fontSize:'10px' }}>
                        {log.created_date ? new Date(log.created_date).toLocaleString() : ''}
                      </span>
                    </div>
                    {log.reason && <div style={{ color:'#888', fontSize:'11px', marginTop:'3px' }}>Reason: {log.reason}</div>}
                    {log.duration_hours && <div style={{ color:'#888', fontSize:'11px', marginTop:'2px' }}>Duration: {log.duration_hours}h</div>}
                    {log.rp_change && <div style={{ color:log.rp_change>0?'#7dff7d':'#ff4444', fontSize:'11px', marginTop:'2px' }}>RP: {log.rp_change>0?'+':''}{log.rp_change}</div>}
                  </div>
                );
              }) : (
                <div style={{ textAlign:'center', color:'#444', fontSize:'12px', padding:'20px' }}>No logs found.</div>
              )}
            </>
          )}

          {result && (
            <div className="result-box">
              ✓ {result.message || 'Action successful!'}
              {result.action_taken && <div style={{ marginTop:'4px', color:'#5fffff' }}>{result.action_taken}</div>}
              {result.old_role && result.new_role && <div>Role: {result.old_role} → {result.new_role}</div>}
              {result.total_rp && <div>Total RP: {result.total_rp.toLocaleString()}</div>}
            </div>
          )}
          {error && <div className="error-box">⚠ {error}</div>}
        </div>
      </div>
    </div>
  );
}