import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { username } = body;
    if (!username || username.length < 2) {
      return Response.json({ error: 'username query must be at least 2 characters' }, { status: 400 });
    }

    const moderator = await base44.asServiceRole.entities.Player.get(user.id);
    if (!moderator || !['moderator', 'admin', 'superuser'].includes(moderator.user_role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const all = await base44.asServiceRole.entities.Player.list(null, 500);
    const q = username.toLowerCase();
    const matches = all
      .filter(p => p.username?.toLowerCase().includes(q))
      .slice(0, 10)
      .map(p => ({
        id: p.id,
        username: p.username,
        user_role: p.user_role,
        reputation_points: p.reputation_points || 0,
        is_muted: p.is_muted || false,
        is_banned: p.is_banned || false,
        last_seen: p.last_seen,
      }));

    return Response.json({ success: true, players: matches });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});