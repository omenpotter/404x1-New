import GateScreen from '@/components/GateScreen';
import React, { useState, useEffect, useRef } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/auth';

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString();
}

export default function Messages() {
  const [user] = useState(getUser());
  const [convs, setConvs] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [newDMTarget, setNewDMTarget] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [deletingConv, setDeletingConv] = useState(null);

  const bottomRef = useRef(null);

  // URL-driven routing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get('conv');
    const withId = params.get('with');
    if (!user) return;
    if (convId) {
      loadConversation(convId);
    } else if (withId) {
      startNewDM(withId);
    }
  }, [user]);

  // Load all conversations
  const loadConversations = async () => {
    if (!user) return;
    try {
      const res = await base44.functions.invoke('getConversations', { session_token: getSessionToken() });
      if (res.data.success) setConvs(res.data.conversations || []);
    } catch (err) {
      console.error('DM error: loadConversations', err);
    }
  };

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  // Poll messages every 2s when a conversation is active
  useEffect(() => {
    if (!activeConv?.id) return;
    const intervalId = setInterval(() => loadHistory(activeConv.id), 2000);
    return () => clearInterval(intervalId);
  }, [activeConv?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const startNewDM = async (playerId) => {
    if (!user || !playerId || playerId === user.id) return;
    try {
      const res = await base44.functions.invoke('createConversation', {
        session_token: getSessionToken(),
        to_player_id: playerId,
      });
      const data = res.data;
      if (!data.success) throw new Error(data.error || 'Failed');
      const conv = data.conversation || data;
      const otherUsername = conv.participant_usernames?.find(u => u !== user.username) || 'Unknown';
      const newConv = { ...conv, other_username: otherUsername };
      setActiveConv(newConv);
      setConvs(prev => {
        const already = prev.find(c => c.id === newConv.id);
        if (already) return prev;
        return [newConv, ...prev];
      });
      setShowNewDM(false);
      setNewDMTarget('');
      setSearchResults([]);
      window.history.replaceState({}, '', `${createPageUrl('Messages')}?conv=${newConv.id}`);
      await loadHistory(newConv.id);
    } catch (err) {
      console.error('DM error: startNewDM', err);
    }
  };

  const loadHistory = async (conversationId) => {
    if (!conversationId || !user) return;
    setLoadingHistory(true);
    try {
      const res = await base44.functions.invoke('getPrivateHistory', {
        conversation_id: conversationId,
        session_token: getSessionToken(),
      });
      if (res.data.success) {
        setMessages(res.data.messages || []);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (err) {
      console.error('DM error: loadHistory', err);
    }
    setLoadingHistory(false);
  };

  const loadConversation = async (convId) => {
    await loadHistory(convId);
    await loadConversations();
    setConvs(prev => {
      const existing = prev.find(c => c.id === convId);
      if (existing) setActiveConv(existing);
      return prev;
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeConv || sending || !user) return;
    setSending(true);
    const content = input.trim();
    setInput('');
    try {
      const res = await base44.functions.invoke('sendPrivateMessage', {
        conversation_id: activeConv.id,
        content,
        session_token: getSessionToken(),
      });
      if (res.data.success) {
        setMessages(prev => [...prev, res.data.message]);
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        setConvs(prev => {
          const updated = prev.map(c =>
            c.id === activeConv.id
              ? { ...c, last_message: content, last_message_at: new Date().toISOString() }
              : c
          );
          if (!updated.find(c => c.id === activeConv.id)) {
            return [{ ...activeConv, last_message: content, last_message_at: new Date().toISOString() }, ...updated];
          }
          return updated;
        });
      }
    } catch (err) {
      console.error('DM error: sendMessage', err);
    }
    setSending(false);
  };

  const deleteConversation = async (convId) => {
    if (!user || !convId) return;
    setDeletingConv(convId);
    try {
      await base44.functions.invoke('deleteConversation', { conversation_id: convId, session_token: getSessionToken() });
      setConvs(prev => prev.filter(c => c.id !== convId));
      if (activeConv?.id === convId) {
        setActiveConv(null);
        setMessages([]);
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err) {
      console.error('DM error: deleteConversation', err);
    }
    setDeletingConv(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const deliveryTick = (msg) => {
    if (!user || msg.sender_id !== user.id) return null;
    const readBy = msg.read_by || [];
    const deliveredTo = msg.delivered_to || [];
    const othersRead = readBy.filter(id => id !== user.id).length > 0;
    const othersDelivered = deliveredTo.filter(id => id !== user.id).length > 0;
    if (othersRead) return <span style={{ color: '#00ff88', fontSize: '11px' }}>✓✓</span>;
    if (othersDelivered) return <span style={{ color: '#82998b', fontSize: '11px' }}>✓✓</span>;
    return <span style={{ color: '#74897c', fontSize: '11px' }}>✓</span>;
  };

  // Debounced player search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (newDMTarget.length < 2) { setSearchResults([]); return; }
      setSearching(true);
      try {
        const res = await base44.functions.invoke('playerSearch', { query: newDMTarget, limit: 8, session_token: getSessionToken() });
        if (res.data.success) setSearchResults(res.data.players || []);
      } catch (err) {
        console.error('DM error: playerSearch', err);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [newDMTarget]);

  if (!user) {
    return <GateScreen title="Private messages" message="Please connect your wallet to access Messages." href={createPageUrl('Home')} linkLabel="Return to Home" />;
  }

  return (
    <div style={{ height: 'calc(100vh - var(--nav-h))', display: 'flex', background: 'transparent', overflow: 'hidden' }}>
      <style>{`
        .dm-sidebar { width: 280px; border-right: 1px solid #1d2b22; display: flex; flex-direction: column; background: #080d0a; flex-shrink: 0; }
        .dm-sidebar-header { padding: 14px 16px; border-bottom: 1px solid #1d2b22; display: flex; align-items: center; justify-content: space-between; }
        .dm-sidebar-title { font-family: var(--font-display); color: #00ff88; font-size: 14px; letter-spacing: 2px; }
        .new-dm-btn { padding: 4px 10px; border: 1px solid #00ff88; background: transparent; color: #00ff88; cursor: pointer; font-size: 11px; font-family: var(--font-body); }
        .new-dm-btn:hover { background: #00ff88; color: #030504; }
        .conv-list { flex: 1; overflow-y: auto; }
        .conv-item { padding: 12px 16px; border-bottom: 1px solid #080d0a; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.15s; }
        .conv-item:hover { background: #080d0a; }
        .conv-item.active { background: #0d1510; border-left: 2px solid #00ff88; }
        .conv-avatar { width: 36px; height: 36px; border-radius: 2px; display: flex; align-items: center; justify-content: center; background: #0d1510; color: #00ff88; font-size: 14px; font-weight: bold; flex-shrink: 0; border: 1px solid #1d2b22; }
        .conv-info { flex: 1; min-width: 0; }
        .conv-name { font-size: 13px; color: #e8fff1; margin-bottom: 2px; }
        .conv-preview { font-size: 11px; color: #74897c; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .conv-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .conv-time { font-size: 10px; color: #74897c; }
        .unread-badge { background: #00ff88; color: #030504; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .dm-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .dm-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #74897c; font-size: 13px; font-family: var(--font-body); flex-direction: column; gap: 12px; }
        .dm-header { padding: 12px 16px; border-bottom: 1px solid #1d2b22; background: #080d0a; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .dm-header-avatar { width: 32px; height: 32px; border-radius: 2px; background: #0d1510; border: 1px solid #1d2b22; display: flex; align-items: center; justify-content: center; color: #00ff88; font-size: 13px; }
        .dm-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
        .dm-msg { max-width: 70%; display: flex; flex-direction: column; gap: 2px; }
        .dm-msg.own { align-self: flex-end; align-items: flex-end; }
        .dm-msg.other { align-self: flex-start; align-items: flex-start; }
        .dm-bubble { padding: 8px 12px; font-size: 13px; line-height: 1.5; word-break: break-word; border-radius: 2px; }
        .dm-msg.own .dm-bubble { background: #16271d; border: 1px solid #1d2b22; color: #e8fff1; }
        .dm-msg.other .dm-bubble { background: #0d1510; border: 1px solid #1d2b22; color: #e8fff1; }
        .dm-msg-meta { font-size: 10px; color: #74897c; display: flex; align-items: center; gap: 4px; }
        .dm-input-area { padding: 12px 16px; border-top: 1px solid #1d2b22; background: #080d0a; flex-shrink: 0; }
        .dm-input-row { display: flex; gap: 8px; }
        .dm-input { flex: 1; padding: 10px 12px; background: #0d1510; border: 1px solid #1d2b22; color: #e8fff1; font-family: var(--font-body); font-size: 13px; outline: none; }
        .dm-input:focus { border-color: #00ff88; }
        .dm-send-btn { padding: 10px 16px; border: 1px solid #00ff88; background: transparent; color: #00ff88; cursor: pointer; font-family: var(--font-body); font-size: 12px; transition: all 0.2s; }
        .dm-send-btn:hover:not(:disabled) { background: #00ff88; color: #030504; }
        .dm-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .new-dm-form { padding: 12px 16px; border-bottom: 1px solid #1d2b22; background: #080d0a; }
        .new-dm-input { width: 100%; padding: 8px 10px; background: #0d1510; border: 1px solid #1d2b22; color: #e8fff1; font-family: var(--font-body); font-size: 12px; outline: none; margin-bottom: 8px; }
        .new-dm-input:focus { border-color: #00ff88; }
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
            <div style={{ fontSize: '10px', color: '#82998b', marginBottom: '6px' }}>SEARCH PLAYER BY USERNAME:</div>
            <input
              className="new-dm-input"
              placeholder="Type username..."
              value={newDMTarget}
              onChange={e => setNewDMTarget(e.target.value)}
              autoFocus
            />
            {searching && <div style={{ fontSize:'10px', color:'#82998b', marginBottom:'6px' }}>Searching...</div>}
            {searchResults.length > 0 && (
              <div style={{ background:'#080d0a', border:'1px solid #1d2b22', marginBottom:'8px', maxHeight:'160px', overflowY:'auto' }}>
                {searchResults.map(p => (
                  <div key={p.id}
                    style={{ padding:'8px 10px', cursor:'pointer', fontSize:'12px', color:'#e8fff1', borderBottom:'1px solid #080d0a', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                    onMouseOver={e => e.currentTarget.style.background='#0d1510'}
                    onMouseOut={e => e.currentTarget.style.background='transparent'}
                    onClick={() => startNewDM(p.id)}
                  >
                    <span style={{ color:'#00ff88' }}>{p.username}</span>
                    <span style={{ fontSize:'10px', color:'#74897c' }}>{p.user_role}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => { setShowNewDM(false); setSearchResults([]); setNewDMTarget(''); }}
              style={{ background:'none', border:'1px solid #1d2b22', color:'#82998b', cursor:'pointer', padding:'4px 10px', fontSize:'11px', fontFamily:"var(--font-body)", width:'100%' }}>
              CANCEL
            </button>
          </div>
        )}

        <div className="conv-list">
          {convs.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#74897c', fontSize: '11px' }}>
              No conversations yet.<br />Click + NEW to start one.
            </div>
          )}
          {[...convs].sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()).map(conv => (
            <div
              key={conv.id}
              className={`conv-item${activeConv?.id === conv.id ? ' active' : ''}`}
              onClick={() => { setActiveConv(conv); window.history.replaceState({}, '', `${createPageUrl('Messages')}?conv=${conv.id}`); loadHistory(conv.id); }}
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
                <button
                  onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }}
                  disabled={deletingConv === conv.id}
                  style={{ background:'none', border:'none', color:'#74897c', cursor:'pointer', fontSize:'12px', padding:'2px 4px', lineHeight:1 }}
                  title="Delete conversation"
                >
                  {deletingConv === conv.id ? '...' : '🗑'}
                </button>
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
              <div className="dm-header-avatar">{(activeConv.other_username || '?')[0].toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#e8fff1', fontSize: '13px' }}>{activeConv.other_username || 'Unknown'}</div>
                <div style={{ color: '#74897c', fontSize: '10px' }}>Direct Message</div>
              </div>
              {activeConv.other_player_id && (
                <a
                  href={`${createPageUrl('Profile')}?id=${activeConv.other_player_id}`}
                  style={{ fontSize: '11px', color: '#00ff88', border: '1px solid #234530', padding: '4px 10px', textDecoration: 'none', fontFamily: "var(--font-body)" }}
                >
                  VIEW PROFILE
                </a>
              )}
            </div>

            <div className="dm-messages">
              {loadingHistory && messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#74897c', fontSize: '12px', padding: '20px' }}>Loading...</div>
              )}
              {messages.map((msg, i) => {
                const isOwn = msg.sender_id === user?.id;
                return (
                  <div key={msg.id || i} className={`dm-msg${isOwn ? ' own' : ' other'}`}>
                    {!isOwn && (
                      <div style={{ fontSize: '10px', color: '#00ff88', marginBottom: '2px' }}>
                        {msg.sender_username || 'Unknown'}
                      </div>
                    )}
                    <div className="dm-bubble">
                      {msg.is_deleted ? <em style={{ color: '#74897c' }}>[deleted]</em> : (msg.content || '')}
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
              <div style={{ marginTop: '4px', fontSize: '10px', color: '#74897c', textAlign: 'right' }}>
                {input.length}/2000
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}