import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { getSessionPlayer, isBanned } from '../../shared/session.ts';
import { corsHeaders } from '../../shared/cors.ts';

const WEEKLY_CAP = 3000;

Deno.serve(async (req) => {
    const headers = corsHeaders(req);
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
    if (isBanned(player)) return Response.json({ error: 'Your account is suspended' }, { status: 403, headers });

    // The conversion schedule is the one input this function cannot invent. Without a valid
    // LAUNCH_DATE the halving rate is undefined, so conversions are switched off rather than
    // priced against a guess. Checked before any balance is read or written.
    const scheduleRaw = (Deno.env.get('LAUNCH_DATE') || '').trim();
    const scheduleDate = scheduleRaw ? new Date(scheduleRaw) : null;
    if (!scheduleDate || Number.isNaN(scheduleDate.getTime()) || scheduleDate.getTime() > Date.now()) {
      return Response.json({
        success: false,
        disabled: true,
        error: 'RP conversions are temporarily unavailable while the conversion schedule is finalized. No RP was spent.'
      }, { status: 200, headers });
    }

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

    // scheduleDate was validated above; the halving formula itself is unchanged.
    const yearsSinceLaunch = (now.getTime() - scheduleDate.getTime()) / (365.25 * 24 * 3600 * 1000);
    const halvingRate = 1 / Math.pow(2, Math.floor(Math.max(0, yearsSinceLaunch) / 2));
    const rpxEarned = amount * halvingRate;

    // Weekly capacity and balances move in ONE conditional write on one document. They used to
    // be two writes with a compensating rollback in between, which meant a process dying after
    // the claim held the week's headroom without spending a thing. Now RP cannot leave the
    // balance unless the weekly counter rises with it, and there is no rollback write to lose.
    const floor = lockedRp + (player.is_404_holder ? 10000 : 0);
    const conversion = await base44.asServiceRole.entities.Player.updateMany(
      {
        id: player.id,
        conversion_week_rp: { $lte: WEEKLY_CAP - amount },
        reputation_points: { $gte: floor + amount }
      },
      { $inc: {
        conversion_week_rp: amount,
        reputation_points: -amount,
        rpx_balance: rpxEarned,
        total_rp_converted: amount
      } }
    );
    if (!conversion.updated) {
      // Nothing moved. Use the stored values to say which limit stopped it.
      const fresh = await base44.asServiceRole.entities.Player.get(player.id).catch(() => player);
      if ((fresh.conversion_week_rp || 0) > WEEKLY_CAP - amount) {
        return Response.json({ error: `Weekly conversion cap of ${WEEKLY_CAP} RP reached` }, { status: 400, headers });
      }
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