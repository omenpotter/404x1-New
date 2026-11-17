import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { getSessionPlayer, revokeSession } from '../../shared/session.ts';
import { corsHeaders } from '../../shared/cors.ts';

// Ends the caller's session for real: the token stops working immediately instead of
// staying valid for its full lifetime after the browser has forgotten it.
Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

  try {
    const body = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const player = await getSessionPlayer(base44, body?.session_token);
    if (player) await revokeSession(base44, player.id);
    return Response.json({ success: true }, { headers });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});