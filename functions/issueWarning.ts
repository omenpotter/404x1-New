import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { target_player_id, reason, severity, message_id } = await req.json();
    if (!target_player_id || !reason) {
      return Response.json({ error: 'target_player_id and reason are required' }, { status: 400 });
    }

    const moderator = await base44.asServiceRole.entities.Player.get(authUser.id);
    if (!moderator || !['moderator', 'admin', 'superuser'].includes(moderator.user_role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const target = await base44.asServiceRole.entities.Player.get(target_player_id);
    if (!target) return Response.json({ error: 'Target player not found' }, { status: 404 });

    const roleHierarchy = { member: 1, trusted: 2, moderator: 3, admin: 4, superuser: 5 };
    if ((roleHierarchy[target.user_role] || 1) >= (roleHierarchy[moderator.user_role] || 1)) {
      return Response.json({ error: 'Cannot warn users with equal or higher role' }, { status: 403 });
    }

    const warning = await base44.asServiceRole.entities.Warning.create({
      issued_by_id:       moderator.id,
      issued_by_username: moderator.username,
      issued_by_role:     moderator.user_role,
      target_player_id:   target.id,
      target_username:    target.username,
      severity:           severity || 'medium',
      reason,
      message_id:         message_id || null,
      acknowledged:       false,
    });

    // Audit in ModerationLog
    await base44.asServiceRole.entities.ModerationLog.create({
      moderator_id:       moderator.id,
      moderator_username: moderator.username,
      moderator_role:     moderator.user_role,
      target_player_id:   target.id,
      target_username:    target.username,
      action_type:        'warning',
      rp_change:          0,
      reason,
      message_id:         message_id || null,
    });

    return Response.json({ success: true, warning });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});