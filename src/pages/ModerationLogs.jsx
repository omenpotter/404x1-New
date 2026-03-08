import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

const ACTION_COLORS = {
  mute: 'var(--orange)',
  spam_penalty: 'var(--red)',
  delete_message: 'var(--red)',
  award_rp: 'var(--green)',
  change_role: 'var(--purple)',
  permanent_ban: '#ff0000',
};

const PAGE_SIZE = 20;

export default function ModerationLogs() {
  const [user] = useState(getUser());
  const [logs, setLogs] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchMod, setSearchMod] = useState('');
  const [searchTarget, setSearchTarget] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user || !['moderator', 'admin', 'superuser'].includes(user.user_role)) return;
    fetchLogs();
  }, []);

  useEffect(() => {
    let result = logs;
    if (searchMod) result = result.filter(l => l.moderator_username?.toLowerCase().includes(searchMod.toLowerCase()));
    if (searchTarget) result = result.filter(l => l.target_username?.toLowerCase().includes(searchTarget.toLowerCase()));
    if (filterAction !== 'all') result = result.filter(l => l.action_type === filterAction);
    setFiltered(result);
    setPage(1);
  }, [searchMod, searchTarget, filterAction, logs]);

  const fetchLogs = async () => {
    setLoading(true);
    const data = await base44.entities.ModerationLog.list('-created_date', 500);
    setLogs(data);
    setFiltered(data);
    setLoading(false);
  };

  if (!user || !['moderator', 'admin', 'superuser'].includes(user.user_role)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Share Tech Mono', monospace", color: 'var(--red)' }}>
        ACCESS DENIED — MODERATORS AND ABOVE ONLY
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const actionTypes = [...new Set(logs.map(l => l.action_type).filter(Boolean))];

  const fmt = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', color: 'var(--text)', fontFamily: "'Share Tech Mono', monospace", padding: '24px 20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontFamily: "'Rubik Mono One', monospace", color: 'var(--red)', fontSize: '28px', letterSpacing: '3px', marginBottom: '4px' }}>
            MODERATION LOGS
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
            {filtered.length} record{filtered.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px', letterSpacing: '1px' }}>MODERATOR</label>
            <input
              value={searchMod}
              onChange={e => setSearchMod(e.target.value)}
              placeholder="Search by moderator..."
              style={{ width: '100%', padding: '8px 12px', background: 'var(--dark3)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = 'var(--red)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px', letterSpacing: '1px' }}>TARGET USER</label>
            <input
              value={searchTarget}
              onChange={e => setSearchTarget(e.target.value)}
              placeholder="Search by target..."
              style={{ width: '100%', padding: '8px 12px', background: 'var(--dark3)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = 'var(--red)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px', letterSpacing: '1px' }}>ACTION TYPE</label>
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--dark3)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
            >
              <option value="all">All Actions</option>
              {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => { setSearchMod(''); setSearchTarget(''); setFilterAction('all'); }}
              style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', cursor: 'pointer' }}
              onMouseEnter={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.color = 'var(--red)'; }}
              onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-dim)'; }}
            >
              CLEAR FILTERS
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: '2px', overflowX: 'auto' }}>
          {/* Table Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 110px 110px 110px 80px 80px 1fr', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '1px', minWidth: '800px' }}>
            <span>DATE</span>
            <span>MODERATOR</span>
            <span>TARGET</span>
            <span>ACTION</span>
            <span>RP CHANGE</span>
            <span>DURATION</span>
            <span>REASON</span>
          </div>

          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
              Loading logs...
            </div>
          )}

          {!loading && paginated.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
              No moderation logs found.
            </div>
          )}

          {!loading && paginated.map((log, i) => (
            <div
              key={log.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 110px 110px 110px 80px 80px 1fr',
                padding: '10px 16px',
                borderBottom: i < paginated.length - 1 ? '1px solid #0f0f0f' : 'none',
                fontSize: '11px',
                alignItems: 'center',
                minWidth: '800px',
                borderLeft: `2px solid ${ACTION_COLORS[log.action_type] || 'var(--border)'}`,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--dark3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: 'var(--text-dim)' }}>{fmt(log.created_date)}</span>
              <span>
                <span style={{ color: 'var(--text)' }}>{log.moderator_username || '—'}</span>
                {log.moderator_role && (
                  <span style={{ display: 'block', fontSize: '9px', color: 'var(--text-dim)', marginTop: '1px' }}>{log.moderator_role}</span>
                )}
              </span>
              <span style={{ color: 'var(--cyan)' }}>{log.target_username || '—'}</span>
              <span style={{ color: ACTION_COLORS[log.action_type] || 'var(--text)', fontWeight: 'bold', fontSize: '10px', letterSpacing: '0.5px' }}>
                {log.action_type?.replace(/_/g, ' ').toUpperCase() || '—'}
              </span>
              <span style={{ color: log.rp_change > 0 ? 'var(--green)' : log.rp_change < 0 ? 'var(--red)' : 'var(--text-dim)' }}>
                {log.rp_change != null ? (log.rp_change > 0 ? '+' : '') + log.rp_change : '—'}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>
                {log.duration_hours ? log.duration_hours + 'h' : '—'}
              </span>
              <span style={{ color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.reason || '—'}
              </span>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)', color: page === 1 ? 'var(--border)' : 'var(--text-dim)', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
            >
              ← PREV
            </button>
            <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)', color: page === totalPages ? 'var(--border)' : 'var(--text-dim)', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
            >
              NEXT →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}