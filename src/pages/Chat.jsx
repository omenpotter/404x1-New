import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPageUrl } from '@/utils';

const BASE = 'https://code-quest-zone.base44.app/api/apps/6988b1920d2dc3e06784fc73/functions/';

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

const ROLE_COLORS = { member: '#888', trusted: '#5fffff', moderator: '#ffaa00', admin: '#ff4444', superuser: '#aa44ff' };
const EMOJIS = ['👍','❤️','😂','🔥','💯','👏','🚀','💎','⚡','🎮'];

export default function Chat() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const [pinnedMsg, setPinnedMsg] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showEmoji, setShowEmoji] = useState(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [notification, setNotification] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [sending, setSending] = useState(false);
  const [tipTarget, setTipTarget] = useState(null);
  const [tipAmount, setTipAmount] = useState(5);
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const fetchMessages = async () => {
    try {
      const u = getUser();
      const uid = u?.id ? '&user_id=' + u.id : '';
      const res = await fetch(BASE + 'chatHistory?limit=100&offset=0' + uid);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
        setOnlineCount(data.online_count || 0);
        setPinnedMsg(data.pinned_message || null);
        setTypingUsers((data.typing_users || []).filter(u2 => {
          const me = getUser();
          return !me || u2 !== (me.chat_username || me.username);
        }));
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = async () => {
    const u = getUser();
    if (!u) { window.location.href = createPageUrl('Home'); return; }
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(BASE + 'chatSend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: u.id,
          message: input.trim(),
          reply_to_message_id: replyTo?.id || null,
          reply_to_username: replyTo?.username || null,
          reply_to_message: replyTo?.content || null,
          image_url: imageUrl || null
        })
      });
      const data = await res.json();
      if (data.success) {
        setInput('');
        setReplyTo(null);
        setImageUrl('');
        setShowImageInput(false);
        if (data.rp_earned) showNotif(`+${data.rp_earned} RP`);
        // Update stored user RP
        const updated = { ...u, reputation_points: data.total_rp || u.reputation_points };
        localStorage.setItem('404x1_user', JSON.stringify(updated));
        setUser(updated);
        await fetchMessages();
      }
    } catch {}
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    sendTypingPing();
  };

  const sendTypingPing = () => {
    const u = getUser();
    if (!u) return;
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {}, 3000);
    fetch(BASE + 'chatTyping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: u.id })
    }).catch(() => {});
  };

  const reactToMessage = async (msgId, emoji) => {
    const u = getUser();
    if (!u) return;
    try {
      const res = await fetch(BASE + 'chatReact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u.id, message_id: msgId, emoji })
      });
      const data = await res.json();
      if (data.rp_earned) showNotif(`+${data.rp_earned} RP`);
      setShowEmoji(null);
      fetchMessages();
    } catch {}
  };

  const deleteMessage = async (msgId) => {
    const u = getUser();
    if (!u) return;
    try {
      await fetch(BASE + 'chatDelete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u.id, message_id: msgId })
      });
      fetchMessages();
    } catch {}
  };

  const pinMessage = async (msgId, action) => {
    const u = getUser();
    if (!u) return;
    try {
      await fetch(BASE + 'chatPin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: u.id, message_id: msgId, action })
      });
      fetchMessages();
    } catch {}
  };

  const sendTip = async () => {
    const u = getUser();
    if (!u || !tipTarget) return;
    try {
      const res = await fetch(BASE + 'chatAwardRp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_user_id: u.id, to_user_id: tipTarget.player_id, amount: tipAmount, reason: 'Tip from chat' })
      });
      const data = await res.json();
      if (data.success) {
        showNotif(`Tipped ${tipAmount} RP to ${tipTarget.username}`);
        setTipTarget(null);
      }
    } catch {}
  };

  const searchMessages = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(BASE + `chatSearch?q=${encodeURIComponent(searchQuery)}&limit=20`);
      const data = await res.json();
      if (data.success) setSearchResults(data.messages || []);
    } catch {}
  };

  const showNotif = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const canModerate = user && ['moderator','admin','superuser'].includes(user.user_role);
  const canUploadImage = user && ['trusted','moderator','admin','superuser'].includes(user.user_role);

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <style>{`
        .chat-container { flex:1; display:flex; flex-direction:column; max-width:900px; width:100%; margin:0 auto; height:100%; }
        .chat-header { padding:12px 16px; border-bottom:1px solid #2a2a2a; display:flex; align-items:center; justify-content:space-between; background:#111; flex-shrink:0; }
        .chat-title { font-family:'Rubik Mono One',monospace; color:#7dff7d; font-size:16px; letter-spacing:2px; }
        .online-dot { width:8px;height:8px;border-radius:50%;background:#7dff7d;display:inline-block;margin-right:6px;box-shadow:0 0 6px #7dff7d; }
        .pinned-bar { background:#1a1a1a;border-bottom:1px solid #ffaa00;padding:8px 16px;font-size:11px;color:#ffaa00;display:flex;gap:8px;flex-shrink:0; }
        .messages-area { flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:2px; }
        .msg-group { margin-bottom:12px; }
        .msg-row { display:flex;gap:10px;padding:3px 0;align-items:flex-start; }
        .msg-avatar { width:32px;height:32px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;font-family:'Share Tech Mono',monospace;font-weight:bold;border:1px solid #2a2a2a; }
        .msg-body { flex:1;min-width:0; }
        .msg-header { display:flex;align-items:baseline;gap:8px;margin-bottom:2px; }
        .msg-username { font-size:12px;font-weight:bold;font-family:'Share Tech Mono',monospace; }
        .msg-time { font-size:10px;color:#444; }
        .msg-role-badge { font-size:9px;padding:1px 5px;border-radius:2px;border:1px solid; }
        .msg-content { font-size:13px;color:#e0e0e0;line-height:1.5;word-break:break-word; }
        .msg-content.deleted { color:#444;font-style:italic; }
        .reply-quote { border-left:2px solid #444;padding:4px 8px;margin-bottom:4px;font-size:11px;color:#888;background:#1a1a1a; }
        .reactions-row { display:flex;flex-wrap:wrap;gap:4px;margin-top:4px; }
        .reaction-chip { padding:2px 8px;border:1px solid #2a2a2a;background:#1a1a1a;border-radius:20px;font-size:12px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:3px; }
        .reaction-chip:hover,.reaction-chip.reacted { border-color:#7dff7d;background:rgba(125,255,125,0.1); }
        .msg-actions { display:none;gap:4px;margin-left:auto; }
        .msg-row:hover .msg-actions { display:flex; }
        .action-btn { padding:2px 6px;border:1px solid #2a2a2a;background:transparent;color:#888;cursor:pointer;font-size:10px;font-family:'Share Tech Mono',monospace; }
        .action-btn:hover { border-color:#7dff7d;color:#7dff7d; }
        .emoji-picker { position:absolute;background:#1a1a1a;border:1px solid #2a2a2a;padding:8px;display:flex;flex-wrap:wrap;gap:4px;z-index:100;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,0.8); }
        .emoji-btn { width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:4px;transition:background 0.2s;font-size:16px; }
        .emoji-btn:hover { background:#2a2a2a; }
        .typing-bar { padding:6px 16px;font-size:11px;color:#888;flex-shrink:0;min-height:24px; }
        .input-area { padding:12px 16px;border-top:1px solid #2a2a2a;background:#111;flex-shrink:0; }
        .reply-preview { background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #5fffff;padding:6px 10px;margin-bottom:8px;font-size:11px;color:#888;display:flex;justify-content:space-between;align-items:center; }
        .input-row { display:flex;gap:8px;align-items:flex-end; }
        .chat-input { flex:1;padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;color:#e0e0e0;font-family:'Share Tech Mono',monospace;font-size:13px;outline:none;resize:none;max-height:100px; }
        .chat-input:focus { border-color:#7dff7d; }
        .send-btn { padding:10px 16px;border:1px solid #7dff7d;background:transparent;color:#7dff7d;cursor:pointer;font-family:'Share Tech Mono',monospace;font-size:12px;white-space:nowrap;transition:all 0.2s; }
        .send-btn:hover:not(:disabled) { background:#7dff7d;color:#0a0a0a; }
        .send-btn:disabled { opacity:0.4;cursor:not-allowed; }
        .notification-toast { position:fixed;bottom:80px;right:20px;background:#7dff7d;color:#0a0a0a;padding:8px 16px;font-family:'Share Tech Mono',monospace;font-size:12px;font-weight:bold;z-index:999;border-radius:2px; }
        .header-btns { display:flex;gap:6px; }
        .header-btn { padding:4px 10px;border:1px solid #2a2a2a;background:transparent;color:#888;cursor:pointer;font-size:10px;font-family:'Share Tech Mono',monospace; }
        .header-btn:hover { border-color:#7dff7d;color:#7dff7d; }
        .search-overlay { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding-top:80px; }
        .search-box { background:#111;border:1px solid #2a2a2a;width:100%;max-width:600px;padding:20px; }
        .search-input-row { display:flex;gap:8px;margin-bottom:16px; }
        .search-input { flex:1;padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;color:#e0e0e0;font-family:'Share Tech Mono',monospace;font-size:13px;outline:none; }
        .search-input:focus { border-color:#7dff7d; }
        .search-result { padding:8px 12px;border-bottom:1px solid #1a1a1a;font-size:12px; }
        .tip-modal { position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#111;border:1px solid #7dff7d;padding:24px;z-index:300;width:300px; }
        .tip-title { font-family:'Rubik Mono One',monospace;color:#7dff7d;font-size:14px;margin-bottom:16px; }
        .tip-btns { display:flex;gap:6px;margin-bottom:16px; }
        .tip-amt { padding:6px 10px;border:1px solid #2a2a2a;background:#1a1a1a;color:#888;cursor:pointer;font-family:'Share Tech Mono',monospace;font-size:12px; }
        .tip-amt.selected { border-color:#7dff7d;color:#7dff7d; }
        .muted-bar { background:#1a1a1a;border:1px solid #ff4444;padding:10px 16px;text-align:center;color:#ff4444;font-size:12px; }
        @media(max-width:600px){.msg-actions{display:flex;}}
      `}</style>

      {notification && <div className="notification-toast">{notification}</div>}

      {contextMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            zIndex: 500,
            minWidth: '160px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
          }}
        >
          <div style={{ padding: '8px 12px', fontSize: '11px', color: '#888',
            borderBottom: '1px solid #2a2a2a', fontFamily: "'Share Tech Mono', monospace" }}>
            {contextMenu.username}
          </div>
          <div
            className='action-btn'
            style={{ display: 'block', padding: '10px 12px', cursor: 'pointer',
              fontFamily: "'Share Tech Mono', monospace", fontSize: '12px',
              color: '#e0e0e0', borderBottom: '1px solid #1a1a1a' }}
            onClick={() => {
              window.location.href = createPageUrl('Profile') + '?id=' + contextMenu.playerId;
              setContextMenu(null);
            }}
          >
            👤 View Profile
          </div>
          {user && contextMenu.playerId !== user?.id && (
            <div
              className='action-btn'
              style={{ display: 'block', padding: '10px 12px', cursor: 'pointer',
                fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', color: '#e0e0e0' }}
              onClick={() => {
                window.location.href = createPageUrl('Messages') + '?with=' + contextMenu.playerId;
                setContextMenu(null);
              }}
            >
              💬 Send DM
            </div>
          )}
        </div>
      )}

      {tipTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 250 }} onClick={() => setTipTarget(null)}>
          <div className="tip-modal" onClick={e => e.stopPropagation()}>
            <div className="tip-title">TIP {tipTarget.username}</div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px' }}>Select RP amount (1-10):</div>
            <div className="tip-btns">
              {[1,2,3,5,10].map(n => (
                <button key={n} className={`tip-amt${tipAmount === n ? ' selected' : ''}`} onClick={() => setTipAmount(n)}>{n}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="send-btn" onClick={sendTip} style={{ flex: 1 }}>SEND TIP</button>
              <button className="action-btn" onClick={() => setTipTarget(null)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="search-overlay" onClick={() => setShowSearch(false)}>
          <div className="search-box" onClick={e => e.stopPropagation()}>
            <div className="search-input-row">
              <input className="search-input" placeholder="Search messages..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchMessages()} autoFocus />
              <button className="send-btn" onClick={searchMessages}>SEARCH</button>
              <button className="action-btn" onClick={() => setShowSearch(false)}>✕</button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {searchResults.map(m => (
                <div key={m.id} className="search-result">
                  <span style={{ color: ROLE_COLORS[m.player?.user_role || 'member'] }}>{m.player?.chat_username || m.username}</span>
                  <span style={{ color: '#444', margin: '0 8px' }}>{formatTime(m.created_at || m.created_date)}</span>
                  <span style={{ color: '#e0e0e0' }}>{m.content || m.message}</span>
                </div>
              ))}
              {searchResults.length === 0 && searchQuery && <div style={{ color: '#444', fontSize: '12px', padding: '12px' }}>No results</div>}
            </div>
          </div>
        </div>
      )}

      <div className="chat-container">
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="chat-title">GLOBAL CHAT</span>
            <span style={{ fontSize: '11px', color: '#888' }}>
              <span className="online-dot" />
              {onlineCount} online
            </span>
          </div>
          <div className="header-btns">
            <button className="header-btn" onClick={() => setShowSearch(true)}>🔍 SEARCH</button>
            {user && <span style={{ fontSize: '11px', color: '#7dff7d' }}>{(user.reputation_points || 0).toLocaleString()} RP</span>}
          </div>
        </div>

        {pinnedMsg && (
          <div className="pinned-bar">
            📌 PINNED: <span style={{ color: '#e0e0e0' }}>{pinnedMsg.content || pinnedMsg.message}</span>
          </div>
        )}

        {user?.is_muted && (
          <div className="muted-bar">🔇 You are muted {user.muted_until ? `until ${new Date(user.muted_until).toLocaleString()}` : ''}</div>
        )}

        <div className="messages-area">
          {loading && <div style={{ textAlign: 'center', color: '#444', fontSize: '12px', paddingTop: '40px' }}>Loading messages...</div>}
          {messages.map((msg, i) => {
            const isOwn = user && (msg.player_id === user.id || msg.player?.id === user.id);
            const playerRole = msg.player?.user_role || 'member';
            const roleColor = ROLE_COLORS[playerRole] || '#888';
            const username = msg.player?.chat_username || msg.username || 'Unknown';
            const content = msg.content || msg.message;
            const isDeleted = msg.is_deleted;

            return (
              <div key={msg.id} className="msg-row" style={{ position: 'relative' }}>
                <div className="msg-avatar" style={{ background: roleColor + '22', color: roleColor, borderColor: roleColor + '44' }}>
                  {username[0]?.toUpperCase()}
                </div>
                <div className="msg-body">
                  <div className="msg-header">
                     <span
                       className="msg-username"
                       style={{ color: roleColor, cursor: 'pointer' }}
                       onClick={e => {
                         e.stopPropagation();
                         setContextMenu({
                           x: e.clientX,
                           y: e.clientY,
                           playerId: msg.player?.id || msg.player_id,
                           username: username
                         });
                       }}
                     >
                       {username}
                     </span>
                    {playerRole !== 'member' && (
                      <span className="msg-role-badge" style={{ color: roleColor, borderColor: roleColor + '66' }}>
                        {playerRole.toUpperCase()}
                      </span>
                    )}
                    <span className="msg-time">{formatTime(msg.created_at || msg.created_date)}</span>
                    <div className="msg-actions">
                      {!isDeleted && <button className="action-btn" onClick={() => setReplyTo({ id: msg.id, username, content })}>↩ REPLY</button>}
                      {!isDeleted && msg.player_id !== user?.id && user && (
                        <button className="action-btn" onClick={() => setTipTarget({ player_id: msg.player?.id || msg.player_id, username })}>💎 TIP</button>
                      )}
                      {!isDeleted && user && msg.player?.id !== user?.id && (
                        <button className="action-btn" onClick={() => window.location.href = createPageUrl('Messages') + '?with=' + (msg.player?.id || msg.player_id)}>💬 DM</button>
                      )}
                      {!isDeleted && <button className="action-btn" onClick={() => setShowEmoji(showEmoji === msg.id ? null : msg.id)}>😀</button>}
                      {!isDeleted && canModerate && !msg.is_pinned && (
                        <button className="action-btn" onClick={() => pinMessage(msg.id, 'pin')}>📌 PIN</button>
                      )}
                      {!isDeleted && canModerate && msg.is_pinned && (
                        <button className="action-btn" onClick={() => pinMessage(msg.id, 'unpin')}>📌 UNPIN</button>
                      )}
                      {!isDeleted && (isOwn || canModerate) && (
                        <button className="action-btn" style={{ color: '#ff4444' }} onClick={() => deleteMessage(msg.id)}>🗑</button>
                      )}
                    </div>
                  </div>

                  {msg.reply_to && (
                    <div className="reply-quote">
                      ↩ {msg.reply_to.player?.chat_username || msg.reply_to_username}: {(msg.reply_to.content || msg.reply_to_message || '').slice(0, 80)}
                    </div>
                  )}

                  <div className={`msg-content${isDeleted ? ' deleted' : ''}`}>
                    {isDeleted ? '[message deleted]' : content}
                  </div>

                  {msg.image_url && !isDeleted && (
                    <img src={msg.image_url} alt="" style={{ maxWidth: '300px', maxHeight: '200px', marginTop: '6px', border: '1px solid #2a2a2a' }} />
                  )}

                  {msg.reactions?.length > 0 && (
                    <div className="reactions-row">
                      {msg.reactions.map((r, ri) => (
                        <div key={ri} className={`reaction-chip${r.user_reacted ? ' reacted' : ''}`}
                          onClick={() => !isDeleted && reactToMessage(msg.id, r.emoji)}>
                          {r.emoji} {r.count}
                        </div>
                      ))}
                    </div>
                  )}

                  {showEmoji === msg.id && (
                    <div className="emoji-picker" style={{ position: 'relative' }}>
                      {EMOJIS.map(e => (
                        <div key={e} className="emoji-btn" onClick={() => reactToMessage(msg.id, e)}>{e}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {typingUsers.length > 0 && (
          <div className="typing-bar">
            <span style={{ color: '#5fffff' }}>{typingUsers.join(', ')}</span> {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        <div className="input-area">
          {replyTo && (
            <div className="reply-preview">
              <span>↩ Replying to <strong style={{ color: '#5fffff' }}>{replyTo.username}</strong>: {replyTo.content?.slice(0, 60)}</span>
              <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>✕</button>
            </div>
          )}
          {showImageInput && (
            <input
              className="chat-input"
              style={{ marginBottom: '6px', display: 'block' }}
              placeholder="Paste image URL..."
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
            />
          )}
          <div className="input-row">
            {canUploadImage && (
              <button className="action-btn" onClick={() => setShowImageInput(!showImageInput)} title="Attach image URL" style={{ color: showImageInput ? '#7dff7d' : '#888', borderColor: showImageInput ? '#7dff7d' : '#2a2a2a', padding: '10px 10px' }}>🖼</button>
            )}
            <textarea
              ref={inputRef}
              className="chat-input"
              rows={1}
              placeholder={user ? (user.is_muted ? 'You are muted...' : 'Type a message... (Enter to send)') : 'Login to chat...'}
              value={input}
              onChange={e => { if (e.target.value.length <= 5000) setInput(e.target.value); }}
              onKeyDown={handleKeyDown}
              disabled={!user || user.is_muted}
              maxLength={5000}
            />
            <button className="send-btn" onClick={sendMessage} disabled={!input.trim() || sending || !user || user.is_muted}>
              {sending ? '...' : 'SEND'}
            </button>
          </div>
          {input.length > 0 && (
            <div style={{ textAlign: 'right', fontSize: '10px', color: input.length > 4800 ? '#ff4444' : '#444', marginTop: '4px' }}>
              {input.length}/5000
            </div>
          )}
          {!user && (
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
              <a href={createPageUrl('Home')} style={{ color: '#7dff7d' }}>Connect wallet</a> to participate
            </div>
          )}
        </div>
      </div>
    </div>
  );
}