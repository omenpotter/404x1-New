import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const sortBy = url.searchParams.get('sortBy') || 'total_score';

        const base44 = createClientFromRequest(req);

        // Get all users sorted by requested field
        const sortField = sortBy === 'reputation_points' ? '-reputation_points' : '-total_score';
        const users = await base44.asServiceRole.entities.User.list(sortField, limit);

        const leaderboard = users.map((user, index) => ({
            rank: index + 1,
            username: user.username,
            reputation_points: user.reputation_points,
            total_score: user.total_score,
            games_played: user.games_played,
            user_role: user.user_role
        }));

        return Response.json({
            success: true,
            leaderboard: leaderboard
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});