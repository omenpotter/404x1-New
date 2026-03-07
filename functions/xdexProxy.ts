import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const { endpoint } = await req.json();

    const res = await fetch(`https://api.xdex.xyz${endpoint}`, {
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json();
    return Response.json(data, { headers: CORS });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: CORS });
  }
});