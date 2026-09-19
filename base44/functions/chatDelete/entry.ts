import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getSessionPlayer } from '../../shared/session.ts';

Deno.serve(async (req) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    try {
        const { session_token, message_id, flag_only } = await req.json();
        if (!message_id) return Response.json({ error: 'Missing fields' }, { status: 400 });

        const base44 = createClientFromRequest(req);

        // Identify caller from session — never trust client-supplied user_id.
        const player = await getSessionPlayer(base44, session_token);
        if (!player) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const msg = await base44.asServiceRole.entities.Message.get(message_id);
        if (!msg) return Response.json({ error: 'Message not found' }, { status: 404 });

        if (flag_only) {
            await base44.asServiceRole.entities.Message.update(message_id, { is_flagged: true, flagged_by: player.id });
            return Response.json({ success: true }, { headers });
        }

        const canDelete = msg.player_id === player.id || ['moderator', 'admin', 'superuser'].includes(player.user_role);
        if (!canDelete) return Response.json({ error: 'Not authorised' }, { status: 403 });

        await base44.asServiceRole.entities.Message.update(message_id, { is_deleted: true, deleted_by: player.id });

        return Response.json({ success: true }, { headers });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
});