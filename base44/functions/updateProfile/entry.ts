import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getSessionPlayer } from '../../shared/session.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { bio, session_token } = await req.json();

  const player = await getSessionPlayer(base44, session_token);
  if (!player) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const trimmed = (bio || '').slice(0, 300);

  try {
    await base44.asServiceRole.entities.Player.update(player.id, { bio: trimmed });
    return Response.json({ success: true, bio: trimmed });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});