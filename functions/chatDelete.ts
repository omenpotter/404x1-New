import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    try {
        const { message_id } = await req.json();
        if (!message_id) return Response.json({ error: 'Missing fields' }, { status: 400 });

        const base44 = createClientFromRequest(req);
        const authUser = await base44.auth.me();
        if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const user_id = authUser.id;
        const player = await base44.asServiceRole.entities.Player.get(user_id);
        if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

        const msg = await base44.asServiceRole.entities.Message.get(message_id);
        if (!msg) return Response.json({ error: 'Message not found' }, { status: 404 });

        const canDelete = msg.player_id === user_id || ['moderator', 'admin', 'superuser'].includes(player.user_role);
        if (!canDelete) return Response.json({ error: 'Not authorised' }, { status: 403 });

        await base44.asServiceRole.entities.Message.update(message_id, { is_deleted: true, message: '[deleted]' });

        return Response.json({ success: true }, { headers });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
});