import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DAILY_REACTION_RP_CAP = 20;  // max RP from reactions per day

Deno.serve(async (req) => {
    try {
        const { message_id, emoji, action } = await req.json();

        if (!message_id || !emoji) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);
        const authUser = await base44.auth.me();
        if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const user_id = authUser.id;

        const reactor = await base44.asServiceRole.entities.Player.get(user_id);
        if (!reactor) return Response.json({ error: 'Player not found' }, { status: 404 });

        const message = await base44.asServiceRole.entities.Message.get(message_id);
        if (!message) return Response.json({ error: 'Message not found' }, { status: 404 });

        // Block self-reaction
        if (message.player_id === user_id) {
            return Response.json({ success: false, error: 'Cannot react to your own message' }, { status: 400 });
        }

        // Check existing reaction (filter by message+user to avoid O(n) list)
        const allReactions = await base44.asServiceRole.entities.Reaction.list(null, 1000);
        const existingReaction = allReactions.find(r => 
            r.message_id === message_id && r.from_player_id === user_id
        );

        // Daily reaction RP tracking
        const today = new Date().toISOString().slice(0, 10);
        const sameDay = reactor.daily_rp_date === today;
        const dailyReactionRp = sameDay ? (reactor.daily_rp_reactions || 0) : 0;
        const reactorCanEarnRp = dailyReactionRp < DAILY_REACTION_RP_CAP;

        if (existingReaction) {
            if (action === 'remove' || existingReaction.emoji === emoji) {
                await base44.asServiceRole.entities.Reaction.delete(existingReaction.id);
                await base44.asServiceRole.entities.Message.update(message_id, {
                    reaction_count: Math.max(0, message.reaction_count - 1)
                });
                // Only deduct RP from reactor — never grief the message author
                await base44.asServiceRole.entities.Player.update(user_id, {
                    reputation_points: Math.max(0, reactor.reputation_points - 1)
                });
                return Response.json({ success: true, action: 'removed', rp_change: -1 });
            } else {
                // Switch emoji — no RP change
                await base44.asServiceRole.entities.Reaction.update(existingReaction.id, { emoji });
                return Response.json({ success: true, action: 'updated', rp_change: 0 });
            }
        }

        // New reaction
        await base44.asServiceRole.entities.Reaction.create({
            message_id,
            from_player_id: user_id,
            from_username: reactor.username,
            to_player_id: message.player_id,
            emoji
        });

        await base44.asServiceRole.entities.Message.update(message_id, {
            reaction_count: message.reaction_count + 1
        });

        // Award RP only if under daily cap
        const reactorRpGain = reactorCanEarnRp ? 1 : 0;
        if (reactorRpGain > 0) {
            await base44.asServiceRole.entities.Player.update(user_id, {
                reputation_points: reactor.reputation_points + 1,
                daily_rp_date: today,
                daily_rp_reactions: dailyReactionRp + 1
            });
        }

        // Award author RP (separate cap check for author)
        const messageAuthor = await base44.asServiceRole.entities.Player.get(message.player_id);
        if (messageAuthor) {
            const authorDay = messageAuthor.daily_rp_date === today;
            const authorDailyReactionRp = authorDay ? (messageAuthor.daily_rp_reactions || 0) : 0;
            if (authorDailyReactionRp < DAILY_REACTION_RP_CAP) {
                await base44.asServiceRole.entities.Player.update(message.player_id, {
                    reputation_points: messageAuthor.reputation_points + 1,
                    daily_rp_date: today,
                    daily_rp_reactions: authorDailyReactionRp + 1
                });
            }
        }

        return Response.json({ success: true, action: 'added', rp_earned: { reactor: reactorRpGain, author: 1 } });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});