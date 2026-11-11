import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { getSessionPlayer } from '../../shared/session.ts';

const WEEKLY_CAP = 3000;

Deno.serve(async (req) => {
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const amount = parseInt(body.amount);
    const { session_token } = body;

    if (!amount || amount < 500 || amount % 500 !== 0) {
      return Response.json({ error: 'Amount must be a multiple of 500, minimum 500' }, { status: 400, headers });
    }

    // Player is the authenticated caller — never trust client-supplied player_id.
    const player = await getSessionPlayer(base44, session_token);
    if (!player) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });

    const lockedRp = player.locked_rp || 0;
    let eligibleRp;
    if (player.is_404_holder) {
      eligibleRp = (player.reputation_points || 0) - lockedRp - 10000;
    } else {
      eligibleRp = (player.reputation_points || 0) - lockedRp;
    }

    if (eligibleRp < 500) {
      return Response.json({ error: 'Minimum 500 eligible RP required to convert' }, { status: 400, headers });
    }
    if (amount > eligibleRp) {
      return Response.json({ error: 'Insufficient eligible RP' }, { status: 400, headers });
    }

    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(now);
    thisMonday.setUTCDate(now.getUTCDate() - daysFromMonday);
    thisMonday.setUTCHours(0, 0, 0, 0);

    // Reset a stale weekly counter first. The guard only matches a window that is not yet this
    // week, so a request that already rolled the window forward is never rewound.
    const weekStart = player.conversion_week_start ? new Date(player.conversion_week_start) : null;
    if (!weekStart || weekStart < thisMonday || player.conversion_week_rp == null) {
      await base44.asServiceRole.entities.Player.updateMany(
        { id: player.id, conversion_week_start: { $ne: thisMonday.toISOString() } },
        { $set: { conversion_week_start: thisMonday.toISOString(), conversion_week_rp: 0 } }
      );
    }

    // Claim weekly capacity with a conditional increment: it only lands while the stored counter
    // still leaves room, so parallel conversions cannot share the same headroom.
    const claim = await base44.asServiceRole.entities.Player.updateMany(
      { id: player.id, conversion_week_rp: { $lte: WEEKLY_CAP - amount } },
      { $inc: { conversion_week_rp: amount } }
    );
    if (!claim.updated) {
      return Response.json({ error: `Weekly conversion cap of ${WEEKLY_CAP} RP reached` }, { status: 400, headers });
    }

    const launchDateStr = Deno.env.get('LAUNCH_DATE') || '2025-01-01';
    const launchDate = new Date(launchDateStr);
    const yearsSinceLaunch = (now - launchDate) / (365.25 * 24 * 3600 * 1000);
    const halvingRate = 1 / Math.pow(2, Math.floor(Math.max(0, yearsSinceLaunch) / 2));
    const rpxEarned = amount * halvingRate;

    // Debit RP and credit RPx/total in one conditional write: it only lands while the unlocked
    // balance (including the 404 holder floor) still covers the conversion.
    const floor = lockedRp + (player.is_404_holder ? 10000 : 0);
    const debit = await base44.asServiceRole.entities.Player.updateMany(
      { id: player.id, reputation_points: { $gte: floor + amount } },
      { $inc: { reputation_points: -amount, rpx_balance: rpxEarned, total_rp_converted: amount } }
    );
    if (!debit.updated) {
      // Nothing was converted — hand the weekly headroom back before reporting failure.
      await base44.asServiceRole.entities.Player.updateMany(
        { id: player.id, conversion_week_rp: { $gte: amount } },
        { $inc: { conversion_week_rp: -amount } }
      );
      return Response.json({ error: 'Insufficient eligible RP' }, { status: 400, headers });
    }

    const updatedPlayer = await base44.asServiceRole.entities.Player.get(player.id);

    await base44.asServiceRole.entities.RpConversion.create({
      player_id: player.id,
      player_username: player.username,
      rp_spent: amount,
      rpx_earned: rpxEarned,
      halving_rate: halvingRate,
      converted_at: now.toISOString()
    });

    return Response.json({
      success: true,
      rp_spent: amount,
      rpx_earned: rpxEarned,
      halving_rate: halvingRate,
      new_rp_balance: updatedPlayer.reputation_points,
      new_rpx_balance: updatedPlayer.rpx_balance,
      weekly_remaining: Math.max(0, WEEKLY_CAP - (updatedPlayer.conversion_week_rp || 0))
    }, { headers });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers });
  }
});