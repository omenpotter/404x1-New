import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const { user_id, score, level_reached, deaths, time_seconds } = await req.json();

        if (!user_id || score === undefined) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (score < 0) {
            return Response.json({ error: 'Invalid score' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Get player
        const player = await base44.asServiceRole.entities.Player.get(user_id);
        
        if (!player) {
            return Response.json({ error: 'Player not found' }, { status: 404 });
        }

        // Create score record with all fields
        const scoreRecord = await base44.asServiceRole.entities.Score.create({
            player_id: user_id,
            username: player.username,
            score: score,
            level_reached: level_reached || 1,
            deaths: deaths || 0,
            time_seconds: time_seconds || 0
        });

        // Calculate RP reward (1 RP per 100 points)
        const rpReward = Math.floor(score / 100);

        // Update high_score if beaten
        const newHighScore = score > (player.high_score || 0) ? score : (player.high_score || 0);

        // Update player stats
        await base44.asServiceRole.entities.Player.update(user_id, {
            total_score: (player.total_score || 0) + score,
            games_played: (player.games_played || 0) + 1,
            reputation_points: (player.reputation_points || 0) + rpReward,
            high_score: newHighScore,
            last_seen: new Date().toISOString()
        });

        // Calculate rank
        const allScores = await base44.asServiceRole.entities.Score.list('-score', 1000);
        const rank = allScores.findIndex(s => s.id === scoreRecord.id) + 1;

        return Response.json({
            success: true,
            score: scoreRecord,
            rp_earned: rpReward,
            rank: rank,
            total_rp: (player.reputation_points || 0) + rpReward
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});