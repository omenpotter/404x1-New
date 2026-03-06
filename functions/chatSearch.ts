import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    try {
        const url = new URL(req.url);
        const q = (url.searchParams.get('q') || '').toLowerCase().trim();
        const limit = parseInt(url.searchParams.get('limit') || '20');

        if (!q) return Response.json({ success: true, messages: [] }, { headers });

        const base44 = createClientFromRequest(req);
        const all = await base44.asServiceRole.entities.Message.list('-created_date', 500);

        const results = all
            .filter(m => !m.is_deleted && m.message?.toLowerCase().includes(q))
            .slice(0, limit);

        return Response.json({ success: true, messages: results }, { headers });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
});