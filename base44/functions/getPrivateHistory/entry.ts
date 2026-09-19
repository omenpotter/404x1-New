import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getSessionPlayer } from '../../shared/session.ts';

Deno.serve(async (req) => {
    try {
        const { conversation_id, session_token, limit = 50, offset = 0 } = await req.json();

        if (!conversation_id) {
            return Response.json({ error: 'conversation_id is required' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Caller is the authenticated player — never trust client-supplied player_id.
        const caller = await getSessionPlayer(base44, session_token);
        if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const conversation = await base44.asServiceRole.entities.Conversation.get(conversation_id);
        if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

        if (!conversation.participant_ids.includes(caller.id)) {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }

        const allMessages = await base44.asServiceRole.entities.PrivateMessage.filter(
            { conversation_id },
            'created_date',
            200
        );

        const visible = allMessages.filter(m => !m.is_deleted);
        const paginated = visible.slice(offset, offset + limit);

        // Mark unread messages as delivered for this caller
        const undelivered = paginated.filter(m =>
            m.sender_id !== caller.id && !(m.delivered_to || []).includes(caller.id)
        );

        for (const msg of undelivered) {
            await base44.asServiceRole.entities.PrivateMessage.update(msg.id, {
                delivered_to: [...(msg.delivered_to || []), caller.id]
            });
        }

        return Response.json({
            success: true,
            messages: paginated,
            total: visible.length,
            conversation
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});