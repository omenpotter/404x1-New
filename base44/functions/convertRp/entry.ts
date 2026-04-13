import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });

    const body = await req.json();
    const amount = parseInt(body.amount);

    if (!amount || amount < 500 || amount % 500 !== 0) {
      return Response.json({ error: 'Amount must be a multiple of 500, minimum 500' }, { status: 400, headers });
    }

    const player = await base44.asServiceRole.entities.Player.get(user.id);
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404, headers });

    // Eligibility check
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

    // Weekly cap check
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(now);
    thisMonday.setUTCDate(now.getUTCDate() - daysFromMonday);
    thisMonday.setUTCHours(0, 0, 0, 0);

    let weeklyRp = player.conversion_week_rp || 0;
    let weeklyUpdates = {};
    const weekStart = player.conversion_week_start ? new Date(player.conversion_week_start) : null;

    if (!weekStart || weekStart < thisMonday) {
      weeklyRp = 0;
      weeklyUpdates.conversion_week_start = thisMonday.toISOString();
      weeklyUpdates.conversion_week_rp = 0;
    }

    if (weeklyRp + amount > 3000) {
      return Response.json({ error: 'Weekly conversion cap of 3,000 RP reached' }, { status: 400, headers });
    }

    // Halving rate calculation
    const launchDateStr = Deno.env.get('LAUNCH_DATE') || '2025-01-01';
    const launchDate = new Date(launchDateStr);
    const yearsSinceLaunch = (now - launchDate) / (365.25 * 24 * 3600 * 1000);
    const halvingRate = 1 / Math.pow(2, Math.floor(Math.max(0, yearsSinceLaunch) / 2));
    const rpxEarned = amount * halvingRate;

    // Execute conversion
    const newRpBalance = (player.reputation_points || 0) - amount;
    const newRpxBalance = (player.rpx_balance || 0) + rpxEarned;
    const newWeeklyRp = weeklyRp + amount;
    const newTotalConverted = (player.total_rp_converted || 0) + amount;

    await base44.asServiceRole.entities.Player.update(player.id, {
      reputation_points: newRpBalance,
      rpx_balance: newRpxBalance,
      conversion_week_rp: newWeeklyRp,
      total_rp_converted: newTotalConverted,
      ...weeklyUpdates
    });

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
      new_rp_balance: newRpBalance,
      new_rpx_balance: newRpxBalance,
      weekly_remaining: 3000 - newWeeklyRp
    }, { headers });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers });
  }
});