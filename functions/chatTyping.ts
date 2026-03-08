import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    try {
        await req.json();

        const base44 = createClientFromRequest(req);
        const authUser = await base44.auth.me();
        if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const user_id = authUser.id;

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