import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    try {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const base44 = createClientFromRequest(req);

        // 1. Get messages
        const allMessages = await base44.asServiceRole.entities.Message.list('-created_date', 500);
        const active = allMessages.filter(m => !m.is_deleted);
        const paged = active.slice(offset, offset + limit).reverse(); // oldest first

        // 2. Get all players for embedding
        const allPlayers = await base44.asServiceRole.entities.Player.list(null, 1000);
        const playerMap = {};
        allPlayers.forEach(p => { playerMap[p.id] = p; });

        // 3. Get reactions for these messages
        const msgIds = paged.map(m => m.id);
        const allReactions = await base44.asServiceRole.entities.Reaction.list(null, 1000);
        const myReactions = allReactions.filter(r => msgIds.includes(r.message_id));

        // 4. Build enriched messages
        const messages = paged.map(msg => {
            const pl = playerMap[msg.player_id] || {};

            // Group reactions by emoji
            const rxMap = {};
            myReactions.filter(r => r.message_id === msg.id).forEach(r => {
                if (!rxMap[r.emoji]) rxMap[r.emoji] = { emoji: r.emoji, count: 0, user_reacted: false };
                rxMap[r.emoji].count++;
            });

            return {
                ...msg,
                content: msg.message, // alias for frontend
                player: {
                    id: pl.id,
                    chat_username: pl.username,
                    user_role: pl.user_role || 'member',
                },
                reactions: Object.values(rxMap),
                reply_to: msg.reply_to_message_id ? {
                    player: { chat_username: msg.reply_to_username },
                    content: msg.reply_to_message_id
                } : null,
            };
        });

        // 5. Pinned message
        const pinned = allMessages.find(m => m.is_pinned && !m.is_deleted) || null;
        const pinnedMsg = pinned ? {
            ...pinned,
            content: pinned.message,
            player: { chat_username: playerMap[pinned.player_id]?.username }
        } : null;

        // 6. Typing users (active in last 10s)
        const tenSecAgo = new Date(Date.now() - 10000).toISOString();
        const typingUsers = allPlayers
            .filter(p => p.is_typing && p.typing_since && p.typing_since >= tenSecAgo)
            .map(p => p.username);

        // 7. Online count (last 5 min)
        const fiveMinAgo = new Date(Date.now() - 300000).toISOString();
        const onlineCount = allPlayers.filter(p => p.last_seen >= fiveMinAgo).length;

        return Response.json({
            success: true,
            messages,
            online_count: onlineCount,
            pinned_message: pinnedMsg,
            typing_users: typingUsers,
            total: active.length
        }, { headers });

    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
});