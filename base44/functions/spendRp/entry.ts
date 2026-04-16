import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
    const { action, duration_weeks = 1, color, frame, player_id } = body;

    if (!player_id) return Response.json({ error: 'player_id required' }, { status: 400, headers });
    if (!action || !ACTION_COSTS[action]) {
      return Response.json({ error: `Invalid action. Must be one of: ${Object.keys(ACTION_COSTS).join(', ')}` }, { status: 400, headers });
    }

    const actionConfig = ACTION_COSTS[action];
    const cost = actionConfig.per_week ? actionConfig.base * duration_weeks : actionConfig.base;

    // Validate extra fields
    if (action === 'username_color') {
      if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return Response.json({ error: 'Valid hex color required (e.g. #FF00AA)' }, { status: 400, headers });
      }
    }
    if (action === 'profile_frame' && !frame) {
      return Response.json({ error: 'frame field is required' }, { status: 400, headers });
    }

    const player = await base44.asServiceRole.entities.Player.get(player_id);
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404, headers });

    const spendableRp = (player.reputation_points || 0) - (player.locked_rp || 0);
    if (spendableRp < cost) {
      return Response.json({ error: `Insufficient spendable RP. Need ${cost}, have ${spendableRp}` }, { status: 400, headers });
    }

    const burnedRp = Math.floor(cost * 0.25);
    const newRpBalance = (player.reputation_points || 0) - cost;
    const now = new Date();

    // Build player update
    const playerUpdate = { reputation_points: newRpBalance };
    let expiresAt = null;

    if (action === 'highlight_message') {
      expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      playerUpdate.highlight_expires_at = expiresAt;
    } else if (action === 'username_color') {
      expiresAt = new Date(now.getTime() + duration_weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
      playerUpdate.username_color = color;
      playerUpdate.username_color_expires_at = expiresAt;
    } else if (action === 'profile_frame') {
      expiresAt = new Date(now.getTime() + duration_weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
      playerUpdate.profile_frame = frame;
      playerUpdate.profile_frame_expires_at = expiresAt;
    }
    // pin_message: just deduct RP, no expiry field on player

    await base44.asServiceRole.entities.Player.update(player.id, playerUpdate);

    await base44.asServiceRole.entities.RpSpend.create({
      player_id: player.id,
      player_username: player.username,
      action,
      cost,
      burned_rp: burnedRp,
      duration_weeks,
      expires_at: expiresAt
    });

    return Response.json({
      success: true,
      action,
      cost,
      burned_rp: burnedRp,
      new_rp_balance: newRpBalance,
      expires_at: expiresAt
    }, { headers });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers });
  }
});