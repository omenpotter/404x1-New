import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getSessionPlayer } from '../../shared/session.ts';

Deno.serve(async (req) => {
    try {
        let user_id: string | null = null;
        let session_token: string | null = null;

        if (req.method === 'POST') {
            const body = await req.json();
            user_id = body.user_id || null;
            session_token = body.session_token || null;
        } else {
            const url = new URL(req.url);
            user_id = url.searchParams.get('user_id');
            session_token = req.headers.get('Authorization')?.replace('Bearer ', '');
        }

        const base44 = createClientFromRequest(req);

        const caller = await getSessionPlayer(base44, session_token);
        if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Default to the caller's own ID if not specified
        if (!user_id) user_id = caller.id;

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