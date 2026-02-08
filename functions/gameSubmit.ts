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

        // Get user
        const user = await base44.asServiceRole.entities.User.get(user_id);
        
        if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        // Create score record
        const scoreRecord = await base44.asServiceRole.entities.Score.create({
            user_id: user_id,
            username: user.username,
            score: score
        });

        // Calculate RP reward (1 RP per 100 points)
        const rpReward = Math.floor(score / 100);

        // Update user stats
        await base44.asServiceRole.entities.User.update(user_id, {
            total_score: user.total_score + score,
            games_played: user.games_played + 1,
            reputation_points: user.reputation_points + rpReward,
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