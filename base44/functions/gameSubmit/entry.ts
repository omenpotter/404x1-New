import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const MAX_SCORE = 50000;           // hard cap — reject impossibly high scores
const DAILY_GAME_RP_CAP = 500;     // max RP from games per day
const MAX_SCORE_PER_SECOND = 50;   // plausibility: score/time sanity check

Deno.serve(async (req) => {
    try {
        const { score, level_reached, deaths, time_seconds } = await req.json();

        if (score === undefined) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (score < 0) {
            return Response.json({ error: 'Invalid score' }, { status: 400 });
        }

        // Hard cap — reject spoofed scores
        if (score > MAX_SCORE) {
            return Response.json({ error: `Score exceeds maximum allowed (${MAX_SCORE})` }, { status: 400 });
        }

        // Plausibility check: score per second must be achievable
        if (time_seconds && time_seconds > 0 && score > 0) {
            const scorePerSecond = score / time_seconds;
            if (scorePerSecond > MAX_SCORE_PER_SECOND) {
                return Response.json({ error: 'Score/time ratio is not plausible' }, { status: 400 });
            }
        }

        const base44 = createClientFromRequest(req);
        const authUser = await base44.auth.me();
        if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const user_id = authUser.id;

        const player = await base44.asServiceRole.entities.Player.get(user_id);
        if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

        const scoreRecord = await base44.asServiceRole.entities.Score.create({
            player_id: user_id,
            username: player.username,
            score,
            level_reached: level_reached || 1,
            deaths: deaths || 0,
            time_seconds: time_seconds || 0
        });

        // Daily game RP cap
        const today = new Date().toISOString().slice(0, 10);
        const sameDay = player.daily_rp_date === today;
        const dailyGameRp = sameDay ? (player.daily_rp_games || 0) : 0;

        let rpReward = Math.floor(score / 100);
        rpReward = Math.min(rpReward, DAILY_GAME_RP_CAP - dailyGameRp);
        rpReward = Math.max(0, rpReward);

        const newHighScore = score > (player.high_score || 0) ? score : (player.high_score || 0);

        await base44.asServiceRole.entities.Player.update(user_id, {
            total_score: (player.total_score || 0) + score,
            games_played: (player.games_played || 0) + 1,
            reputation_points: (player.reputation_points || 0) + rpReward,
            high_score: newHighScore,
            last_seen: new Date().toISOString(),
            daily_rp_date: today,
            daily_rp_games: dailyGameRp + rpReward
        });

        const allScores = await base44.asServiceRole.entities.Score.list('-score', 1000);
        const rank = allScores.findIndex(s => s.id === scoreRecord.id) + 1;

        return Response.json({
            success: true,
            score: scoreRecord,
            rp_earned: rpReward,
            rank,
            total_rp: (player.reputation_points || 0) + rpReward
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});