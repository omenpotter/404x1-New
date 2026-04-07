import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { player_id } = await req.json();

  if (!player_id) return Response.json({ success: false, error: 'player_id required' });

  try {
    const [players, messages, rpReceived, rpSent] = await Promise.all([
      base44.asServiceRole.entities.Player.filter({ id: player_id }, '-created_date', 1),
      base44.asServiceRole.entities.Message.filter({ player_id, is_deleted: false }, '-created_date', 25),
      base44.asServiceRole.entities.RpAward.filter({ to_player_id: player_id }, '-created_date', 25),
      base44.asServiceRole.entities.RpAward.filter({ from_player_id: player_id }, '-created_date', 10),
    ]);

    return Response.json({
      success: true,
      player: players[0] || null,
      recent_messages: messages,
      rp_received: rpReceived,
      rp_sent: rpSent,
    });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});