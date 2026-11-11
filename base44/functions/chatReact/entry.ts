import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { getSessionPlayer } from '../../shared/session.ts';

const DAILY_REACTION_RP_CAP = 20;

Deno.serve(async (req) => {
    try {
        const body = await req.json();
        const { message_id, emoji, action } = body;

        if (!message_id || !emoji) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        const reactor = await getSessionPlayer(base44, body.session_token);
        if (!reactor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        const user_id = reactor.id;

        const message = await base44.asServiceRole.entities.Message.get(message_id);
        if (!message) return Response.json({ error: 'Message not found' }, { status: 404 });

        if (message.player_id === user_id) {
            return Response.json({ success: false, error: 'Cannot react to your own message' }, { status: 400 });
        }

        const allReactions = await base44.asServiceRole.entities.Reaction.list(null, 1000);
        const existingReaction = allReactions.find(r => r.message_id === message_id && r.from_player_id === user_id);

        const today = new Date().toISOString().slice(0, 10);
        // Roll the daily counter over first — the guard only matches a date that is not today,
        // so a request that already rolled it is never rewound.
        if (reactor.daily_rp_date !== today) {
            await base44.asServiceRole.entities.Player.updateMany(
                { id: user_id, daily_rp_date: { $ne: today } },
                { $set: { daily_rp_date: today, daily_rp_reactions: 0 } }
            );
        }

        if (existingReaction) {
            if (action === 'remove' || existingReaction.emoji === emoji) {
                await base44.asServiceRole.entities.Reaction.delete(existingReaction.id);
                await base44.asServiceRole.entities.Message.updateMany(
                    { id: message_id, reaction_count: { $gte: 1 } },
                    { $inc: { reaction_count: -1 } }
                );
                // Only deduct from reactor, never grief the author — guarded so it cannot go negative
                await base44.asServiceRole.entities.Player.updateMany(
                    { id: user_id, reputation_points: { $gte: 1 } },
                    { $inc: { reputation_points: -1 } }
                );
                return Response.json({ success: true, action: 'removed', rp_change: -1 });
            } else {
                await base44.asServiceRole.entities.Reaction.update(existingReaction.id, { emoji });
                return Response.json({ success: true, action: 'updated', rp_change: 0 });
            }
        }

        await base44.asServiceRole.entities.Reaction.create({
            message_id,
            from_player_id: user_id,
            from_username: reactor.username,
            to_player_id: message.player_id,
            emoji
        });

        await base44.asServiceRole.entities.Message.updateMany(
            { id: message_id },
            { $inc: { reaction_count: 1 } }
        );

        // The daily cap is enforced by the write condition, so parallel reactions can neither
        // exceed it nor grow a balance from a stale read.
        const reactorClaim = await base44.asServiceRole.entities.Player.updateMany(
            { id: user_id, daily_rp_date: today, daily_rp_reactions: { $lte: DAILY_REACTION_RP_CAP - 1 } },
            { $inc: { reputation_points: 1, daily_rp_reactions: 1 } }
        );
        const reactorRpGain = reactorClaim.updated ? 1 : 0;

        const messageAuthor = await base44.asServiceRole.entities.Player.get(message.player_id);
        let authorRpGain = 0;
        if (messageAuthor) {
            if (messageAuthor.daily_rp_date !== today) {
                await base44.asServiceRole.entities.Player.updateMany(
                    { id: message.player_id, daily_rp_date: { $ne: today } },
                    { $set: { daily_rp_date: today, daily_rp_reactions: 0 } }
                );
            }
            const authorClaim = await base44.asServiceRole.entities.Player.updateMany(
                { id: message.player_id, daily_rp_date: today, daily_rp_reactions: { $lte: DAILY_REACTION_RP_CAP - 1 } },
                { $inc: { reputation_points: 1, daily_rp_reactions: 1 } }
            );
            authorRpGain = authorClaim.updated ? 1 : 0;
        }

        return Response.json({ success: true, action: 'added', rp_earned: { reactor: reactorRpGain, author: authorRpGain } });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});