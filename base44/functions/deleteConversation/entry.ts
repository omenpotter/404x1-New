import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const { conversation_id, player_id } = await req.json();

        if (!conversation_id || !player_id) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Verify conversation exists and player is a participant
        const conversation = await base44.asServiceRole.entities.Conversation.get(conversation_id);
        if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

        if (!conversation.participant_ids.includes(player_id)) {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }

        // Delete all messages in conversation
        const messages = await base44.asServiceRole.entities.PrivateMessage.filter({ conversation_id }, 'created_date', 500);
        for (const msg of messages) {
            await base44.asServiceRole.entities.PrivateMessage.delete(msg.id);
        }

        // Delete the conversation itself
        await base44.asServiceRole.entities.Conversation.delete(conversation_id);

        return Response.json({ success: true });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});