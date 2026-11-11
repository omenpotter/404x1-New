import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { getSessionPlayer } from '../../shared/session.ts';

const ACTION_COSTS = {
  highlight_message: { base: 25, per_week: false },
  pin_message: { base: 100, per_week: false },
  username_color: { base: 500, per_week: true },
  profile_frame: { base: 300, per_week: true },
};

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { action, duration_weeks = 1, color, frame, session_token } = body;

    if (!action || !ACTION_COSTS[action]) {
      return Response.json({ error: `Invalid action. Must be one of: ${Object.keys(ACTION_COSTS).join(', ')}` }, { status: 400, headers });
    }

    // Player is the authenticated caller — never trust client-supplied player_id.
    const player = await getSessionPlayer(base44, session_token);
    if (!player) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });

    const actionConfig = ACTION_COSTS[action];
    // duration_weeks is client-supplied — coerce it and bound it before it prices anything.
    const requestedWeeks = parseInt(duration_weeks ?? 1, 10);
    if (actionConfig.per_week && (!Number.isInteger(requestedWeeks) || requestedWeeks < 1 || requestedWeeks > 52)) {
      return Response.json({ error: 'duration_weeks must be a whole number between 1 and 52' }, { status: 400, headers });
    }
    const weeks = actionConfig.per_week ? requestedWeeks : 1;
    const cost = actionConfig.base * weeks;
    if (!Number.isInteger(cost) || cost <= 0) {
      return Response.json({ error: 'Invalid purchase cost' }, { status: 400, headers });
    }

    if (action === 'username_color') {
      if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return Response.json({ error: 'Valid hex color required (e.g. #FF00AA)' }, { status: 400, headers });
      }
    }
    if (action === 'profile_frame' && !frame) {
      return Response.json({ error: 'frame field is required' }, { status: 400, headers });
    }

    const spendableRp = (player.reputation_points || 0) - (player.locked_rp || 0);
    if (spendableRp < cost) {
      return Response.json({ error: `Insufficient spendable RP. Need ${cost}, have ${spendableRp}` }, { status: 400, headers });
    }

    const burnedRp = Math.floor(cost * 0.25);
    const now = new Date();

    const perkFields: Record<string, unknown> = {};
    let expiresAt = null;

    if (action === 'highlight_message') {
      expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      perkFields.highlight_expires_at = expiresAt;
    } else if (action === 'username_color') {
      expiresAt = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
      perkFields.username_color = color;
      perkFields.username_color_expires_at = expiresAt;
    } else if (action === 'profile_frame') {
      expiresAt = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
      perkFields.profile_frame = frame;
      perkFields.profile_frame_expires_at = expiresAt;
    }

    // Deduct and apply the perk in one conditional write: the balance only moves if the unlocked
    // RP still covers the cost, so parallel purchases cannot spend the same RP twice.
    const mutation: Record<string, unknown> = { $inc: { reputation_points: -cost } };
    if (Object.keys(perkFields).length > 0) mutation.$set = perkFields;

    const debit = await base44.asServiceRole.entities.Player.updateMany(
      { id: player.id, reputation_points: { $gte: (player.locked_rp || 0) + cost } },
      mutation
    );
    if (!debit.updated) {
      return Response.json({ error: 'Insufficient spendable RP' }, { status: 400, headers });
    }

    const updatedPlayer = await base44.asServiceRole.entities.Player.get(player.id);

    await base44.asServiceRole.entities.RpSpend.create({
      player_id: player.id,
      player_username: player.username,
      action,
      cost,
      burned_rp: burnedRp,
      duration_weeks: weeks,
      expires_at: expiresAt
    });

    return Response.json({
      success: true,
      action,
      cost,
      burned_rp: burnedRp,
      new_rp_balance: updatedPlayer.reputation_points,
      expires_at: expiresAt
    }, { headers });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers });
  }
});