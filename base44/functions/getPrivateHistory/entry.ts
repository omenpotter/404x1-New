import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const { conversation_id, player_id, limit = 50, offset = 0 } = await req.json();

        if (!conversation_id) {
            return Response.json({ error: 'conversation_id is required' }, { status: 400 });
        }

        if (!player_id) {
            return Response.json({ error: 'player_id is required' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Verify conversation exists and player is a participant
        const conversation = await base44.asServiceRole.entities.Conversation.get(conversation_id);
        if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

        if (!conversation.participant_ids.includes(player_id)) {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }

        // Fetch messages
        const allMessages = await base44.asServiceRole.entities.PrivateMessage.filter(
            { conversation_id },
            'created_date',
            200
        );

        // Filter deleted and paginate
        const visible = allMessages.filter(m => !m.is_deleted);
        const paginated = visible.slice(offset, offset + limit);

        // Mark unread messages as delivered for this player
        const undelivered = paginated.filter(m =>
            m.sender_id !== player_id && !(m.delivered_to || []).includes(player_id)
        );

        for (const msg of undelivered) {
            await base44.asServiceRole.entities.PrivateMessage.update(msg.id, {
                delivered_to: [...(msg.delivered_to || []), player_id]
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