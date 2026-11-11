import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { getSessionPlayer, generateToken } from '../../shared/session.ts';

// Issues a server-side play session before a run. The token is the only proof that the
// play time measured when the score is submitted was measured on the server.
export default async function (req: Request): Promise<Response> {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Player is the authenticated caller — never trust a client-supplied player id.
    const player = await getSessionPlayer(base44, body?.session_token);
    if (!player) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });

    const session = await base44.asServiceRole.entities.GameSession.create({
      player_id: player.id,
      token: generateToken(),
      started_at: new Date().toISOString(),
      consumed: false,
    });

    return Response.json({
      success: true,
      play_token: session.token,
      started_at: session.started_at,
    }, { headers });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers });
  }
}