import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
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

    await base44.asServiceRole.entities.GameSession.update(playSession.id, { consumed: true });

    const scoreRecord = await base44.asServiceRole.entities.Score.create({
      player_id: player.id,
      username: player.username,
      score: finalScore,
      level_reached: Number(level_reached) || 1,
      deaths: Number(deaths) || 0,
      time_seconds: Math.floor(reportedSeconds)
    });

    // Daily game RP cap
    const today = new Date().toISOString().slice(0, 10);
    const sameDay = player.daily_rp_date === today;
    const dailyGameRp = sameDay ? (Number(player.daily_rp_games) || 0) : 0;

    let rpReward = Math.floor(finalScore / 100);
    rpReward = Math.min(rpReward, DAILY_GAME_RP_CAP - dailyGameRp);
    rpReward = Math.max(0, rpReward);

    const currentTotal = Number(player.total_score) || 0;
    const currentHigh = Number(player.high_score) || 0;
    const currentRp = Number(player.reputation_points) || 0;

    await base44.asServiceRole.entities.Player.update(player.id, {
      total_score: currentTotal + finalScore,
      games_played: (Number(player.games_played) || 0) + 1,
      reputation_points: currentRp + rpReward,
      high_score: finalScore > currentHigh ? finalScore : currentHigh,
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
      total_rp: currentRp + rpReward
    }, { headers });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers });
  }
}