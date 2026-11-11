import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { getSessionPlayer } from '../../shared/session.ts';

const MAX_SCORE = 50000;                     // hard cap — reject impossibly high scores
const DAILY_GAME_RP_CAP = 500;                // max RP from games per day
const MAX_SCORE_PER_ELAPSED_SECOND = 200;     // ceiling derived from server-measured play time
const DURATION_GRACE_SECONDS = 10;            // allowance for load/submit latency

export default async function (req: Request): Promise<Response> {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { score, level_reached, deaths, time_seconds, play_token, session_token } = body || {};

    // Player is the authenticated caller — never trust a client-supplied player id.
    const player = await getSessionPlayer(base44, session_token);
    if (!player) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });

    if (!play_token || typeof play_token !== 'string') {
      return Response.json({ error: 'Missing play_token — start a game to get one' }, { status: 400, headers });
    }

    const finalScore = Number(score);
    if (!Number.isInteger(finalScore) || finalScore < 0) {
      return Response.json({ error: 'Invalid score' }, { status: 400, headers });
    }
    if (finalScore > MAX_SCORE) {
      return Response.json({ error: `Score exceeds maximum allowed (${MAX_SCORE})` }, { status: 400, headers });
    }

    // The play session must belong to this player and be unused.
    const sessions = await base44.asServiceRole.entities.GameSession.filter(
      { token: play_token, player_id: player.id },
      null,
      1
    );
    const playSession = Array.isArray(sessions) ? sessions[0] : sessions?.items?.[0];
    if (!playSession || playSession.consumed) {
      return Response.json({ error: 'Invalid or already submitted play session' }, { status: 400, headers });
    }

    // Score and duration are bounded by how long actually elapsed on the server.
    const elapsedSeconds = Math.floor((Date.now() - new Date(playSession.started_at).getTime()) / 1000);
    const allowedSeconds = Math.max(0, elapsedSeconds) + DURATION_GRACE_SECONDS;

    if (finalScore > allowedSeconds * MAX_SCORE_PER_ELAPSED_SECOND) {
      return Response.json({ error: 'Score is not plausible for the elapsed play time' }, { status: 400, headers });
    }

    const reportedSeconds = Number(time_seconds);
    if (!Number.isFinite(reportedSeconds) || reportedSeconds < 0 || reportedSeconds > allowedSeconds) {
      return Response.json({ error: 'Invalid play duration' }, { status: 400, headers });
    }

    // Claim the play session atomically: only one request can flip consumed false -> true, so
    // parallel submissions of the same token cannot all record a score.
    const consumed = await base44.asServiceRole.entities.GameSession.updateMany(
      { id: playSession.id, consumed: false },
      { $set: { consumed: true } }
    );
    if (!consumed.updated) {
      return Response.json({ error: 'Invalid or already submitted play session' }, { status: 400, headers });
    }

    const scoreRecord = await base44.asServiceRole.entities.Score.create({
      player_id: player.id,
      username: player.username,
      score: finalScore,
      level_reached: Number(level_reached) || 1,
      deaths: Number(deaths) || 0,
      time_seconds: Math.floor(reportedSeconds)
    });

    const today = new Date().toISOString().slice(0, 10);

    // Roll a stale daily counter over before it is claimed.
    if (player.daily_rp_date !== today) {
      await base44.asServiceRole.entities.Player.updateMany(
        { id: player.id, daily_rp_date: { $ne: today } },
        { $set: { daily_rp_date: today, daily_rp_games: 0 } }
      );
    }

    // Counters are incremented in place, never written back from the stale read above.
    await base44.asServiceRole.entities.Player.updateMany(
      { id: player.id },
      {
        $inc: { total_score: finalScore, games_played: 1 },
        $set: { last_seen: new Date().toISOString() }
      }
    );
    await base44.asServiceRole.entities.Player.updateMany(
      { id: player.id, high_score: { $lt: finalScore } },
      { $set: { high_score: finalScore } }
    );

    // The daily game RP cap is enforced by the write condition itself. Full reward first; if that
    // does not fit, the remaining headroom is claimed instead — never more than the cap allows.
    let rpReward = 0;
    const desiredReward = Math.floor(finalScore / 100);
    if (desiredReward > 0) {
      const full = await base44.asServiceRole.entities.Player.updateMany(
        { id: player.id, daily_rp_date: today, daily_rp_games: { $lte: DAILY_GAME_RP_CAP - desiredReward } },
        { $inc: { daily_rp_games: desiredReward, reputation_points: desiredReward } }
      );
      if (full.updated) {
        rpReward = desiredReward;
      } else {
        const fresh = await base44.asServiceRole.entities.Player.get(player.id);
        const remaining = DAILY_GAME_RP_CAP - (Number(fresh.daily_rp_games) || 0);
        if (remaining > 0) {
          const partial = await base44.asServiceRole.entities.Player.updateMany(
            { id: player.id, daily_rp_games: { $lte: DAILY_GAME_RP_CAP - remaining } },
            { $inc: { daily_rp_games: remaining, reputation_points: remaining } }
          );
          if (partial.updated) rpReward = remaining;
        }
      }
    }

    const updatedPlayer = await base44.asServiceRole.entities.Player.get(player.id);

    const allScores = await base44.asServiceRole.entities.Score.list('-score', 1000);
    const rank = allScores.findIndex(s => s.id === scoreRecord.id) + 1;

    return Response.json({
      success: true,
      score: scoreRecord,
      rp_earned: rpReward,
      rank,
      total_rp: updatedPlayer.reputation_points
    }, { headers });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers });
  }
}