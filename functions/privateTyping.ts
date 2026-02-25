import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Lightweight typing indicator endpoint.
// Frontend polls this or uses it as a fire-and-forget ping.
// Stores typing state temporarily using a TypingState approach via player last_seen update.

Deno.serve(async (req) => {
    try {
        const { player_id, conversation_id, is_typing } = await req.json();

        if (!player_id || !conversation_id) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Verify player is in conversation
        const conversation = await base44.asServiceRole.entities.Conversation.get(conversation_id);
        if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

        if (!conversation.participant_ids.includes(player_id)) {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }

        // Update player last_seen so other participants can infer typing
        await base44.asServiceRole.entities.Player.update(player_id, {
            last_seen: new Date().toISOString()
        });

        // Return typing state to broadcast to conversation participants
        return Response.json({
            success: true,
            typing_event: {
                player_id,
                conversation_id,
                is_typing: is_typing !== false, // default true
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});