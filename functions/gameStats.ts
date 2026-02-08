import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const user_id = url.searchParams.get('user_id');

        if (!user_id) {
            return Response.json({ error: 'user_id required' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Get user
        const user = await base44.asServiceRole.entities.User.get(user_id);
        
        if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        // Get user's recent scores
        const allScores = await base44.asServiceRole.entities.Score.filter({ user_id: user_id });
        const recentScores = allScores.slice(0, 10);

        // Calculate average score
        const avgScore = allScores.length > 0 
            ? Math.round(allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length)
            : 0;

        // Find highest score
        const highScore = allScores.length > 0
            ? Math.max(...allScores.map(s => s.score))
            : 0;

        return Response.json({
            success: true,
            stats: {
                username: user.username,
                total_score: user.total_score,
                games_played: user.games_played,
                reputation_points: user.reputation_points,
                role: user.role,
                average_score: avgScore,
                high_score: highScore,
                recent_scores: recentScores
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});