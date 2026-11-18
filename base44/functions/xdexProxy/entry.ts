import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { getSessionPlayer } from '../../shared/session.ts';
import { corsHeaders } from '../../shared/cors.ts';

// DISABLED — no client code calls this proxy. The app reads market data directly from the X1 RPC
// endpoints and links out to app.xdex.xyz for trading, so nothing here was in use. It is kept as
// a refusing stub rather than deleted so no caller silently falls through to an empty response,
// and so the function inventory stays stable. Re-enabling requires an allowlist of the exact
// upstream paths the app needs plus a per-player rate limit, not just the origin filter below.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) });

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // The session requirement stays so an anonymous caller learns nothing about the endpoint.
    const caller = await getSessionPlayer(base44, body?.session_token);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(req) });

    return Response.json({
      disabled: true,
      error: 'xdexProxy is disabled. Market data is read directly from the X1 RPC endpoints.'
    }, { status: 410, headers: corsHeaders(req) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }
});