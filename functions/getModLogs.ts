import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { limit = 50, target_player_id } = await req.json();

  try {
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