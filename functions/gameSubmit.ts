import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const { user_id, score } = await req.json();

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

        // Create score record
        const scoreRecord = await base44.asServiceRole.entities.Score.create({
            player_id: user_id,
            username: player.username,
            score: score
        });

        // Calculate RP reward (1 RP per 100 points)
        const rpReward = Math.floor(score / 100);

        // Update player stats
        await base44.asServiceRole.entities.Player.update(user_id, {
            total_score: player.total_score + score,
            games_played: player.games_played + 1,
            reputation_points: player.reputation_points + rpReward,
            last_seen: new Date().toISOString()
        });

        return Response.json({
            success: true,
            score: scoreRecord,
            rp_earned: rpReward
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});