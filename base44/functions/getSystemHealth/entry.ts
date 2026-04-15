import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    const start = Date.now();

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const base44 = createClientFromRequest(req);

        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Fetch key metrics in parallel
        const [players, recentMessages, allMessages, reactions, modLogs] = await Promise.all([
            base44.asServiceRole.entities.Player.list('-created_date', 500),
            base44.asServiceRole.entities.Message.list('-created_date', 50),
            base44.asServiceRole.entities.Message.list('-created_date', 200),
            base44.asServiceRole.entities.Reaction.list('-created_date', 100),
            base44.asServiceRole.entities.ModerationLog.list('-created_date', 50),
        ]);

        const totalPlayers = players.length;
        const activeLast5Min = players.filter(p => p.last_seen && p.last_seen > fiveMinAgo).length;
        const activeLast24h = players.filter(p => p.last_seen && p.last_seen > oneDayAgo).length;
        const bannedPlayers = players.filter(p => p.is_banned).length;
        const mutedPlayers = players.filter(p => p.is_muted && new Date(p.muted_until) > new Date()).length;

        const totalMessages = allMessages.filter(m => !m.is_deleted).length;
        const messagesLast5Min = recentMessages.filter(m => !m.is_deleted && m.created_date > fiveMinAgo).length;
        const messagesLast24h = allMessages.filter(m => !m.is_deleted && m.created_date > oneDayAgo).length;

        const totalReactions = reactions.length;
        const modActionsLast24h = modLogs.filter(l => l.created_date > oneDayAgo).length;

        const responseTime = Date.now() - start;

        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            response_time_ms: responseTime,
            players: {
                total: totalPlayers,
                active_5min: activeLast5Min,
                active_24h: activeLast24h,
                banned: bannedPlayers,
                muted: mutedPlayers,
            },
            messages: {
                total: totalMessages,
                last_5min: messagesLast5Min,
                last_24h: messagesLast24h,
            },
            reactions: {
                total: totalReactions,
            },
            moderation: {
                actions_24h: modActionsLast24h,
            },
        };

        return Response.json(health, { status: 200, headers: corsHeaders });

    } catch (error) {
        const responseTime = Date.now() - start;
        return Response.json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            response_time_ms: responseTime,
            error: error.message,
        }, { status: 500, headers: corsHeaders });
    }
});