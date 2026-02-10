import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const { user_id, message_id, emoji, action } = await req.json();

        if (!user_id || !message_id || !emoji) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Get reactor
        const reactor = await base44.asServiceRole.entities.Player.get(user_id);
        
        if (!reactor) {
            return Response.json({ error: 'Player not found' }, { status: 404 });
        }

        // Get message
        const message = await base44.asServiceRole.entities.Message.get(message_id);
        
        if (!message) {
            return Response.json({ error: 'Message not found' }, { status: 404 });
        }

        // Check if user is reacting to their own message
        if (message.player_id === user_id) {
            return Response.json({ 
                success: false, 
                error: 'Cannot react to your own message' 
            }, { status: 400 });
        }

        // Check if already reacted
        const allReactions = await base44.asServiceRole.entities.Reaction.list(null, 1000);
        const existingReaction = allReactions.find(r => 
            r.message_id === message_id && r.from_player_id === user_id
        );

        if (existingReaction) {
            // Remove reaction if clicking same emoji OR if action is "remove"
            if (action === 'remove' || existingReaction.emoji === emoji) {
                await base44.asServiceRole.entities.Reaction.delete(existingReaction.id);
                
                // Update message reaction count
                await base44.asServiceRole.entities.Message.update(message_id, {
                    reaction_count: Math.max(0, message.reaction_count - 1)
                });
                
                // Remove RP from both users (-1 from reactor, -1 from author)
                await base44.asServiceRole.entities.Player.update(user_id, {
                    reputation_points: reactor.reputation_points - 1
                });
                
                const messageAuthor = await base44.asServiceRole.entities.Player.get(message.player_id);
                if (messageAuthor) {
                    await base44.asServiceRole.entities.Player.update(message.player_id, {
                        reputation_points: messageAuthor.reputation_points - 1
                    });
                }
                
                return Response.json({
                    success: true,
                    action: 'removed',
                    rp_change: -1
                });
            } else {
                // Update to different emoji (no RP change)
                await base44.asServiceRole.entities.Reaction.update(existingReaction.id, {
                    emoji: emoji
                });
                
                return Response.json({
                    success: true,
                    action: 'updated',
                    rp_change: 0
                });
            }
        }

        // Create new reaction
        await base44.asServiceRole.entities.Reaction.create({
            message_id: message_id,
            from_player_id: user_id,
            from_username: reactor.username,
            to_player_id: message.player_id,
            emoji: emoji
        });

        // Update message reaction count
        await base44.asServiceRole.entities.Message.update(message_id, {
            reaction_count: message.reaction_count + 1
        });

        // Award +1 RP to reactor
        await base44.asServiceRole.entities.Player.update(user_id, {
            reputation_points: reactor.reputation_points + 1
        });

        // Award +1 RP to message author
        const messageAuthor = await base44.asServiceRole.entities.Player.get(message.player_id);
        if (messageAuthor) {
            await base44.asServiceRole.entities.Player.update(message.player_id, {
                reputation_points: messageAuthor.reputation_points + 1
            });
        }

        return Response.json({
            success: true,
            action: 'added',
            rp_earned: {
                reactor: 1,
                author: 1
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});