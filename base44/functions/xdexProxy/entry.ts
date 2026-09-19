import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { getSessionPlayer } from '../../shared/session.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Strict validation: only allow relative paths on api.xdex.xyz.
// Blocks @ (userinfo redirect), :// (other hosts), .. (path traversal),
// and any non-path characters.
function isValidEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || !endpoint.startsWith('/')) return false;
  if (endpoint.includes('@') || endpoint.includes('://') || endpoint.includes('..')) return false;
  // Only allow safe path/query characters
  if (!/^[a-zA-Z0-9\-_/.?=&%]+$/.test(endpoint)) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { endpoint, session_token } = body;

    const base44 = createClientFromRequest(req);
    const caller = await getSessionPlayer(base44, session_token);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });

    if (!isValidEndpoint(endpoint)) {
      return Response.json({ error: 'Invalid or disallowed endpoint' }, { status: 400, headers: CORS });
    }

    const res = await fetch(`https://api.xdex.xyz${endpoint}`, {
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json();
    return Response.json(data, { headers: CORS });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: CORS });
  }
});