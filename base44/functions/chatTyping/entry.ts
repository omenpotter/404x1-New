import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    try {
        const { user_id } = await req.json();
        if (!user_id) return Response.json({ success: false }, { headers });

        const base44 = createClientFromRequest(req);

        await base44.asServiceRole.entities.Player.update(user_id, {
            is_typing: true,
            typing_since: new Date().toISOString(),
            last_seen: new Date().toISOString()
        });

        return Response.json({ success: true }, { headers });

    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
});