import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    try {
        const { user_id, message_id, flag_only } = await req.json();
        if (!user_id || !message_id) return Response.json({ error: 'Missing fields' }, { status: 400 });

        const base44 = createClientFromRequest(req);

        const player = await base44.asServiceRole.entities.Player.get(user_id);
        if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

        const msg = await base44.asServiceRole.entities.Message.get(message_id);
        if (!msg) return Response.json({ error: 'Message not found' }, { status: 404 });

        if (flag_only) {
            await base44.asServiceRole.entities.Message.update(message_id, { is_flagged: true, flagged_by: user_id });
            return Response.json({ success: true }, { headers });
        }

        const canDelete = msg.player_id === user_id || ['moderator', 'admin', 'superuser'].includes(player.user_role);
        if (!canDelete) return Response.json({ error: 'Not authorised' }, { status: 403 });

        await base44.asServiceRole.entities.Message.update(message_id, { is_deleted: true, deleted_by: user_id });

        return Response.json({ success: true }, { headers });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
});