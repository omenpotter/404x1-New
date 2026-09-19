import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { getSessionPlayer } from '../../shared/session.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const { limit = 50, target_player_id, session_token } = body || {};

  try {
    // Auth: only admin/moderator/superuser may read moderation logs.
    const caller = await getSessionPlayer(base44, session_token);
    if (!caller || !['admin', 'moderator', 'superuser'].includes(caller.user_role)) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let logs;
    if (target_player_id) {
      logs = await base44.asServiceRole.entities.ModerationLog.filter(
        { target_player_id },
        '-created_date',
        limit
      );
    } else {
      logs = await base44.asServiceRole.entities.ModerationLog.list('-created_date', limit);
    }
    return Response.json({ success: true, logs });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});