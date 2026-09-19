import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getSessionPlayer } from '../../shared/session.ts';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let query = '';
  let limit = 12;
  let session_token: string | null = null;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    query = url.searchParams.get('q') || '';
    limit = parseInt(url.searchParams.get('limit') || '12');
    session_token = req.headers.get('Authorization')?.replace('Bearer ', '');
  } else {
    const body = await req.json();
    query = body.query || body.q || '';
    limit = body.limit || 12;
    session_token = body.session_token || req.headers.get('Authorization')?.replace('Bearer ', '');
  }

  const caller = await getSessionPlayer(base44, session_token);
  if (!caller) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

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
      }));
    return Response.json({ success: true, players: filtered });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});