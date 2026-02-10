import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const base44 = createClientFromRequest(req);

        // Get messages (non-deleted, sorted newest first)
        const allMessages = await base44.asServiceRole.entities.Message.list('-created_date', 500);
        
        // Filter out deleted messages
        const messages = allMessages.filter(m => !m.is_deleted);
        
        // Apply pagination
        const paginatedMessages = messages.slice(offset, offset + limit);
        
        // Get message IDs for reactions
        const messageIds = paginatedMessages.map(m => m.id);
        
        // Get all reactions for these messages
        const allReactions = await base44.asServiceRole.entities.Reaction.list(null, 1000);
        const reactions = allReactions.filter(r => messageIds.includes(r.message_id));

        // Count online users (active in last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const allPlayers = await base44.asServiceRole.entities.Player.list(null, 1000);
        const onlineCount = allPlayers.filter(p => p.last_seen && p.last_seen >= fiveMinutesAgo).length;

        return Response.json({
            success: true,
            messages: paginatedMessages.reverse(), // Oldest first
            reactions: reactions,
            online_count: onlineCount,
            total: messages.length
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});