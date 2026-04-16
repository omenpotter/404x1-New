import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    try {
        const body = await req.json();
        const user_id = body.user_id;
        const message_id = body.message_id;
        const action = body.action || 'pin';

        if (!user_id || !message_id) {
            return Response.json({ error: 'Missing fields' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        const player = await base44.asServiceRole.entities.Player.get(user_id);
        if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

        const modRoles = ['moderator', 'admin', 'superuser'];
        if (!modRoles.includes(player.user_role)) {
            return Response.json({ error: 'Not authorised' }, { status: 403 });
        }

        if (action === 'pin') {
            const all = await base44.asServiceRole.entities.Message.list(null, 500);
            const pinned = all.filter(function(m) { return m.is_pinned; });
            for (let i = 0; i < pinned.length; i++) {
                await base44.asServiceRole.entities.Message.update(pinned[i].id, { is_pinned: false });
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