import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { getSessionPlayer } from '../../shared/session.ts';
import { corsHeaders } from '../../shared/cors.ts';

// Public chat history. Reads stay open (the Message entity is world-readable by design),
// but the caller is identified from the session token when one is sent, the reply never
// spreads whole database records, and only the players/reactions this page needs are read.
const MAX_LIMIT = 100;
const MAX_PLAYERS = 1000;

const PUBLIC_MESSAGE_FIELDS = [
    'id', 'player_id', 'username', 'message', 'is_reply', 'reply_to_message_id',
    'reply_to_username', 'reply_to_message', 'has_image', 'image_url', 'is_deleted',
    'is_pinned', 'reaction_count', 'created_date'
];

function pick(source: any) {
    const out: Record<string, unknown> = {};
    for (const key of PUBLIC_MESSAGE_FIELDS) out[key] = source?.[key] ?? null;
    return out;
}

async function readParams(req: Request) {
    const url = new URL(req.url);
    const fromQuery = {
        limit: url.searchParams.get('limit'),
        offset: url.searchParams.get('offset'),
        session_token: url.searchParams.get('session_token')
    };
    if (req.method !== 'POST') return fromQuery;
    const body = await req.json().catch(() => ({}));
    return {
        limit: body?.limit ?? fromQuery.limit,
        offset: body?.offset ?? fromQuery.offset,
        session_token: body?.session_token ?? fromQuery.session_token
    };
}

Deno.serve(async (req) => {
    const headers = corsHeaders(req, 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    try {
        const params = await readParams(req);
        const limit = Math.min(Math.max(parseInt(params.limit || '100', 10) || 100, 1), MAX_LIMIT);
        const offset = Math.max(parseInt(params.offset || '0', 10) || 0, 0);

        const base44 = createClientFromRequest(req);

        // Optional identity: only used for "did I react" badges, never for authorisation.
        const caller = await getSessionPlayer(base44, params.session_token);
        const callerId = caller?.id || null;

        const recent = await base44.asServiceRole.entities.Message.list('-created_date', 500);
        const active = recent.filter(m => !m.is_deleted);
        const paged = active.slice(offset, offset + limit).reverse(); // oldest first

        const msgIds = new Set(paged.map(m => m.id));
        const playerIds = [...new Set(paged.map(m => m.player_id).filter(Boolean))];

        const [reactions, players, pinnedList] = await Promise.all([
            msgIds.size
                ? base44.asServiceRole.entities.Reaction.filter({ message_id: { $in: [...msgIds] } }, null, 1000)
                : Promise.resolve([]),
            playerIds.length
                ? base44.asServiceRole.entities.Player.filter({ id: { $in: playerIds } }, null, MAX_PLAYERS)
                : Promise.resolve([]),
            base44.asServiceRole.entities.Message.filter({ is_pinned: true, is_deleted: false }, null, 1)
        ]);

        const playerMap: Record<string, any> = {};
        for (const p of players || []) playerMap[p.id] = p;

        const rxByMessage: Record<string, any[]> = {};
        for (const r of reactions || []) (rxByMessage[r.message_id] ||= []).push(r);

        const messages = paged.map(msg => {
            const pl = playerMap[msg.player_id] || { username: msg.username, user_role: 'member' };
            const rxMap: Record<string, any> = {};
            for (const r of rxByMessage[msg.id] || []) {
                if (!rxMap[r.emoji]) rxMap[r.emoji] = { emoji: r.emoji, count: 0, user_reacted: false };
                rxMap[r.emoji].count++;
                if (callerId && r.from_player_id === callerId) rxMap[r.emoji].user_reacted = true;
            }
            return {
                ...pick(msg),
                content: msg.message,
                player: {
                    id: msg.player_id,
                    chat_username: pl.username,
                    user_role: pl.user_role || 'member',
                    username_color: pl.username_color || null,
                    username_color_expires_at: pl.username_color_expires_at || null,
                    profile_frame: pl.profile_frame || null,
                    profile_frame_expires_at: pl.profile_frame_expires_at || null
                    // wallet_address intentionally omitted for privacy
                },
                reactions: Object.values(rxMap),
                reply_to: msg.reply_to_message_id ? {
                    player: { chat_username: msg.reply_to_username },
                    content: msg.reply_to_message || ''
                } : null
            };
        });

        const pinned = (pinnedList || [])[0] || null;
        const pinnedMsg = pinned ? {
            ...pick(pinned),
            content: pinned.message,
            player: { chat_username: playerMap[pinned.player_id]?.username ?? pinned.username }
        } : null;

        // Presence counters: bounded to players seen in the last five minutes.
        const fiveMinAgo = new Date(Date.now() - 300000).toISOString();
        const tenSecAgo = new Date(Date.now() - 10000).toISOString();
        const online = await base44.asServiceRole.entities.Player.filter(
            { last_seen: { $gte: fiveMinAgo } },
            null,
            1000
        );
        const typingUsers = (online || [])
            .filter(p => p.is_typing && p.typing_since && p.typing_since >= tenSecAgo)
            .map(p => p.username);

        return Response.json({
            success: true,
            messages,
            online_count: (online || []).length,
            pinned_message: pinnedMsg,
            typing_users: typingUsers,
            total: active.length
        }, { headers });

    } catch (e) {
        return Response.json({ error: e.message }, { status: 500, headers });
    }
});