import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    try {
        const { user_id, message_id, action } = await req.json();
        if (!user_id || !message_id || !action) return Response.json({ error: 'Missing fields' }, { status: 400 });

        const base44 = createClientFromRequest(req);
        const player = await base44.asServiceRole.entities.Player.get(user_id);
        if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

        if (!['moderator', 'admin', 'superuser'].includes(player.user_role))
            return Response.json({ error: 'Not authorised' }, { status: 403 });

        if (action === 'pin') {
            // Unpin any currently pinned message first
            const all = await base44.asServiceRole.entities.Message.list(null, 500);
            for (const m of all.filter(m => m.is_pinned)) {
                await base44.asServiceRole.entities.Message.update(m.id, { is_pinned: false });
            }
            await base44.asServiceRole.entities.Message.update(message_id, { is_pinned: true });
        } else {
            await base44.asServiceRole.entities.Message.update(message_id, { is_pinned: false });
        }

        return Response.json({ success: true }, { headers });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
});