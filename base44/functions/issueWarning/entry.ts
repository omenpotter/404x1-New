import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getSessionPlayer } from '../../shared/session.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { target_player_id, reason, session_token } = await req.json();

  if (!target_player_id || !reason) {
    return Response.json({ success: false, error: 'target_player_id and reason are required' });
  }

  try {
    const mod = await getSessionPlayer(base44, session_token);
    if (!mod) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!['moderator','admin','superuser'].includes(mod.user_role)) {
      return Response.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const targets = await base44.asServiceRole.entities.Player.filter({ id: target_player_id }, '-created_date', 1);
    const target = targets[0];
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