import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        let user_id: string | null = null;

        if (req.method === 'POST') {
            const body = await req.json();
            user_id = body.user_id || null;
        } else {
            const url = new URL(req.url);
            user_id = url.searchParams.get('user_id');
        }

        if (!user_id) {
            return Response.json({ error: 'user_id required' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Get player
        const player = await base44.asServiceRole.entities.Player.get(user_id);
        
        if (!player) {
            return Response.json({ error: 'Player not found' }, { status: 404 });
        }

        // Get player's recent scores
        const allScores = await base44.asServiceRole.entities.Score.filter({ player_id: user_id });
        const recentScores = allScores.slice(0, 10);

        // Calculate average score
        const avgScore = allScores.length > 0 
            ? Math.round(allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length)
            : 0;

        // Use Player.high_score (written by gameSubmit)
        const highScore = player.high_score || 0;

        return Response.json({
            success: true,
            stats: {
                username: player.username,
                total_score: player.total_score,
                games_played: player.games_played,
                reputation_points: player.reputation_points,
                user_role: player.user_role,
                average_score: avgScore,
                high_score: highScore,
                best_level: player.best_level || 1,
                recent_scores: recentScores,
                recent_games: recentScores
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});