import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getSessionPlayer } from '../../shared/session.ts';

Deno.serve(async (req) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    try {
        const { session_token } = await req.json();

        const base44 = createClientFromRequest(req);

        const player = await getSessionPlayer(base44, session_token);
        if (!player) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401, headers });

        await base44.asServiceRole.entities.Player.update(player.id, {
            is_typing: true,
            typing_since: new Date().toISOString(),
            last_seen: new Date().toISOString()
        });

        return Response.json({ success: true }, { headers });

    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
});