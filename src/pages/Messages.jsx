import React, { useState, useEffect, useRef } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
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
      const res = await base44.functions.invoke('getConversations', { player_id: user.id });
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
        from_player_id: user.id,
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
        player_id: user.id,
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
    const existing = convs.find(c => c.id === convId);
    if (existing) setActiveConv(existing);
    await loadHistory(convId);
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
        sender_id: user.id,
        sender_username: user.username,
      });
      if (res.data.success) {
        setMessages(prev => [...prev, res.data.message]);
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      console.error('DM error: sendMessage', err);
    }
    setSending(false);
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
    if (othersRead) return <span style={{ color: '#7dff7d', fontSize: '11px' }}>✓✓</span>;
    if (othersDelivered) return <span style={{ color: '#888', fontSize: '11px' }}>✓✓</span>;
    return <span style={{ color: '#444', fontSize: '11px' }}>✓</span>;
  };

  // Debounced player search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (newDMTarget.length < 2) { setSearchResults([]); return; }
      setSearching(true);
      try {
        const res = await base44.functions.invoke('playerSearch', { query: newDMTarget, limit: 8 });
        if (res.data.success) setSearchResults(res.data.players || []);
      } catch (err) {
        console.error('DM error: playerSearch', err);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [newDMTarget]);

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
              onChange={e => setNewDMTarget(e.target.value)}
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
                    onClick={() => startNewDM(p.id)}
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
          {[...convs].sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)).map(conv => (
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