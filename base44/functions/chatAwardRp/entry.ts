import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const { to_user_id, from_user_id, amount, reason } = await req.json();

        const base44 = createClientFromRequest(req);

        if (!to_user_id || !amount) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (from_user_id === to_user_id) {
            return Response.json({ error: 'Cannot award RP to yourself' }, { status: 400 });
        }

        if (amount <= 0 || amount > 10) {
            return Response.json({ error: 'RP amount must be between 1 and 10' }, { status: 400 });
        }

        // Get both players
        const fromPlayer = await base44.asServiceRole.entities.Player.get(from_user_id);
        const toPlayer = await base44.asServiceRole.entities.Player.get(to_user_id);

        if (!fromPlayer || !toPlayer) {
            return Response.json({ error: 'Player not found' }, { status: 404 });
        }

        // Check if from_player has enough RP to give
        if (fromPlayer.reputation_points < amount) {
            return Response.json({ error: 'Insufficient RP to award' }, { status: 400 });
        }

        // Create RP award record
        await base44.asServiceRole.entities.RpAward.create({
            from_player_id: from_user_id,
            to_player_id: to_user_id,
            amount: amount,
            reason: reason || 'No reason provided'
        });

        // Update both players' RP
        await base44.asServiceRole.entities.Player.update(from_user_id, {
            reputation_points: fromPlayer.reputation_points - amount
        });

        await base44.asServiceRole.entities.Player.update(to_user_id, {
            reputation_points: toPlayer.reputation_points + amount
        });

        // Check if toPlayer reached 10,000 RP for trusted role
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