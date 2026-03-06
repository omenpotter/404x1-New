import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const sortBy = url.searchParams.get('sortBy') || 'total_score';

        const base44 = createClientFromRequest(req);

        // Get all players sorted by requested field
        const sortField = sortBy === 'reputation_points' ? '-reputation_points' : '-total_score';
        const players = await base44.asServiceRole.entities.Player.list(sortField, limit);

        const leaderboard = players.map((player, index) => ({
            rank: index + 1,
            username: player.username,
            reputation_points: player.reputation_points,
            total_score: player.total_score,
            games_played: player.games_played,
            messages_sent: player.messages_sent || 0,
            user_role: player.user_role
        }));

        return Response.json({
            success: true,
            leaderboard: leaderboard
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});