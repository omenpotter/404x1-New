import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { getSessionPlayer } from '../../shared/session.ts';

// Deleting a conversation is a personal action, not a shared one.
//
// The thread is hidden for the caller only: their own list stops showing it, while the other
// participant keeps the conversation and every message in it. Nothing is destroyed, so no
// participant can erase the other person's history — and a new message brings the thread back.
Deno.serve(async (req) => {
    try {
        const { conversation_id, session_token } = await req.json();

        if (!conversation_id) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        const player = await getSessionPlayer(base44, session_token);
        if (!player) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        const player_id = player.id;

        // Verify conversation exists and player is a participant
        const conversation = await base44.asServiceRole.entities.Conversation.get(conversation_id).catch(() => null);
        if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

        if (!(conversation.participant_ids || []).includes(player_id)) {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }

        // $addToSet is atomic and idempotent: parallel deletes by the same player cannot
        // duplicate the entry, and no other participant's visibility is touched.
        await base44.asServiceRole.entities.Conversation.updateMany(
            { id: conversation_id },
            { $addToSet: { hidden_for: player_id } }
        );

        return Response.json({ success: true, hidden_for_self: true });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});