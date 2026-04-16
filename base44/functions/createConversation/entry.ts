import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const { from_player_id, to_player_id } = await req.json();

        if (!from_player_id || !to_player_id) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        if (from_player_id === to_player_id) {
            return Response.json({ error: 'Cannot create conversation with yourself' }, { status: 400 });
        }

        // Verify both players exist
        const [fromPlayer, toPlayer] = await Promise.all([
            base44.asServiceRole.entities.Player.get(from_player_id),
            base44.asServiceRole.entities.Player.get(to_player_id)
        ]);

        if (!fromPlayer) return Response.json({ error: 'Sender not found' }, { status: 404 });
        if (!toPlayer) return Response.json({ error: 'Recipient not found' }, { status: 404 });

        // Check if muted
        if (fromPlayer.is_muted && fromPlayer.muted_until && new Date() < new Date(fromPlayer.muted_until)) {
            return Response.json({ error: 'You are muted and cannot start conversations' }, { status: 403 });
        }

        // Check if conversation already exists between these two players
        const allConvs = await base44.asServiceRole.entities.Conversation.list(null, 500);
        const existing = allConvs.filter(c =>
            c.participant_ids && c.participant_ids.includes(from_player_id) && c.participant_ids.includes(to_player_id)
        );

        if (existing.length > 0) {
            return Response.json({ success: true, conversation: existing[0], is_existing: true });
        }

        // Create new conversation
        const conversation = await base44.asServiceRole.entities.Conversation.create({
            participant_ids: [from_player_id, to_player_id],
            participant_usernames: [fromPlayer.username, toPlayer.username],
            last_message: null,
            last_message_at: new Date().toISOString(),
            last_message_sender_id: null
        });

        return Response.json({ success: true, conversation, is_existing: false });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});