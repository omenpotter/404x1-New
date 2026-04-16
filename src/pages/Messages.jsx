import React, { useState, useEffect, useRef } from 'react';
import { createPageUrl } from '@/utils';

const BASE = 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/';

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}
function getConvs() {
  try { return JSON.parse(localStorage.getItem('404x1_conversations') || '[]'); } catch { return []; }
}
function saveConvs(convs) {
  localStorage.setItem('404x1_conversations', JSON.stringify(convs));
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString();
}

export default function Messages() {
  const [user, setUser] = useState(null);
  const [convs, setConvs] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [newDMTarget, setNewDMTarget] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    if (!u) return;
    const storedConvs = getConvs();
    setConvs(storedConvs);

    const params = new URLSearchParams(window.location.search);
    const convId = params.get('conv');
    const withId = params.get('with');

    if (convId) {
      const existing = storedConvs.find(c => c.id === convId);
      if (existing) {
        setActiveConv(existing);
        loadHistory(convId);
      } else {
        loadHistory(convId);
      }
    } else if (withId) {
      startNewDM(withId, u);
    }
  }, []);

  useEffect(() => {
    if (!activeConv?.id) return;
    loadHistory(activeConv.id);
    const intervalId = setInterval(() => loadHistory(activeConv.id), 2000);
    return () => clearInterval(intervalId);
  }, [activeConv?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const searchPlayers = async (query) => {
    if (!query.trim() || query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(BASE + 'playerSearch?q=' + encodeURIComponent(query) + '&limit=8');
      const data = await res.json();
      if (data.success) setSearchResults(data.players || []);
    } catch {}
    setSearching(false);
  };

  const startNewDM = async (playerId, u = user) => {
    if (!u) return;
    try {
      const res = await fetch(BASE + 'createConversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_player_id: u.id, to_player_id: playerId })
      });
      const data = await res.json();
      if (data.success) {
        const conv = data.conversation;
        const existing = getConvs();
        const already = existing.find(c => c.id === conv.id);
        if (!already) {
          const otherIdx = conv.participant_ids?.indexOf(u.id) === 0 ? 1 : 0;
          const newConv = {
            id: conv.id,
            other_player_id: conv.participant_ids?.[otherIdx],
            other_username: conv.participant_usernames?.[otherIdx] || 'Unknown',
            last_message: conv.last_message || '',
            last_message_at: conv.last_message_at || conv.created_date,
            unread_count: 0
          };
          const updated = [newConv, ...existing];
          saveConvs(updated);
          setConvs(updated);
          setActiveConv({ ...conv, other_username: newConv.other_username });
        } else {
          setActiveConv({ ...conv, other_username: already.other_username });
          setConvs(existing);
        }
        setShowNewDM(false);
        setNewDMTarget('');
        window.history.replaceState({}, '', '?conv=' + conv.id);
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (e) {
      console.error('DM error:', e);
    }
  };

  const loadHistory = async (convId) => {
    if (!convId) return;
    setLoadingHistory(true);
    try {
      const u = getUser();
      const res = await fetch(BASE + `getPrivateHistory?conversation_id=${convId}&player_id=${u?.id}&limit=50&offset=0`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
        // Mark as read
        const unread = (data.messages || []).filter(m => m.sender_id !== u?.id && !m.read_by?.includes(u?.id));
        if (unread.length > 0) {
          markRead(convId, unread.map(m => m.id));
        }
        // Update conv last message
        if (data.conversation) {
          const c = data.conversation;
          const existing = getConvs();
          const idx = existing.findIndex(x => x.id === convId);
          if (idx >= 0) {
            existing[idx] = { ...existing[idx], last_message: c.last_message || existing[idx].last_message, last_message_at: c.last_message_at || existing[idx].last_message_at, unread_count: 0 };
            saveConvs(existing);
            setConvs([...existing]);
          }
        }
      }
    } catch (err) {
      console.error('DM error:', err);
    }
    setLoadingHistory(false);
  };

  const markRead = async (convId, messageIds) => {
    const u = getUser();
    if (!u) return;
    try {
      await fetch(BASE + 'privateReadReceipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: u.id, conversation_id: convId, message_ids: messageIds })
      });
    } catch {}
  };

  const sendMessage = async () => {
    const u = getUser();
    if (!u || !activeConv || !input.trim() || sending) return;
    setSending(true);
    const content = input.trim();
    setInput('');
    try {
      const res = await fetch(BASE + 'sendPrivateMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: activeConv.id, sender_id: u.id, content })
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        // update conv list
        const existing = getConvs();
        const idx = existing.findIndex(c => c.id === activeConv.id);
        if (idx >= 0) {
          existing[idx].last_message = content;
          existing[idx].last_message_at = new Date().toISOString();
          saveConvs(existing);
          setConvs([...existing]);
        }
      }
    } catch (err) {
      console.error('DM error:', err);
    }
    setSending(false);
  };

  const handleTyping = () => {
    const u = getUser();
    if (!u || !activeConv) return;
    if (!isTyping) {
      setIsTyping(true);
      fetch(BASE + 'privateTyping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: u.id, conversation_id: activeConv.id, is_typing: true })
      }).catch(() => {});
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setIsTyping(false), 3000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    handleTyping();
  };

  const deliveryTick = (msg) => {
    const u = getUser();
    if (!u || msg.sender_id !== u.id) return null;
    const readBy = msg.read_by || [];
    const deliveredTo = msg.delivered_to || [];
    const othersRead = readBy.filter(id => id !== u.id).length > 0;
    const othersDelivered = deliveredTo.filter(id => id !== u.id).length > 0;
    if (othersRead) return <span style={{ color: '#7dff7d', fontSize: '11px' }}>✓✓</span>;
    if (othersDelivered) return <span style={{ color: '#888', fontSize: '11px' }}>✓✓</span>;
    return <span style={{ color: '#444', fontSize: '11px' }}>✓</span>;
  };

  if (!user) {
    return (
      <div style={{ minHeight: 'calc(100vh - 54px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div style={{ textAlign: 'center', fontFamily: "'Share Tech Mono', monospace" }}>
          <div style={{ color: '#ff4444', fontSize: '16px', marginBottom: '12px' }}>⚠ LOGIN REQUIRED</div>
          <div style={{ color: '#888', fontSize: '12px', marginBottom: '16px' }}>Please connect your wallet to access Messages</div>
          <a href={createPageUrl('Home')} style={{ color: '#7dff7d', fontSize: '13px' }}>← Return to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex', background: '#0a0a0a', overflow: 'hidden' }}>
      <style>{`
        .dm-sidebar { width: 280px; border-right: 1px solid #2a2a2a; display: flex; flex-direction: column; background: #0d0d0d; flex-shrink: 0; }
        .dm-sidebar-header { padding: 14px 16px; border-bottom: 1px solid #2a2a2a; display: flex; align-items: center; justify-content: space-between; }
        .dm-sidebar-title { font-family: 'Rubik Mono One', monospace; color: #7dff7d; font-size: 14px; letter-spacing: 2px; }
        .new-dm-btn { padding: 4px 10px; border: 1px solid #7dff7d; background: transparent; color: #7dff7d; cursor: pointer; font-size: 11px; font-family: 'Share Tech Mono', monospace; }
        .new-dm-btn:hover { background: #7dff7d; color: #0a0a0a; }
        .conv-list { flex: 1; overflow-y: auto; }
        .conv-item { padding: 12px 16px; border-bottom: 1px solid #111; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.15s; }
        .conv-item:hover { background: #111; }
        .conv-item.active { background: #1a1a1a; border-left: 2px solid #7dff7d; }
        .conv-avatar { width: 36px; height: 36px; border-radius: 2px; display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #7dff7d; font-size: 14px; font-weight: bold; flex-shrink: 0; border: 1px solid #2a2a2a; }
        .conv-info { flex: 1; min-width: 0; }
        .conv-name { font-size: 13px; color: #e0e0e0; margin-bottom: 2px; }
        .conv-preview { font-size: 11px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .conv-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .conv-time { font-size: 10px; color: #444; }
        .unread-badge { background: #7dff7d; color: #0a0a0a; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .dm-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .dm-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #444; font-size: 13px; font-family: 'Share Tech Mono', monospace; flex-direction: column; gap: 12px; }
        .dm-header { padding: 12px 16px; border-bottom: 1px solid #2a2a2a; background: #111; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .dm-header-avatar { width: 32px; height: 32px; border-radius: 2px; background: #1a1a1a; border: 1px solid #2a2a2a; display: flex; align-items: center; justify-content: center; color: #7dff7d; font-size: 13px; }
        .dm-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .dm-msg { max-width: 70%; display: flex; flex-direction: column; gap: 2px; }
        .dm-msg.own { align-self: flex-end; align-items: flex-end; }
        .dm-msg.other { align-self: flex-start; align-items: flex-start; }
        .dm-bubble { padding: 8px 12px; font-size: 13px; line-height: 1.5; word-break: break-word; border-radius: 2px; }
        .dm-msg.own .dm-bubble { background: #1a2a1a; border: 1px solid #2a3a2a; color: #e0e0e0; }
        .dm-msg.other .dm-bubble { background: #1a1a1a; border: 1px solid #2a2a2a; color: #e0e0e0; }
        .dm-msg-meta { font-size: 10px; color: #444; display: flex; align-items: center; gap: 4px; }
        .dm-input-area { padding: 12px 16px; border-top: 1px solid #2a2a2a; background: #111; flex-shrink: 0; }
        .dm-input-row { display: flex; gap: 8px; }
        .dm-input { flex: 1; padding: 10px 12px; background: #1a1a1a; border: 1px solid #2a2a2a; color: #e0e0e0; font-family: 'Share Tech Mono', monospace; font-size: 13px; outline: none; }
        .dm-input:focus { border-color: #7dff7d; }
        .dm-send-btn { padding: 10px 16px; border: 1px solid #7dff7d; background: transparent; color: #7dff7d; cursor: pointer; font-family: 'Share Tech Mono', monospace; font-size: 12px; transition: all 0.2s; }
        .dm-send-btn:hover:not(:disabled) { background: #7dff7d; color: #0a0a0a; }
        .dm-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .new-dm-form { padding: 12px 16px; border-bottom: 1px solid #2a2a2a; background: #111; }
        .new-dm-input { width: 100%; padding: 8px 10px; background: #1a1a1a; border: 1px solid #2a2a2a; color: #e0e0e0; font-family: 'Share Tech Mono', monospace; font-size: 12px; outline: none; margin-bottom: 8px; }
        .new-dm-input:focus { border-color: #7dff7d; }
        @media(max-width: 600px) {
          .dm-sidebar { width: 100%; display: ${activeConv ? 'none' : 'flex'}; }
          .dm-main { display: ${activeConv ? 'flex' : 'none'}; }
        }
      `}</style>

      {/* Sidebar */}
      <div className="dm-sidebar">
        <div className="dm-sidebar-header">
          <span className="dm-sidebar-title">DMs</span>
          <button className="new-dm-btn" onClick={() => setShowNewDM(!showNewDM)}>+ NEW</button>
        </div>

        {showNewDM && (
          <div className="new-dm-form">
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '6px' }}>SEARCH PLAYER BY USERNAME:</div>
            <input
              className="new-dm-input"
              placeholder="Type username..."
              value={newDMTarget}
              onChange={e => { setNewDMTarget(e.target.value); searchPlayers(e.target.value); }}
              autoFocus
            />
            {searching && <div style={{ fontSize:'10px', color:'#888', marginBottom:'6px' }}>Searching...</div>}
            {searchResults.length > 0 && (
              <div style={{ background:'#0d0d0d', border:'1px solid #2a2a2a', marginBottom:'8px', maxHeight:'160px', overflowY:'auto' }}>
                {searchResults.map(p => (
                  <div key={p.id}
                    style={{ padding:'8px 10px', cursor:'pointer', fontSize:'12px', color:'#e0e0e0', borderBottom:'1px solid #111', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                    onMouseOver={e => e.currentTarget.style.background='#1a1a1a'}
                    onMouseOut={e => e.currentTarget.style.background='transparent'}
                    onClick={() => { startNewDM(p.id); setSearchResults([]); setNewDMTarget(''); }}
                  >
                    <span style={{ color:'#7dff7d' }}>{p.username}</span>
                    <span style={{ fontSize:'10px', color:'#444' }}>{p.user_role}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => { setShowNewDM(false); setSearchResults([]); setNewDMTarget(''); }}
              style={{ background:'none', border:'1px solid #2a2a2a', color:'#888', cursor:'pointer', padding:'4px 10px', fontSize:'11px', fontFamily:"'Share Tech Mono',monospace", width:'100%' }}>
              CANCEL
            </button>
          </div>
        )}

        <div className="conv-list">
          {convs.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#444', fontSize: '11px' }}>
              No conversations yet.<br />Click + NEW to start one.
            </div>
          )}
          {convs.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)).map(conv => (
            <div
              key={conv.id}
              className={`conv-item${activeConv?.id === conv.id ? ' active' : ''}`}
              onClick={() => { setActiveConv(conv); window.history.replaceState({}, '', '?conv=' + conv.id); }}
            >
              <div className="conv-avatar">{(conv.other_username || '?')[0].toUpperCase()}</div>
              <div className="conv-info">
                <div className="conv-name">{conv.other_username || 'Unknown'}</div>
                <div className="conv-preview">{conv.last_message || 'Start a conversation'}</div>
              </div>
              <div className="conv-meta">
                <span className="conv-time">{formatTime(conv.last_message_at)}</span>
                {conv.unread_count > 0 && (
                  <span className="unread-badge">{conv.unread_count > 9 ? '9+' : conv.unread_count}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="dm-main">
        {!activeConv ? (
          <div className="dm-empty">
            <div style={{ fontSize: '32px' }}>💬</div>
            <div>SELECT A CONVERSATION</div>
            <div style={{ fontSize: '11px' }}>or start a new one with + NEW</div>
          </div>
        ) : (
          <>
            <div className="dm-header">
              <button onClick={() => setActiveConv(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px', display: 'none' }} className="back-btn">←</button>
              <div className="dm-header-avatar">{(activeConv.other_username || '?')[0].toUpperCase()}</div>
              <div>
                <div style={{ color: '#e0e0e0', fontSize: '13px' }}>{activeConv.other_username || 'Unknown'}</div>
                <div style={{ color: '#444', fontSize: '10px' }}>Direct Message</div>
              </div>
            </div>

            <div className="dm-messages">
              {loadingHistory && messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#444', fontSize: '12px', padding: '20px' }}>Loading...</div>
              )}
              {messages.map((msg, i) => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div key={msg.id || i} className={`dm-msg${isOwn ? ' own' : ' other'}`}>
                    {!isOwn && (
                      <div style={{ fontSize: '10px', color: '#7dff7d', marginBottom: '2px' }}>
                        {msg.sender_username || 'Unknown'}
                      </div>
                    )}
                    <div className="dm-bubble">
                      {msg.is_deleted ? <em style={{ color: '#444' }}>[deleted]</em> : (msg.content || '')}
                    </div>
                    <div className="dm-msg-meta">
                      <span>{formatTime(msg.created_at || msg.created_date)}</span>
                      {deliveryTick(msg)}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="dm-input-area">
              <div className="dm-input-row">
                <input
                  className="dm-input"
                  placeholder="Type a message..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={2000}
                />
                <button className="dm-send-btn" onClick={sendMessage} disabled={!input.trim() || sending}>
                  {sending ? '...' : 'SEND'}
                </button>
              </div>
              <div style={{ marginTop: '4px', fontSize: '10px', color: '#444', textAlign: 'right' }}>
                {input.length}/2000
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}