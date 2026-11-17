// TEST-ONLY synthetic Base44 backend responses, used to lay out authenticated views (Chat, DMs, Profile, Leaderboard, Game,
// ModPanel, Logs) in screenshots/responsive tests. Never shipped. All names/numbers are fabricated for layout only —
// they are NOT production data and NOT evidence that the real Base44 backend works.
const now = Date.now();
const iso = (m) => new Date(now - m * 60000).toISOString();
const user = { id: 'u_me', username: 'ghost_404', chat_username: 'ghost_404', user_role: 'moderator', reputation_points: 12840, wallet_address: 'FAKEWALLET', session_token: 'x'.repeat(16), messages_sent: 412 };
const players = [['n0va_x1', 'superuser', 98211, 1420], ['cipher', 'admin', 80412, 1210], ['ghost_404', 'moderator', 12840, 412], ['lowkey', 'trusted', 9120, 388], ['rabbit_hole', 'member', 5230, 190], ['null_ptr', 'member', 4101, 144], ['segfault', 'member', 2210, 90]];
const msgs = [
  ['n0va_x1', 'superuser', 'welcome to the underground. nothing found here, everything to build.', 58],
  ['cipher', 'admin', 'reminder: no financial advice, no guarantees. verify addresses before you trade.', 41],
  ['lowkey', 'trusted', 'pool looks healthy, spot ~0.00455 XNT', 22],
  ['rabbit_hole', 'member', 'gm 404ers 🟢', 9],
  ['ghost_404', 'moderator', 'a much longer message to test wrapping across narrow phone screens: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 3],
].map(([u, r, t, m], i) => ({ id: 'm' + i, player_id: 'p_' + u, username: u, message: t, content: t, created_date: iso(m), created_at: iso(m), is_deleted: false, reactions: i === 0 ? [{ emoji: '🔥', count: 3, user_reacted: false }, { emoji: '🟢', count: 5, user_reacted: true }] : [], player: { id: 'p_' + u, chat_username: u, username: u, user_role: r } }));
function respond(name, body) {
  switch (name) {
    case 'chatHistory': return { success: true, messages: msgs, online_count: 17, pinned_message: { ...msgs[1], content: msgs[1].message }, typing_users: ['cipher'] };
    case 'gameLeaderboard': return { success: true, leaderboard: players.map(([username, user_role, reputation_points, messages_sent], i) => ({ rank: i + 1, username, user_role, reputation_points, messages_sent })) };
    case 'gameStats': return { success: true, stats: { ...user, high_score: 4820, level: 6, games_played: 31, lives: 3 } };
    case 'getPlayerActivity': return { success: true, player: { id: 'u_me', bio: 'layout fixture bio' }, rp_received: [{ amount: 50, reason: 'Tip from chat', created_date: iso(80) }], rp_sent: [{ amount: 10, reason: 'Tip from chat', created_date: iso(200) }], recent_messages: msgs.slice(0, 3) };
    case 'getConversations': return { success: true, conversations: [{ id: 'c1', other_username: 'n0va_x1', last_message: 'see you in the underground', last_message_at: iso(12), unread_count: 2 }, { id: 'c2', other_username: 'cipher', last_message: 'verified.', last_message_at: iso(300), unread_count: 0 }] };
    case 'getPrivateHistory': return { success: true, messages: [{ id: 'd1', sender_id: 'x', sender_username: 'n0va_x1', content: 'hey — layout test message', created_at: iso(30) }, { id: 'd2', sender_id: 'u_me', sender_username: 'ghost_404', content: 'reply with a very long unbroken string ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ', created_at: iso(28), read_by: ['x'] }] };
    case 'playerSearch': return { success: true, players: players.slice(0, 4).map(([username, user_role], i) => ({ id: 'p' + i, username, chat_username: username, user_role })) };
    case 'getModLogs': return { success: true, logs: [{ id: 'l1', action: 'warn', target_username: 'segfault', moderator_username: 'ghost_404', reason: 'layout fixture', created_date: iso(90) }] };
    default: return { success: true };
  }
}
async function install(page, { loggedIn = true } = {}) {
  if (loggedIn) await page.addInitScript(u => localStorage.setItem('404x1_user', JSON.stringify(u)), user);
  await page.route(/\/functions\/([A-Za-z]+)/, async route => {
    const name = route.request().url().match(/\/functions\/([A-Za-z]+)/)[1];
    let body = {}; try { body = JSON.parse(route.request().postData() || '{}'); } catch { /* GET */ }
    if (/^(chatSend|chatDelete|chatPin|chatReact|sendPrivateMessage|updateProfile|spendRp|convertRp|gameStart|gameSubmit|moderateUser|issueWarning|changeRole|awardRp|createConversation|deleteConversation)$/.test(name)) { route.fulfill({ status: 403, contentType: 'application/json', body: '{"success":false,"error":"blocked in test"}' }); return; }
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(respond(name, body)) });
  });
}
module.exports = { install, user };
