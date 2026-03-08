import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const ROLE_COLORS = { member: '#888', trusted: '#5fffff', moderator: '#ffaa00', admin: '#ff4444', superuser: '#aa44ff' };
const ROLES       = ['member', 'trusted', 'moderator', 'admin', 'superuser'];
const ACTION_COLORS = { mute: '#ffaa00', unmute: '#7dff7d', spam_penalty: '#ff4444', delete_message: '#ff4444', warning: '#ffaa00', change_role: '#aa44ff', permanent_ban: '#ff0000', award_rp: '#7dff7d' };
const PAGE_SIZE   = 15;

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

export default function ModPanel() {
  const [user, setUser]             = useState(null);
  const [tab, setTab]               = useState('mute');

  // Player search
  const [searchInput, setSearchInput]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [searching, setSearching]       = useState(false);

  // Action fields
  const [reason, setReason]         = useState('');
  const [duration, setDuration]     = useState(60);
  const [newRole, setNewRole]       = useState('member');
  const [rpAmount, setRpAmount]     = useState(100);
  const [rpReason, setRpReason]     = useState('');
  const [messageId, setMessageId]   = useState('');
  const [warnSeverity, setWarnSeverity] = useState('medium');
  const [loading, setLoading]       = useState(false);

  // Logs
  const [logs, setLogs]             = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter]   = useState('all');
  const [logPage, setLogPage]       = useState(1);

  useEffect(() => {
    setUser(getUser());
  }, []);

  useEffect(() => {
    if (tab === 'logs') fetchLogs();
  }, [tab]);

  const canAccess  = user && ['moderator', 'admin', 'superuser'].includes(user.user_role);
  const isAdmin    = user && ['admin', 'superuser'].includes(user.user_role);
  const isSuperuser = user && user.user_role === 'superuser';

  // ── Player search ──────────────────────────────────────────────────────────
  const searchPlayer = async () => {
    if (!searchInput.trim() || searchInput.length < 2) return;
    setSearching(true);
    try {
      const res = await base44.functions.invoke('playerSearch', { username: searchInput.trim() });
      setSearchResults(res.data.players || []);
    } catch { toast.error('Search failed'); }
    setSearching(false);
  };

  const selectPlayer = (p) => {
    setSelectedPlayer(p);
    setSearchResults([]);
    setSearchInput(p.username);
  };

  // ── Generic action caller ──────────────────────────────────────────────────
  const callAction = async (fn, body) => {
    if (!selectedPlayer) { toast.error('Select a player first'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke(fn, { ...body, target_player_id: selectedPlayer.id });
      if (res.data.success) {
        toast.success('Action completed successfully');
        setReason('');
        setRpReason('');
        setMessageId('');
      } else {
        toast.error(res.data.error || 'Action failed');
      }
    } catch (e) {
      toast.error(e.message || 'Network error');
    }
    setLoading(false);
  };

  const handleMute        = () => callAction('moderateUser', { moderator_id: user.id, action_type: 'mute', duration_hours: Math.max(1, Math.round(duration / 60)), reason });
  const handleUnmute      = () => callAction('moderateUser', { moderator_id: user.id, action_type: 'unmute', reason });
  const handleSpamPenalty = () => callAction('moderateUser', { moderator_id: user.id, action_type: 'spam_penalty', rp_penalty: 10, reason });
  const handleDeleteMsg   = () => { if (!messageId) { toast.error('Message ID required'); return; } callAction('moderateUser', { moderator_id: user.id, action_type: 'delete_message', message_id: messageId, reason }); };
  const handleChangeRole  = () => callAction('changeRole', { admin_id: user.id, new_role: newRole });
  const handleGrantRp     = () => { if (!rpReason) { toast.error('Reason required'); return; } callAction('awardRp', { from_player_id: user.id, amount: rpAmount, reason: rpReason }); };
  const handleWarn        = () => callAction('issueWarning', { severity: warnSeverity, reason, message_id: messageId || undefined });

  // ── Logs ──────────────────────────────────────────────────────────────────
  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await base44.entities.ModerationLog.list('-created_date', 500);
      setLogs(data);
    } catch {}
    setLogsLoading(false);
  };

  const filteredLogs  = logFilter === 'all' ? logs : logs.filter(l => l.action_type === logFilter);
  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pagedLogs     = filteredLogs.slice((logPage - 1) * PAGE_SIZE, logPage * PAGE_SIZE);
  const logActionTypes = [...new Set(logs.map(l => l.action_type).filter(Boolean))];

  const fmt = (iso) => iso ? new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—';

  if (!user) {
    return (
      <div style={{ minHeight: 'calc(100vh - 54px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div style={{ color: '#ff4444', fontFamily: "'Share Tech Mono', monospace", textAlign: 'center' }}>
          <div style={{ fontSize: '16px', marginBottom: '12px' }}>⚠ LOGIN REQUIRED</div>
          <a href={createPageUrl('Chat')} style={{ color: '#7dff7d', fontSize: '12px' }}>← Back to Chat</a>
        </div>
      </div>
    );
  }
  if (!canAccess) {
    return (
      <div style={{ minHeight: 'calc(100vh - 54px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div style={{ color: '#ff4444', fontFamily: "'Share Tech Mono', monospace", textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚫</div>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>ACCESS DENIED</div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>Moderator role required</div>
          <a href={createPageUrl('Chat')} style={{ color: '#7dff7d', fontSize: '12px' }}>← Back to Chat</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 54px)', background: '#0a0a0a', padding: '20px', fontFamily: "'Share Tech Mono', monospace" }}>
      <style>{`
        .mod-wrap { max-width: 900px; margin: 0 auto; }
        .mod-title { font-family: 'Rubik Mono One', monospace; color: #ff4444; font-size: 24px; letter-spacing: 3px; }
        .mod-sub { color: #888; font-size: 11px; margin-bottom: 20px; margin-top: 4px; }
        .tabs { display: flex; flex-wrap: wrap; gap: 0; border: 1px solid #2a2a2a; margin-bottom: 20px; }
        .tab-btn { padding: 10px 14px; border: none; background: transparent; color: #888; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 11px; white-space: nowrap; transition: all 0.2s; }
        .tab-btn.active { background: #1a1a1a; color: #ff4444; border-bottom: 2px solid #ff4444; }
        .tab-btn:hover:not(.active) { color: #e0e0e0; background: #111; }
        .tab-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .panel { background: #111; border: 1px solid #2a2a2a; padding: 24px; }
        .field { margin-bottom: 16px; }
        .field-label { font-size: 11px; color: #888; margin-bottom: 6px; display: block; letter-spacing: 1px; }
        .field-input { width: 100%; padding: 10px 12px; background: #1a1a1a; border: 1px solid #2a2a2a; color: #e0e0e0; font-family: 'Share Tech Mono', monospace; font-size: 13px; outline: none; box-sizing: border-box; }
        .field-input:focus { border-color: #ff4444; }
        .action-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; }
        .mod-btn { padding: 10px 20px; border: 1px solid; background: transparent; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 12px; transition: all 0.2s; }
        .mod-btn.danger { border-color: #ff4444; color: #ff4444; }
        .mod-btn.danger:hover:not(:disabled) { background: #ff4444; color: #fff; }
        .mod-btn.warn { border-color: #ffaa00; color: #ffaa00; }
        .mod-btn.warn:hover:not(:disabled) { background: #ffaa00; color: #0a0a0a; }
        .mod-btn.safe { border-color: #7dff7d; color: #7dff7d; }
        .mod-btn.safe:hover:not(:disabled) { background: #7dff7d; color: #0a0a0a; }
        .mod-btn.info { border-color: #5fffff; color: #5fffff; }
        .mod-btn.info:hover:not(:disabled) { background: #5fffff; color: #0a0a0a; }
        .mod-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .dur-grid { display: flex; gap: 6px; flex-wrap: wrap; }
        .dur-btn { padding: 6px 12px; border: 1px solid #2a2a2a; background: transparent; color: #888; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 11px; }
        .dur-btn.active { border-color: #ff4444; color: #ff4444; }
        select.field-input { cursor: pointer; }

        /* Player search */
        .search-wrap { position: relative; }
        .search-row { display: flex; gap: 8px; }
        .search-results { position: absolute; top: 100%; left: 0; right: 0; background: #1a1a1a; border: 1px solid #2a2a2a; z-index: 50; max-height: 200px; overflow-y: auto; }
        .search-result-item { padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #111; font-size: 12px; display: flex; align-items: center; gap: 8px; }
        .search-result-item:hover { background: #2a2a2a; }
        .selected-player { background: #1a1a1a; border: 1px solid #2a2a2a; padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
        .clear-btn { background: none; border: none; color: #666; cursor: pointer; font-size: 14px; }
        .clear-btn:hover { color: #ff4444; }

        /* Logs */
        .log-row { display: grid; grid-template-columns: 120px 100px 100px 110px 60px 1fr; padding: 8px 14px; border-bottom: 1px solid #0f0f0f; font-size: 11px; align-items: center; min-width: 700px; }
        .log-header { display: grid; grid-template-columns: 120px 100px 100px 110px 60px 1fr; padding: 8px 14px; border-bottom: 1px solid #2a2a2a; font-size: 10px; color: #555; letter-spacing: 1px; min-width: 700px; }
        .sev-btn { padding: 5px 10px; border: 1px solid #2a2a2a; background: transparent; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 11px; }
        .sev-btn.low.active { border-color: #ffaa00; color: #ffaa00; }
        .sev-btn.medium.active { border-color: #ff8800; color: #ff8800; }
        .sev-btn.high.active { border-color: #ff4444; color: #ff4444; }
        .sev-btn:not(.active) { color: #555; }
      `}</style>

      <div className="mod-wrap">
        <div className="mod-title">MOD PANEL
          <span style={{ fontSize: '12px', fontFamily: "'Share Tech Mono', monospace", color: ROLE_COLORS[user.user_role], border: `1px solid ${ROLE_COLORS[user.user_role]}`, padding: '3px 8px', marginLeft: '12px', verticalAlign: 'middle' }}>
            {user.user_role?.toUpperCase()}
          </span>
        </div>
        <div className="mod-sub">Logged in as {user.username} · Moderation tools for community management</div>

        {/* Player search — always visible */}
        <div className="panel" style={{ marginBottom: '16px' }}>
          <div className="field-label">🔍 SEARCH PLAYER BY USERNAME</div>
          <div className="search-wrap">
            <div className="search-row">
              <input
                className="field-input"
                placeholder="Type username to search..."
                value={searchInput}
                onChange={e => { setSearchInput(e.target.value); if (!e.target.value) { setSearchResults([]); setSelectedPlayer(null); } }}
                onKeyDown={e => e.key === 'Enter' && searchPlayer()}
              />
              <button className="mod-btn info" onClick={searchPlayer} disabled={searching} style={{ whiteSpace: 'nowrap' }}>
                {searching ? '...' : 'SEARCH'}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(p => (
                  <div key={p.id} className="search-result-item" onClick={() => selectPlayer(p)}>
                    <span style={{ color: ROLE_COLORS[p.user_role] || '#888' }}>●</span>
                    <span style={{ color: '#e0e0e0' }}>{p.username}</span>
                    <span style={{ color: '#555', fontSize: '10px' }}>{p.user_role?.toUpperCase()}</span>
                    <span style={{ color: '#7dff7d', fontSize: '10px', marginLeft: 'auto' }}>{(p.reputation_points || 0).toLocaleString()} RP</span>
                    {p.is_muted && <span style={{ color: '#ff4444', fontSize: '9px' }}>MUTED</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedPlayer && (
            <div className="selected-player" style={{ marginTop: '10px' }}>
              <div>
                <span style={{ color: ROLE_COLORS[selectedPlayer.user_role] }}>{selectedPlayer.username}</span>
                <span style={{ color: '#555', fontSize: '10px', marginLeft: '8px' }}>{selectedPlayer.user_role?.toUpperCase()}</span>
                <span style={{ color: '#7dff7d', fontSize: '10px', marginLeft: '8px' }}>{(selectedPlayer.reputation_points || 0).toLocaleString()} RP</span>
                {selectedPlayer.is_muted && <span style={{ color: '#ff4444', fontSize: '10px', marginLeft: '8px' }}>🔇 MUTED</span>}
                <a href={createPageUrl('Profile') + '?id=' + selectedPlayer.id} style={{ color: '#5fffff', fontSize: '10px', marginLeft: '12px' }} target="_blank" rel="noopener noreferrer">View Profile ↗</a>
              </div>
              <button className="clear-btn" onClick={() => { setSelectedPlayer(null); setSearchInput(''); }}>✕</button>
            </div>
          )}
        </div>

        {/* Action Tabs */}
        <div className="tabs">
          <button className={`tab-btn${tab === 'mute' ? ' active' : ''}`} onClick={() => setTab('mute')}>🔇 MUTE</button>
          <button className={`tab-btn${tab === 'warn' ? ' active' : ''}`} onClick={() => setTab('warn')}>⚠ WARN</button>
          <button className={`tab-btn${tab === 'message' ? ' active' : ''}`} onClick={() => setTab('message')}>🗑 MESSAGE</button>
          <button className={`tab-btn${tab === 'role' ? ' active' : ''}`} onClick={() => setTab('role')} disabled={!isSuperuser}>👑 ROLES {!isSuperuser && '🔒'}</button>
          {isSuperuser && <button className={`tab-btn${tab === 'rp' ? ' active' : ''}`} onClick={() => setTab('rp')}>💎 GRANT RP</button>}
          <button className={`tab-btn${tab === 'logs' ? ' active' : ''}`} onClick={() => setTab('logs')}>📋 LOGS</button>
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
                  {[5, 15, 30, 60, 120, 1440].map(d => (
                    <button key={d} className={`dur-btn${duration === d ? ' active' : ''}`} onClick={() => setDuration(d)}>
                      {d >= 1440 ? `${d/1440}d` : d >= 60 ? `${d/60}h` : `${d}m`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="action-row">
                <button className="mod-btn danger" onClick={handleMute} disabled={!selectedPlayer || loading}>{loading ? '...' : '🔇 MUTE'}</button>
                <button className="mod-btn warn" onClick={handleUnmute} disabled={!selectedPlayer || loading}>🔊 UNMUTE</button>
                <button className="mod-btn warn" onClick={handleSpamPenalty} disabled={!selectedPlayer || loading}>⚡ SPAM PENALTY</button>
              </div>
            </>
          )}

          {/* WARN */}
          {tab === 'warn' && (
            <>
              <div className="field">
                <label className="field-label">WARNING SEVERITY</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['low', 'medium', 'high'].map(s => (
                    <button key={s} className={`sev-btn ${s}${warnSeverity === s ? ' active' : ''}`} onClick={() => setWarnSeverity(s)}>{s.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="field-label">REASON *</label>
                <input className="field-input" placeholder="Reason for warning..." value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">RELATED MESSAGE ID (optional)</label>
                <input className="field-input" placeholder="Message ID if applicable..." value={messageId} onChange={e => setMessageId(e.target.value)} />
              </div>
              <div style={{ padding: '10px', background: '#1a1a1a', border: '1px solid #2a2a2a', fontSize: '11px', color: '#666', marginBottom: '16px' }}>
                ⚠ Warnings are logged in the audit trail and visible to the recipient on their profile.
              </div>
              <div className="action-row">
                <button className="mod-btn warn" onClick={handleWarn} disabled={!selectedPlayer || !reason || loading}>{loading ? '...' : '⚠ ISSUE WARNING'}</button>
              </div>
            </>
          )}

          {/* DELETE MESSAGE */}
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
                <button className="mod-btn danger" onClick={handleDeleteMsg} disabled={!messageId || !selectedPlayer || loading}>{loading ? '...' : '🗑 DELETE MESSAGE'}</button>
              </div>
            </>
          )}

          {/* CHANGE ROLE */}
          {tab === 'role' && isSuperuser && (
            <>
              <div className="field">
                <label className="field-label">NEW ROLE</label>
                <select className="field-input" value={newRole} onChange={e => setNewRole(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                </select>
              </div>
              <div style={{ padding: '10px', background: '#1a1a1a', border: '1px solid #2a2a2a', fontSize: '11px', color: '#666', marginBottom: '16px' }}>
                Role hierarchy: member → trusted → moderator → admin → superuser<br />⚠ Only superusers can assign roles.
              </div>
              <div className="action-row">
                <button className="mod-btn info" onClick={handleChangeRole} disabled={!selectedPlayer || loading}>{loading ? '...' : '👑 CHANGE ROLE'}</button>
              </div>
            </>
          )}

          {/* GRANT RP */}
          {tab === 'rp' && isSuperuser && (
            <>
              <div className="field">
                <label className="field-label">RP AMOUNT</label>
                <input className="field-input" type="number" value={rpAmount} onChange={e => setRpAmount(parseInt(e.target.value) || 0)} min={1} />
              </div>
              <div className="field">
                <label className="field-label">REASON *</label>
                <input className="field-input" placeholder="Reason for RP grant..." value={rpReason} onChange={e => setRpReason(e.target.value)} />
              </div>
              <div className="action-row">
                <button className="mod-btn safe" onClick={handleGrantRp} disabled={!selectedPlayer || !rpReason || loading}>{loading ? '...' : '💎 GRANT RP'}</button>
              </div>
            </>
          )}

          {/* LOGS — embedded */}
          {tab === 'logs' && (
            <>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={logFilter}
                  onChange={e => { setLogFilter(e.target.value); setLogPage(1); }}
                  style={{ padding: '6px 10px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', outline: 'none' }}
                >
                  <option value="all">All Actions</option>
                  {logActionTypes.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <button className="mod-btn info" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={fetchLogs}>↻ REFRESH</button>
                <span style={{ color: '#555', fontSize: '11px', marginLeft: 'auto' }}>{filteredLogs.length} records</span>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #1a1a1a' }}>
                <div className="log-header">
                  <span>DATE</span><span>MODERATOR</span><span>TARGET</span><span>ACTION</span><span>RP</span><span>REASON</span>
                </div>
                {logsLoading && <div style={{ padding: '30px', textAlign: 'center', color: '#444', fontSize: '12px' }}>Loading logs...</div>}
                {!logsLoading && pagedLogs.length === 0 && <div style={{ padding: '30px', textAlign: 'center', color: '#444', fontSize: '12px' }}>No logs found.</div>}
                {!logsLoading && pagedLogs.map((log, i) => (
                  <div key={log.id} className="log-row"
                    style={{ borderLeft: `2px solid ${ACTION_COLORS[log.action_type] || '#2a2a2a'}` }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ color: '#555' }}>{fmt(log.created_date)}</span>
                    <span style={{ color: '#e0e0e0' }}>{log.moderator_username || '—'}</span>
                    <span style={{ color: '#5fffff' }}>{log.target_username || '—'}</span>
                    <span style={{ color: ACTION_COLORS[log.action_type] || '#888', fontSize: '10px', fontWeight: 'bold' }}>{log.action_type?.replace(/_/g, ' ').toUpperCase() || '—'}</span>
                    <span style={{ color: (log.rp_change || 0) >= 0 ? '#7dff7d' : '#ff4444' }}>{log.rp_change != null ? (log.rp_change > 0 ? '+' : '') + log.rp_change : '—'}</span>
                    <span style={{ color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.reason || '—'}</span>
                  </div>
                ))}
              </div>

              {totalLogPages > 1 && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px', alignItems: 'center' }}>
                  <button className="mod-btn info" style={{ padding: '5px 12px', fontSize: '11px' }} onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}>← PREV</button>
                  <span style={{ color: '#555', fontSize: '11px' }}>Page {logPage} / {totalLogPages}</span>
                  <button className="mod-btn info" style={{ padding: '5px 12px', fontSize: '11px' }} onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))} disabled={logPage === totalLogPages}>NEXT →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}