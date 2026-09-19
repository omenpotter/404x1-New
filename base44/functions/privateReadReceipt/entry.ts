import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getSessionPlayer } from '../../shared/session.ts';

Deno.serve(async (req) => {
    try {
        const { conversation_id, message_ids, session_token } = await req.json();

        if (!conversation_id || !message_ids || !message_ids.length) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        const player = await getSessionPlayer(base44, session_token);
        if (!player) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        const player_id = player.id;

        // Verify player is in conversation
        const conversation = await base44.asServiceRole.entities.Conversation.get(conversation_id);
        if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

        if (!conversation.participant_ids.includes(player_id)) {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }

        // Mark messages as read
        const updates = [];
        for (const message_id of message_ids) {
            const msg = await base44.asServiceRole.entities.PrivateMessage.get(message_id);
            if (msg && msg.conversation_id === conversation_id && !msg.read_by.includes(player_id)) {
                updates.push(
                    base44.asServiceRole.entities.PrivateMessage.update(message_id, {
                        read_by: [...msg.read_by, player_id],
                        delivered_to: msg.delivered_to.includes(player_id)
                            ? msg.delivered_to
                            : [...msg.delivered_to, player_id]
                    })
                );
            }
        }

        await Promise.all(updates);

        return Response.json({ success: true, marked_read: updates.length });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});