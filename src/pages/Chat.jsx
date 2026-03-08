import React, { useState, useEffect, useRef } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

const ROLE_COLORS = { member: '#888', trusted: '#5fffff', moderator: '#ffaa00', admin: '#ff4444', superuser: '#aa44ff' };
const EMOJIS = ['👍','❤️','😂','🔥','💯','👏','🚀','💎','⚡','🎮'];

export default function Chat() {
  const [user, setUser]               = useState(null);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [replyTo, setReplyTo]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const [pinnedMsg, setPinnedMsg]     = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showEmoji, setShowEmoji]     = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch]   = useState(false);
  const [sending, setSending]         = useState(false);
  const [tipTarget, setTipTarget]     = useState(null);
  const [tipAmount, setTipAmount]     = useState(5);
  const [imageFile, setImageFile]     = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading]     = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const typingTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const u = getUser();
    setUser(u);
    const onAuth = () => setUser(getUser());
    window.addEventListener('userAuthChanged', onAuth);
    return () => window.removeEventListener('userAuthChanged', onAuth);
  }, []);

  // ── Close context menu on click ───────────────────────────────────────────
  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // ── Initial fetch + real-time subscription ────────────────────────────────
  useEffect(() => {
    fetchMessages();
    // Real-time subscription via base44 SDK
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.type === 'create') {
        setMessages(prev => {
          if (prev.find(m => m.id === event.id)) return prev;
          return [...prev, event.data];
        });
      } else if (event.type === 'update') {
        setMessages(prev => prev.map(m => m.id === event.id ? { ...m, ...event.data } : m));
      } else if (event.type === 'delete') {
        setMessages(prev => prev.filter(m => m.id !== event.id));
      }
    });
    // Poll online count + typing + pinned every 5s (lightweight)
    const metaPoll = setInterval(fetchMeta, 5000);
    return () => { unsub(); clearInterval(metaPoll); };
  }, []);

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Fetch full message history ────────────────────────────────────────────
  const fetchMessages = async () => {
    try {
      const u = getUser();
      const res = await base44.functions.invoke('chatHistory', { limit: 100, offset: 0, user_id: u?.id });
      const data = res.data;
      if (data.success) {
        setMessages(data.messages || []);
        setOnlineCount(data.online_count || 0);
        setPinnedMsg(data.pinned_message || null);
        setTypingUsers((data.typing_users || []).filter(n => n !== (u?.username || u?.chat_username)));
      }
    } catch {}
    setLoading(false);
  };

  // ── Poll only meta (online, typing, pinned) ───────────────────────────────
  const fetchMeta = async () => {
    try {
      const u = getUser();
      const res = await base44.functions.invoke('chatHistory', { limit: 1, offset: 0, user_id: u?.id });
      const data = res.data;
      if (data.success) {
        setOnlineCount(data.online_count || 0);
        setPinnedMsg(data.pinned_message || null);
        setTypingUsers((data.typing_users || []).filter(n => n !== (u?.username || u?.chat_username)));
      }
    } catch {}
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const u = getUser();
    if (!u) { window.location.href = createPageUrl('Home'); return; }
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      let finalImageUrl = '';
      if (imageFile) {
        setUploading(true);
        const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
        finalImageUrl = file_url;
        setUploading(false);
      }
      const res = await base44.functions.invoke('chatSend', {
        user_id: u.id,
        message: input.trim(),
        reply_to_message_id: replyTo?.id || null,
        reply_to_username:   replyTo?.username || null,
        reply_to_message:    replyTo?.content || null,
        image_url:           finalImageUrl || null,
      });
      const data = res.data;
      if (data.success) {
        setInput('');
        setReplyTo(null);
        setImageFile(null);
        setImagePreview('');
        if (data.rp_earned) toast.success(`+${data.rp_earned} RP earned!`);
        const updated = { ...u, reputation_points: data.total_rp || u.reputation_points };
        localStorage.setItem('404x1_user', JSON.stringify(updated));
        setUser(updated);
        // fetchMessages for reply hydration; real-time sub handles the new msg itself
        await fetchMessages();
      } else {
        toast.error(data.error || 'Failed to send');
      }
    } catch (e) {
      toast.error(e.message || 'Failed to send');
      setUploading(false);
    }
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
    base44.functions.invoke('chatTyping', { user_id: u.id }).catch(() => {});
  };

  // ── React ─────────────────────────────────────────────────────────────────
  const reactToMessage = async (msgId, emoji) => {
    const u = getUser();
    if (!u) return;
    try {
      const res = await base44.functions.invoke('chatReact', { user_id: u.id, message_id: msgId, emoji });
      if (res.data.rp_earned) toast.success(`+${res.data.rp_earned} RP`);
      setShowEmoji(null);
      fetchMessages();
    } catch {}
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteMessage = async (msgId) => {
    const u = getUser();
    if (!u) return;
    try {
      await base44.functions.invoke('chatDelete', { user_id: u.id, message_id: msgId });
    } catch {}
  };

  // ── Pin ───────────────────────────────────────────────────────────────────
  const pinMessage = async (msgId, action) => {
    const u = getUser();
    if (!u) return;
    try {
      await base44.functions.invoke('chatPin', { user_id: u.id, message_id: msgId, action });
      fetchMessages();
    } catch {}
  };

  // ── Tip ───────────────────────────────────────────────────────────────────
  const sendTip = async () => {
    const u = getUser();
    if (!u || !tipTarget) return;
    try {
      const res = await base44.functions.invoke('chatAwardRp', {
        from_user_id: u.id, to_user_id: tipTarget.player_id, amount: tipAmount, reason: 'Tip from chat'
      });
      if (res.data.success) {
        toast.success(`Tipped ${tipAmount} RP to ${tipTarget.username}`);
        setTipTarget(null);
      }
    } catch {}
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const searchMessages = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await base44.functions.invoke('chatSearch', { q: searchQuery, limit: 20 });
      if (res.data.success) setSearchResults(res.data.messages || []);
    } catch {}
  };

  // ── Image file pick ───────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canModerate    = user && ['moderator','admin','superuser'].includes(user.user_role);
  const canUploadImage = user && ['trusted','moderator','admin','superuser'].includes(user.user_role);

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        .emoji-picker { position:relative;background:#1a1a1a;border:1px solid #2a2a2a;padding:8px;display:flex;flex-wrap:wrap;gap:4px;z-index:100;border-radius:4px;box-shadow:0 4px 20px rgba(0,0,0,0.8);margin-top:4px; }
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
        .img-preview-wrap { position:relative;display:inline-block;margin-bottom:8px; }
        .img-preview { max-height:80px;border:1px solid #2a2a2a;border-radius:2px; }
        .img-remove { position:absolute;top:-6px;right:-6px;background:#ff4444;border:none;color:white;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center; }
        @media(max-width:600px){.msg-actions{display:flex;}}
      `}</style>

      {/* Context menu */}
      {contextMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position:'fixed', top:contextMenu.y, left:contextMenu.x, background:'#1a1a1a', border:'1px solid #2a2a2a', zIndex:500, minWidth:'160px', boxShadow:'0 4px 20px rgba(0,0,0,0.8)' }}
        >
          <div style={{ padding:'8px 12px', fontSize:'11px', color:'#888', borderBottom:'1px solid #2a2a2a', fontFamily:"'Share Tech Mono',monospace" }}>
            {contextMenu.username}
          </div>
          <div className="action-btn" style={{ display:'block', padding:'10px 12px', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'12px', color:'#e0e0e0', borderBottom:'1px solid #1a1a1a' }}
            onClick={() => { window.location.href = createPageUrl('Profile') + '?id=' + contextMenu.playerId; setContextMenu(null); }}>
            👤 View Profile
          </div>
          {user && contextMenu.playerId !== user?.id && (
            <div className="action-btn" style={{ display:'block', padding:'10px 12px', cursor:'pointer', fontFamily:"'Share Tech Mono',monospace", fontSize:'12px', color:'#e0e0e0' }}
              onClick={() => { window.location.href = createPageUrl('Messages') + '?with=' + contextMenu.playerId; setContextMenu(null); }}>
              💬 Send DM
            </div>
          )}
        </div>
      )}

      {/* Tip modal */}
      {tipTarget && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', zIndex:250 }} onClick={() => setTipTarget(null)}>
          <div className="tip-modal" onClick={e => e.stopPropagation()}>
            <div className="tip-title">TIP {tipTarget.username}</div>
            <div style={{ fontSize:'11px', color:'#888', marginBottom:'12px' }}>Select RP amount:</div>
            <div className="tip-btns">
              {[1,2,3,5,10].map(n => (
                <button key={n} className={`tip-amt${tipAmount === n ? ' selected' : ''}`} onClick={() => setTipAmount(n)}>{n}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button className="send-btn" onClick={sendTip} style={{ flex:1 }}>SEND TIP</button>
              <button className="action-btn" onClick={() => setTipTarget(null)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Search overlay */}
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
            <div style={{ maxHeight:'400px', overflowY:'auto' }}>
              {searchResults.map(m => (
                <div key={m.id} className="search-result">
                  <span style={{ color: ROLE_COLORS[m.player?.user_role || 'member'] }}>{m.player?.chat_username || m.username}</span>
                  <span style={{ color:'#444', margin:'0 8px' }}>{formatTime(m.created_at || m.created_date)}</span>
                  <span style={{ color:'#e0e0e0' }}>{m.content || m.message}</span>
                </div>
              ))}
              {searchResults.length === 0 && searchQuery && <div style={{ color:'#444', fontSize:'12px', padding:'12px' }}>No results</div>}
            </div>
          </div>
        </div>
      )}

      <div className="chat-container">
        {/* Header */}
        <div className="chat-header">
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <span className="chat-title">GLOBAL CHAT</span>
            <span style={{ fontSize:'11px', color:'#888' }}>
              <span className="online-dot" />{onlineCount} online
            </span>
          </div>
          <div className="header-btns">
            <button className="header-btn" onClick={() => setShowSearch(true)}>🔍 SEARCH</button>
            {user && <span style={{ fontSize:'11px', color:'#7dff7d' }}>{(user.reputation_points || 0).toLocaleString()} RP</span>}
          </div>
        </div>

        {/* Pinned */}
        {pinnedMsg && (
          <div className="pinned-bar">
            📌 PINNED: <span style={{ color:'#e0e0e0' }}>{pinnedMsg.content || pinnedMsg.message}</span>
          </div>
        )}

        {/* Muted banner */}
        {user?.is_muted && (
          <div className="muted-bar">🔇 You are muted {user.muted_until ? `until ${new Date(user.muted_until).toLocaleString()}` : ''}</div>
        )}

        {/* Messages */}
        <div className="messages-area">
          {loading && <div style={{ textAlign:'center', color:'#444', fontSize:'12px', paddingTop:'40px' }}>Loading messages...</div>}
          {messages.map((msg) => {
            const isOwn       = user && (msg.player_id === user.id || msg.player?.id === user.id);
            const playerRole  = msg.player?.user_role || 'member';
            const roleColor   = ROLE_COLORS[playerRole] || '#888';
            const username    = msg.player?.chat_username || msg.username || 'Unknown';
            const content     = msg.content || msg.message;
            const isDeleted   = msg.is_deleted;

            return (
              <div key={msg.id} className="msg-row" style={{ position:'relative' }}>
                <div className="msg-avatar" style={{ background: roleColor + '22', color: roleColor, borderColor: roleColor + '44' }}>
                  {username[0]?.toUpperCase()}
                </div>
                <div className="msg-body">
                  <div className="msg-header">
                    <span className="msg-username" style={{ color: roleColor, cursor:'pointer' }}
                      onClick={e => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, playerId: msg.player?.id || msg.player_id, username }); }}>
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
                        <button className="action-btn" style={{ color:'#ff4444' }} onClick={() => deleteMessage(msg.id)}>🗑</button>
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
                    <img src={msg.image_url} alt="" style={{ maxWidth:'300px', maxHeight:'200px', marginTop:'6px', border:'1px solid #2a2a2a' }} />
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
                    <div className="emoji-picker">
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

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="typing-bar">
            <span style={{ color:'#5fffff' }}>{typingUsers.join(', ')}</span> {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        {/* Input area */}
        <div className="input-area">
          {replyTo && (
            <div className="reply-preview">
              <span>↩ Replying to <strong style={{ color:'#5fffff' }}>{replyTo.username}</strong>: {replyTo.content?.slice(0, 60)}</span>
              <button onClick={() => setReplyTo(null)} style={{ background:'none', border:'none', color:'#888', cursor:'pointer' }}>✕</button>
            </div>
          )}

          {/* Image preview */}
          {imagePreview && (
            <div className="img-preview-wrap">
              <img src={imagePreview} className="img-preview" alt="preview" />
              <button className="img-remove" onClick={clearImage}>✕</button>
            </div>
          )}

          <div className="input-row">
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFileChange} />

            {canUploadImage && (
              <button className="action-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image"
                style={{ color: imageFile ? '#7dff7d' : '#888', borderColor: imageFile ? '#7dff7d' : '#2a2a2a', padding:'10px 10px' }}>
                🖼
              </button>
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
            />
            <button className="send-btn" onClick={sendMessage} disabled={!input.trim() || sending || uploading || !user || user.is_muted}>
              {uploading ? '⬆' : sending ? '...' : 'SEND'}
            </button>
          </div>

          {input.length > 0 && (
            <div style={{ textAlign:'right', fontSize:'10px', color: input.length > 4800 ? '#ff4444' : '#444', marginTop:'4px' }}>
              {input.length}/5000
            </div>
          )}

          {!user && (
            <div style={{ marginTop:'8px', fontSize:'11px', color:'#666', textAlign:'center' }}>
              <a href={createPageUrl('Home')} style={{ color:'#7dff7d' }}>Connect wallet</a> to participate
            </div>
          )}
        </div>
      </div>
    </div>
  );
}