import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const { player_id } = await req.json();

        if (!player_id) {
            return Response.json({ error: 'player_id is required' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Fetch all conversations where player is a participant
        const conversations = await base44.asServiceRole.entities.Conversation.filter(
            { participant_ids: { $in: [player_id] } },
            '-last_message_at',
            50
        );

        // Enrich with other_username and other_player_id
        const enriched = conversations.map(conv => {
            const myIdx = (conv.participant_ids || []).indexOf(player_id);
            const otherIdx = myIdx === 0 ? 1 : 0;
            const other_username = (conv.participant_usernames || [])[otherIdx] || 'Unknown';
            const other_player_id = (conv.participant_ids || [])[otherIdx] || null;

            return { ...conv, other_username, other_player_id };
        });

        return Response.json({ success: true, conversations: enriched });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});