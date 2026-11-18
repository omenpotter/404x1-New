import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
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

        // One conditional, idempotent write. The conversation check sits in the query, so an id
        // from another thread can never be marked, and $addToSet cannot drop a concurrent
        // participant's receipt the way a read-modify-write can.
        await base44.asServiceRole.entities.PrivateMessage.updateMany(
            { id: { $in: message_ids }, conversation_id },
            { $addToSet: { read_by: player_id, delivered_to: player_id } }
        );

        return Response.json({ success: true, marked_read: message_ids.length });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});