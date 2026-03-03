import React, { useState, useEffect } from 'react';
import { createPageUrl } from '@/utils';

const BASE = 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/';
const ROLE_COLORS = { member: '#888', trusted: '#5fffff', moderator: '#ffaa00', admin: '#ff4444', superuser: '#aa44ff' };
const ROLES = ['member', 'trusted', 'moderator', 'admin'];

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

export default function ModPanel() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('mute');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(60);
  const [newRole, setNewRole] = useState('member');
  const [rpAmount, setRpAmount] = useState(100);
  const [rpReason, setRpReason] = useState('');
  const [messageId, setMessageId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const u = getUser();
    setUser(u);
  }, []);

  const canAccess = user && ['moderator', 'admin', 'superuser'].includes(user.user_role);
  const isAdmin = user && ['admin', 'superuser'].includes(user.user_role);

  const callAPI = async (endpoint, body) => {
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const res = await fetch(BASE + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Action failed');
      }
    } catch (e) {
      setError('Network error: ' + e.message);
    }
    setLoading(false);
  };

  const handleMute = () => callAPI('moderateUser', {
    moderator_id: user.id,
    action: 'mute',
    target_player_id: targetId,
    duration_minutes: duration,
    reason
  });

  const handleUnmute = () => callAPI('moderateUser', {
    moderator_id: user.id,
    action: 'unmute',
    target_player_id: targetId,
    reason
  });

  const handleSpamPenalty = () => callAPI('moderateUser', {
    moderator_id: user.id,
    action: 'spam_penalty',
    target_player_id: targetId,
    reason
  });

  const handleDeleteMsg = () => callAPI('moderateUser', {
    moderator_id: user.id,
    action: 'delete_message',
    message_id: messageId,
    reason
  });

  const handleChangeRole = () => callAPI('changeRole', {
    admin_id: user.id,
    target_player_id: targetId,
    new_role: newRole
  });

  const handleGrantRp = () => callAPI('awardRp', {
    admin_id: user.id,
    target_player_id: targetId,
    amount: rpAmount,
    reason: rpReason
  });

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
        .mod-wrap { max-width: 800px; margin: 0 auto; }
        .mod-title { font-family: 'Rubik Mono One', monospace; color: #ff4444; font-size: 24px; margin-bottom: 4px; letter-spacing: 3px; text-shadow: 0 0 15px #ff4444; }
        .mod-sub { color: #888; font-size: 11px; margin-bottom: 20px; }
        .mod-role-badge { display: inline-block; padding: 3px 10px; border-radius: 2px; font-size: 11px; border: 1px solid; margin-left: 12px; vertical-align: middle; }
        .tabs { display: flex; flex-wrap: wrap; gap: 0; border: 1px solid #2a2a2a; margin-bottom: 20px; }
        .tab-btn { padding: 10px 16px; border: none; background: transparent; color: #888; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 12px; transition: all 0.2s; }
        .tab-btn.active { background: #1a1a1a; color: #ff4444; border-bottom: 2px solid #ff4444; }
        .tab-btn:hover:not(.active) { color: #e0e0e0; background: #111; }
        .tab-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .panel { background: #111; border: 1px solid #2a2a2a; padding: 24px; }
        .field { margin-bottom: 16px; }
        .field-label { font-size: 11px; color: #888; margin-bottom: 6px; display: block; }
        .field-input { width: 100%; padding: 10px 12px; background: #1a1a1a; border: 1px solid #2a2a2a; color: #e0e0e0; font-family: 'Share Tech Mono', monospace; font-size: 13px; outline: none; }
        .field-input:focus { border-color: #ff4444; }
        .action-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; }
        .mod-btn { padding: 10px 20px; border: 1px solid; background: transparent; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 12px; transition: all 0.2s; }
        .mod-btn.danger { border-color: #ff4444; color: #ff4444; }
        .mod-btn.danger:hover { background: #ff4444; color: #fff; }
        .mod-btn.warn { border-color: #ffaa00; color: #ffaa00; }
        .mod-btn.warn:hover { background: #ffaa00; color: #0a0a0a; }
        .mod-btn.safe { border-color: #7dff7d; color: #7dff7d; }
        .mod-btn.safe:hover { background: #7dff7d; color: #0a0a0a; }
        .mod-btn.info { border-color: #5fffff; color: #5fffff; }
        .mod-btn.info:hover { background: #5fffff; color: #0a0a0a; }
        .mod-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .result-box { margin-top: 16px; padding: 12px; border: 1px solid #7dff7d; background: rgba(125,255,125,0.05); font-size: 12px; color: #7dff7d; }
        .error-box { margin-top: 16px; padding: 12px; border: 1px solid #ff4444; background: rgba(255,68,68,0.05); font-size: 12px; color: #ff4444; }
        .dur-grid { display: flex; gap: 6px; flex-wrap: wrap; }
        .dur-btn { padding: 6px 12px; border: 1px solid #2a2a2a; background: transparent; color: #888; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 11px; }
        .dur-btn.active { border-color: #ff4444; color: #ff4444; }
        select.field-input { cursor: pointer; }
      `}</style>

      <div className="mod-wrap">
        <div>
          <span className="mod-title">MOD PANEL</span>
          <span className="mod-role-badge" style={{ color: ROLE_COLORS[user.user_role], borderColor: ROLE_COLORS[user.user_role] + '66' }}>
            {user.user_role?.toUpperCase()}
          </span>
        </div>
        <div className="mod-sub">Logged in as {user.username || user.chat_username} &nbsp;·&nbsp; Moderation tools for maintaining community standards</div>

        <div className="tabs">
          <button className={`tab-btn${tab === 'mute' ? ' active' : ''}`} onClick={() => setTab('mute')}>🔇 MUTE</button>
          <button className={`tab-btn${tab === 'message' ? ' active' : ''}`} onClick={() => setTab('message')}>🗑 MESSAGE</button>
          <button className={`tab-btn${tab === 'role' ? ' active' : ''}`} onClick={() => setTab('role')} disabled={!isAdmin}>👑 ROLES {!isAdmin && '🔒'}</button>
          <button className={`tab-btn${tab === 'rp' ? ' active' : ''}`} onClick={() => setTab('rp')} disabled={!isAdmin}>💎 GRANT RP {!isAdmin && '🔒'}</button>
        </div>

        <div className="panel">
          {tab === 'mute' && (
            <>
              <div className="field">
                <label className="field-label">TARGET PLAYER ID *</label>
                <input className="field-input" placeholder="Player ID to mute/unmute..." value={targetId} onChange={e => setTargetId(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">REASON</label>
                <input className="field-input" placeholder="Reason for action..." value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">MUTE DURATION (MINUTES)</label>
                <div className="dur-grid">
                  {[5, 15, 30, 60, 120, 1440].map(d => (
                    <button key={d} className={`dur-btn${duration === d ? ' active' : ''}`} onClick={() => setDuration(d)}>
                      {d >= 1440 ? `${d/1440}d` : d >= 60 ? `${d/60}h` : `${d}m`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="action-row">
                <button className="mod-btn danger" onClick={handleMute} disabled={!targetId || loading}>
                  {loading ? '...' : '🔇 MUTE USER'}
                </button>
                <button className="mod-btn warn" onClick={handleUnmute} disabled={!targetId || loading}>
                  🔊 UNMUTE USER
                </button>
                <button className="mod-btn warn" onClick={handleSpamPenalty} disabled={!targetId || loading}>
                  ⚡ SPAM PENALTY (-RP)
                </button>
              </div>
            </>
          )}

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
                <button className="mod-btn danger" onClick={handleDeleteMsg} disabled={!messageId || loading}>
                  {loading ? '...' : '🗑 DELETE MESSAGE'}
                </button>
              </div>
              <div style={{ marginTop: '16px', padding: '10px', background: '#1a1a1a', border: '1px solid #2a2a2a', fontSize: '11px', color: '#666' }}>
                💡 TIP: You can find message IDs by inspecting the chat API responses or using the chatHistory endpoint.
              </div>
            </>
          )}

          {tab === 'role' && isAdmin && (
            <>
              <div className="field">
                <label className="field-label">TARGET PLAYER ID *</label>
                <input className="field-input" placeholder="Player ID to change role..." value={targetId} onChange={e => setTargetId(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">NEW ROLE</label>
                <select className="field-input" value={newRole} onChange={e => setNewRole(e.target.value)}>
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div style={{ padding: '10px', background: '#1a1a1a', border: '1px solid #2a2a2a', fontSize: '11px', color: '#666', marginBottom: '16px' }}>
                Role hierarchy: member → trusted → moderator → admin
                <br />⚠ You cannot promote to superuser through this panel.
              </div>
              <div className="action-row">
                <button className="mod-btn info" onClick={handleChangeRole} disabled={!targetId || loading}>
                  {loading ? '...' : '👑 CHANGE ROLE'}
                </button>
              </div>
            </>
          )}

          {tab === 'rp' && isAdmin && (
            <>
              <div className="field">
                <label className="field-label">TARGET PLAYER ID *</label>
                <input className="field-input" placeholder="Player ID to grant RP..." value={targetId} onChange={e => setTargetId(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">RP AMOUNT</label>
                <input className="field-input" type="number" value={rpAmount} onChange={e => setRpAmount(parseInt(e.target.value) || 0)} min={1} />
              </div>
              <div className="field">
                <label className="field-label">REASON *</label>
                <input className="field-input" placeholder="Reason for RP grant..." value={rpReason} onChange={e => setRpReason(e.target.value)} />
              </div>
              <div className="action-row">
                <button className="mod-btn safe" onClick={handleGrantRp} disabled={!targetId || !rpReason || loading}>
                  {loading ? '...' : '💎 GRANT RP'}
                </button>
              </div>
            </>
          )}

          {result && (
            <div className="result-box">
              ✓ Action successful!
              {result.action_taken && <div style={{ marginTop: '4px', color: '#5fffff' }}>{result.action_taken}</div>}
              {result.old_role && result.new_role && <div>Role: {result.old_role} → {result.new_role}</div>}
              {result.total_rp && <div>Total RP: {result.total_rp.toLocaleString()}</div>}
              {result.marked_read !== undefined && <div>Marked read: {result.marked_read}</div>}
            </div>
          )}
          {error && <div className="error-box">⚠ {error}</div>}
        </div>
      </div>
    </div>
  );
}