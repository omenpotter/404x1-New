import React, { useState, useEffect, useRef } from 'react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

function getUser() {
  try { return JSON.parse(localStorage.getItem('404x1_user') || 'null'); } catch { return null; }
}

const ROLE_COLORS = { member: '#888', trusted: '#5fffff', moderator: '#ffaa00', admin: '#ff4444', superuser: '#aa44ff' };

export default function Chat() {
  const [user, setUser]               = useState(null);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [replyTo, setReplyTo]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const [pinnedMsg, setPinnedMsg]     = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch]   = useState(false);
  const [sending, setSending]         = useState(false);
  const [imageFile, setImageFile]     = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading]     = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  // Human verification
  const [showVerification, setShowVerification] = useState(false);
  const [verifyChallenge, setVerifyChallenge]   = useState(null);
  const [verifyAnswer, setVerifyAnswer]         = useState('');
  const [verifyLoading, setVerifyLoading]       = useState(false);
  const [verifyError, setVerifyError]           = useState('');

  const bottomRef      = useRef(null);
  const inputRef       = useRef(null);
  const typingTimerRef = useRef(null);
  const fileInputRef   = useRef(null);

  useEffect(() => {
    const u = getUser();
    setUser(u);
    const onAuth = () => setUser(getUser());
    window.addEventListener('userAuthChanged', onAuth);
    return () => window.removeEventListener('userAuthChanged', onAuth);
  }, []);

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    fetchMessages();
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.type === 'create') {
        setMessages(prev => prev.find(m => m.id === event.id) ? prev : [...prev, event.data]);
      } else if (event.type === 'update') {
        setMessages(prev => prev.map(m => m.id === event.id ? { ...m, ...event.data } : m));
      } else if (event.type === 'delete') {
        setMessages(prev => prev.filter(m => m.id !== event.id));
      }
    });
    const metaPoll = setInterval(fetchMeta, 5000);
    return () => { unsub(); clearInterval(metaPoll); };
  }, []);

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

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
        await fetchMessages();
      } else if (data.needs_verification) {
        setSending(false);
        await loadVerificationChallenge();
        setShowVerification(true);
        return;
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
    base44.functions.invoke('chatTyping', { user_id: u.id }).catch(() => {});
  };

  const deleteMessage = async (msgId) => {
    const u = getUser();
    if (!u) return;
    try { await base44.functions.invoke('chatDelete', { user_id: u.id, message_id: msgId }); } catch {}
  };

  const loadVerificationChallenge = async () => {
    const u = getUser();
    if (!u) return;
    setVerifyChallenge(null);
    setVerifyAnswer('');
    setVerifyError('');
    try {
      const res = await base44.functions.invoke('verifyHuman', { player_id: u.id, action: 'get_challenge' });
      if (res.data.locked) {
        setVerifyError(res.data.error);
      } else {
        setVerifyChallenge(res.data);
      }
    } catch {
      setVerifyError('Failed to load challenge. Please refresh.');
    }
  };

  const handleVerify = async () => {
    const u = getUser();
    if (!u || !verifyChallenge || !verifyAnswer.trim()) return;
    setVerifyLoading(true);
    setVerifyError('');
    try {
      const res = await base44.functions.invoke('verifyHuman', {
        player_id: u.id,
        action: 'submit_answer',
        challenge_id: verifyChallenge.challenge_id,
        answer: verifyAnswer.trim()
      });
      const data = res.data;
      if (data.success) {
        const updated = { ...u, is_verified: true };
        localStorage.setItem('404x1_user', JSON.stringify(updated));
        setUser(updated);
        setShowVerification(false);
        setVerifyChallenge(null);
        toast.success('✅ Verification complete! You can now chat.');
      } else if (data.locked) {
        setVerifyError(data.error);
        setVerifyChallenge(null);
      } else {
        setVerifyError(data.error || 'Wrong answer. Try again.');
        await loadVerificationChallenge();
      }
    } catch {
      setVerifyError('Verification failed. Please try again.');
    }
    setVerifyLoading(false);
  };

  const searchMessages = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await base44.functions.invoke('chatSearch', { q: searchQuery, limit: 20 });
      if (res.data.success) setSearchResults(res.data.messages || []);
    } catch {}
  };

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

  const canModerate    = user && ['moderator', 'admin', 'superuser'].includes(user.user_role);
  const canUploadImage = user && ['trusted', 'moderator', 'admin', 'superuser'].includes(user.user_role);

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ height: 'calc(100vh - 54px)', display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      <style>{`
        .chat-container { flex:1; display:flex; flex-direction:column; max-width:1400px; width:100%; margin:0 auto; height:100%; }
        .chat-header { padding:12px 20px; border-bottom:1px solid #2a2a2a; display:flex; align-items:center; justify-content:space-between; background:#111; flex-shrink:0; }
        .chat-title { font-family:'Rubik Mono One',monospace; color:#7dff7d; font-size:16px; letter-spacing:2px; }
        .online-dot { width:8px;height:8px;border-radius:50%;background:#7dff7d;display:inline-block;margin-right:6px;box-shadow:0 0 6px #7dff7d; }
        .pinned-bar { background:#1a1a1a;border-bottom:1px solid #ffaa00;padding:8px 20px;font-size:11px;color:#ffaa00;display:flex;gap:8px;flex-shrink:0; }
        .messages-area { flex:1;overflow-y:auto;padding:12px 20px;display:flex;flex-direction:column;gap:2px; }
        .msg-row { display:flex;gap:10px;padding:4px 0;align-items:flex-start; }
        .msg-avatar { width:34px;height:34px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;font-family:'Share Tech Mono',monospace;font-weight:bold;border:1px solid #2a2a2a; }
        .msg-body { flex:1;min-width:0; }
        .msg-header { display:flex;align-items:baseline;gap:6px;margin-bottom:2px;flex-wrap:wrap; }
        .msg-username { font-size:13px;font-weight:bold;font-family:'Share Tech Mono',monospace;cursor:pointer; }
        .msg-time { font-size:10px;color:#444; }
        .msg-role-badge { font-size:9px;padding:1px 5px;border-radius:2px;border:1px solid;font-family:'Share Tech Mono',monospace; }
        .msg-content { font-size:13px;color:#e0e0e0;line-height:1.6;word-break:break-word; }
        .msg-content.deleted { color:#444;font-style:italic; }
        .reply-quote { border-left:2px solid #444;padding:4px 8px;margin-bottom:4px;font-size:11px;color:#888;background:#1a1a1a; }
        .msg-actions { display:none;gap:4px;margin-left:auto;flex-shrink:0; }
        .msg-row:hover .msg-actions { display:flex; }
        .action-btn { padding:2px 8px;border:1px solid #2a2a2a;background:transparent;color:#888;cursor:pointer;font-size:10px;font-family:'Share Tech Mono',monospace;transition:all 0.15s; }
        .action-btn:hover { border-color:#7dff7d;color:#7dff7d; }
        .typing-bar { padding:6px 20px;font-size:11px;color:#888;flex-shrink:0;min-height:24px; }
        .input-area { padding:12px 20px;border-top:1px solid #2a2a2a;background:#111;flex-shrink:0; }
        .reply-preview { background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #5fffff;padding:6px 10px;margin-bottom:8px;font-size:11px;color:#888;display:flex;justify-content:space-between;align-items:center; }
        .input-row { display:flex;gap:8px;align-items:flex-end; }
        .chat-input { flex:1;padding:10px 14px;background:#1a1a1a;border:1px solid #2a2a2a;color:#e0e0e0;font-family:'Share Tech Mono',monospace;font-size:13px;outline:none;resize:none;max-height:100px; }
        .chat-input:focus { border-color:#7dff7d; }
        .send-btn { padding:10px 20px;border:1px solid #7dff7d;background:transparent;color:#7dff7d;cursor:pointer;font-family:'Share Tech Mono',monospace;font-size:12px;white-space:nowrap;transition:all 0.2s; }
        .send-btn:hover:not(:disabled) { background:#7dff7d;color:#0a0a0a; }
        .send-btn:disabled { opacity:0.4;cursor:not-allowed; }
        .header-btns { display:flex;gap:6px;align-items:center; }
        .header-btn { padding:4px 10px;border:1px solid #2a2a2a;background:transparent;color:#888;cursor:pointer;font-size:10px;font-family:'Share Tech Mono',monospace; }
        .header-btn:hover { border-color:#7dff7d;color:#7dff7d; }
        .search-overlay { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding-top:80px; }
        .search-box { background:#111;border:1px solid #2a2a2a;width:100%;max-width:600px;padding:20px; }
        .search-input-row { display:flex;gap:8px;margin-bottom:16px; }
        .search-input { flex:1;padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;color:#e0e0e0;font-family:'Share Tech Mono',monospace;font-size:13px;outline:none; }
        .search-input:focus { border-color:#7dff7d; }
        .search-result { padding:8px 12px;border-bottom:1px solid #1a1a1a;font-size:12px; }
        .muted-bar { background:#1a1a1a;border:1px solid #ff4444;padding:10px 16px;text-align:center;color:#ff4444;font-size:12px; }
        .img-preview-wrap { position:relative;display:inline-block;margin-bottom:8px; }
        .img-preview { max-height:80px;border:1px solid #2a2a2a;border-radius:2px; }
        .img-remove { position:absolute;top:-6px;right:-6px;background:#ff4444;border:none;color:white;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center; }
        .verify-overlay { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.88);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px; }
        .verify-modal { background:#111;border:1px solid #7dff7d;padding:30px;width:100%;max-width:440px;box-shadow:0 0 60px rgba(125,255,125,0.15); }
        .verify-title { font-family:'Rubik Mono One',monospace;color:#7dff7d;font-size:16px;margin-bottom:6px;letter-spacing:2px; }
        .verify-sub { font-size:11px;color:#888;margin-bottom:24px;line-height:1.6; }
        .verify-question { background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #7dff7d;padding:14px 16px;font-size:14px;color:#e0e0e0;margin-bottom:16px;line-height:1.5; }
        .verify-input { width:100%;padding:10px 12px;background:#1a1a1a;border:1px solid #2a2a2a;color:#e0e0e0;font-family:'Share Tech Mono',monospace;font-size:14px;outline:none;margin-bottom:12px;box-sizing:border-box; }
        .verify-input:focus { border-color:#7dff7d; }
        .verify-error { color:#ff4444;font-size:11px;margin-bottom:12px;padding:8px 10px;border:1px solid #ff444433;background:#ff44440a; }
        @media(max-width:600px){ .msg-actions{display:flex;} }
      `}</style>

      {/* Context menu */}
      {contextMenu && (
        <div onClick={e => e.stopPropagation()} style={{ position:'fixed', top:contextMenu.y, left:contextMenu.x, background:'#1a1a1a', border:'1px solid #2a2a2a', zIndex:500, minWidth:'160px', boxShadow:'0 4px 20px rgba(0,0,0,0.8)' }}>
          <div style={{ padding:'8px 12px', fontSize:'11px', color:'#888', borderBottom:'1px solid #2a2a2a', fontFamily:"'Share Tech Mono',monospace" }}>{contextMenu.username}</div>
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

      {/* Human Verification Modal */}
      {showVerification && (
        <div className="verify-overlay">
          <div className="verify-modal">
            <div className="verify-title">🤖 HUMAN VERIFICATION</div>
            <div className="verify-sub">Before you can chat, answer the question below to prove you're human. You have 2 attempts.</div>
            {verifyChallenge ? (
              <>
                <div className="verify-question">{verifyChallenge.question}</div>
                <input
                  className="verify-input"
                  placeholder="Your answer..."
                  value={verifyAnswer}
                  onChange={e => setVerifyAnswer(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  autoFocus
                />
                {verifyError && <div className="verify-error">⚠ {verifyError}</div>}
                <button className="send-btn" style={{ width:'100%' }} onClick={handleVerify} disabled={verifyLoading || !verifyAnswer.trim()}>
                  {verifyLoading ? 'CHECKING...' : 'SUBMIT ANSWER'}
                </button>
              </>
            ) : (
              <div style={{ color: verifyError ? '#ff4444' : '#888', fontSize:'13px', padding:'12px 0' }}>
                {verifyError || 'Loading challenge...'}
              </div>
            )}
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
            const isOwn      = user && (msg.player_id === user.id || msg.player?.id === user.id);
            const playerRole = msg.player?.user_role || 'member';
            const roleColor  = ROLE_COLORS[playerRole] || '#888';
            const username   = msg.player?.chat_username || msg.username || 'Unknown';
            const content    = msg.content || msg.message;
            const isDeleted  = msg.is_deleted;

            return (
              <div key={msg.id} className="msg-row" style={{ position:'relative' }}>
                <div className="msg-avatar" style={{ background: roleColor + '22', color: roleColor, borderColor: roleColor + '44' }}>
                  {username[0]?.toUpperCase()}
                </div>
                <div className="msg-body">
                  <div className="msg-header">
                    <span className="msg-username" style={{ color: roleColor }}
                      onClick={e => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, playerId: msg.player?.id || msg.player_id, username }); }}>
                      {username}
                    </span>
                    <span className="msg-role-badge" style={{ color: roleColor, borderColor: roleColor + '55' }}>
                      {playerRole.toUpperCase()}
                    </span>
                    <span className="msg-time">{formatTime(msg.created_at || msg.created_date)}</span>
                    <div className="msg-actions">
                      {!isDeleted && (
                        <button className="action-btn" onClick={() => setReplyTo({ id: msg.id, username, content })}>↩ REPLY</button>
                      )}
                      {!isDeleted && user && (msg.player?.id || msg.player_id) !== user?.id && (
                        <button className="action-btn"
                          onClick={() => window.location.href = createPageUrl('Messages') + '?with=' + (msg.player?.id || msg.player_id)}>
                          💬 DM
                        </button>
                      )}
                      {!isDeleted && (isOwn || canModerate) && (
                        <button className="action-btn" style={{ color:'#ff4444', borderColor:'#ff444433' }}
                          onClick={() => deleteMessage(msg.id)}>🗑 DEL</button>
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
                    <img src={msg.image_url} alt="" style={{ maxWidth:'320px', maxHeight:'220px', marginTop:'6px', border:'1px solid #2a2a2a', borderRadius:'2px' }} />
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

          {imagePreview && (
            <div className="img-preview-wrap">
              <img src={imagePreview} className="img-preview" alt="preview" />
              <button className="img-remove" onClick={clearImage}>✕</button>
            </div>
          )}

          <div className="input-row">
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFileChange} />

            {canUploadImage && (
              <button className="action-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image"
                style={{ color: imageFile ? '#7dff7d' : '#888', borderColor: imageFile ? '#7dff7d' : '#2a2a2a', padding:'10px' }}>
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