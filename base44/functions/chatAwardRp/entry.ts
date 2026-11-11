import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getSessionPlayer } from '../../shared/session.ts';

Deno.serve(async (req) => {
    try {
        const { session_token, to_user_id, amount, reason } = await req.json();

        if (!to_user_id || !amount) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // amount is client-supplied — coerce it to a real integer before any arithmetic,
        // otherwise number + string would concatenate and corrupt the recipient's balance.
        const amt = Number(amount);
        if (!Number.isInteger(amt) || amt < 1 || amt > 10) {
            return Response.json({ error: 'RP amount must be between 1 and 10' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Sender is the authenticated caller — never trust client-supplied from_user_id.
        const fromPlayer = await getSessionPlayer(base44, session_token);
        if (!fromPlayer) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (fromPlayer.id === to_user_id) {
            return Response.json({ error: 'Cannot award RP to yourself' }, { status: 400 });
        }

        const toPlayer = await base44.asServiceRole.entities.Player.get(to_user_id);
        if (!toPlayer) {
            return Response.json({ error: 'Player not found' }, { status: 404 });
        }

        if (fromPlayer.reputation_points < amt) {
            return Response.json({ error: 'Insufficient RP to award' }, { status: 400 });
        }

        await base44.asServiceRole.entities.RpAward.create({
            from_player_id: fromPlayer.id,
            to_player_id: to_user_id,
            amount: amt,
            reason: reason || 'No reason provided'
        });

        await base44.asServiceRole.entities.Player.update(fromPlayer.id, {
            reputation_points: (Number(fromPlayer.reputation_points) || 0) - amt
        });

        await base44.asServiceRole.entities.Player.update(to_user_id, {
            reputation_points: (Number(toPlayer.reputation_points) || 0) + amt
        });

        const updatedToPlayer = await base44.asServiceRole.entities.Player.get(to_user_id);
        if (updatedToPlayer.reputation_points >= 10000 && updatedToPlayer.user_role === 'member') {
            await base44.asServiceRole.entities.Player.update(to_user_id, {
                user_role: 'trusted'
            });
        }

        return Response.json({
            success: true,
            message: 'RP awarded successfully'
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});