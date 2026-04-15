import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let query = '';
  let limit = 12;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    query = url.searchParams.get('q') || '';
    limit = parseInt(url.searchParams.get('limit') || '12');
  } else {
    const body = await req.json();
    query = body.query || body.q || '';
    limit = body.limit || 12;
  }

  if (!query || query.length < 2) {
    return Response.json({ success: true, players: [] });
  }

  try {
    const all = await base44.asServiceRole.entities.Player.list('-reputation_points', 500);
    const q = query.toLowerCase();
    const filtered = all
      .filter(p => p.username?.toLowerCase().includes(q))
      .slice(0, limit)
      .map(p => ({
        id: p.id,
        username: p.username,
        user_role: p.user_role,
        reputation_points: p.reputation_points || 0,
        is_muted: p.is_muted || false,
        is_banned: p.is_banned || false,
      }));
    return Response.json({ success: true, players: filtered });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});