import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { moderator_id, target_player_id, reason } = await req.json();

  if (!moderator_id || !target_player_id || !reason) {
    return Response.json({ success: false, error: 'moderator_id, target_player_id, and reason are required' });
  }

  try {
    const [mods, targets] = await Promise.all([
      base44.asServiceRole.entities.Player.filter({ id: moderator_id }, '-created_date', 1),
      base44.asServiceRole.entities.Player.filter({ id: target_player_id }, '-created_date', 1),
    ]);

    const mod = mods[0];
    const target = targets[0];

    if (!mod) return Response.json({ success: false, error: 'Moderator not found' });
    if (!['moderator','admin','superuser'].includes(mod.user_role)) {
      return Response.json({ success: false, error: 'Insufficient permissions' });
    }
    if (!target) return Response.json({ success: false, error: 'Target player not found' });

    await base44.asServiceRole.entities.ModerationLog.create({
      moderator_id: mod.id,
      moderator_username: mod.username,
      moderator_role: mod.user_role,
      target_player_id: target.id,
      target_username: target.username,
      action_type: 'warning',
      reason,
    });

    return Response.json({ success: true, message: `Warning issued to ${target.username}` });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});