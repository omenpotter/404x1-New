import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getSessionPlayer } from '../../shared/session.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { player_id, session_token } = await req.json();

  const caller = await getSessionPlayer(base44, session_token);
  if (!caller) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  if (!player_id) return Response.json({ success: false, error: 'player_id required' });

  // Only the player themselves or staff (moderator/admin/superuser) may view full activity
  const isStaff = ['moderator', 'admin', 'superuser'].includes(caller.user_role);
  if (player_id !== caller.id && !isStaff) {
    return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [players, messages, rpReceived, rpSent] = await Promise.all([
      base44.asServiceRole.entities.Player.filter({ id: player_id }, '-created_date', 1),
      base44.asServiceRole.entities.Message.filter({ player_id, is_deleted: false }, '-created_date', 25),
      base44.asServiceRole.entities.RpAward.filter({ to_player_id: player_id }, '-created_date', 25),
      base44.asServiceRole.entities.RpAward.filter({ from_player_id: player_id }, '-created_date', 10),
    ]);

    // Strip sensitive fields before returning — never expose session_token
    const player = players[0] || null;
    if (player) {
      delete player.session_token;
      delete player.session_expires_at;
      delete player.wallet_address;
    }

    return Response.json({
      success: true,
      player,
      recent_messages: messages,
      rp_received: rpReceived,
      rp_sent: rpSent,
    });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});