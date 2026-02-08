import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const { from_user_id, to_user_id, amount, reason } = await req.json();

        if (!from_user_id || !to_user_id || !amount) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (from_user_id === to_user_id) {
            return Response.json({ error: 'Cannot award RP to yourself' }, { status: 400 });
        }

        if (amount <= 0 || amount > 10) {
            return Response.json({ error: 'RP amount must be between 1 and 10' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Get both users
        const fromUser = await base44.asServiceRole.entities.User.get(from_user_id);
        const toUser = await base44.asServiceRole.entities.User.get(to_user_id);

        if (!fromUser || !toUser) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        // Check if from_user has enough RP to give
        if (fromUser.reputation_points < amount) {
            return Response.json({ error: 'Insufficient RP to award' }, { status: 400 });
        }

        // Create RP award record
        await base44.asServiceRole.entities.RpAward.create({
            from_user_id: from_user_id,
            to_user_id: to_user_id,
            amount: amount,
            reason: reason || 'No reason provided'
        });

        // Update both users' RP
        await base44.asServiceRole.entities.User.update(from_user_id, {
            reputation_points: fromUser.reputation_points - amount
        });

        await base44.asServiceRole.entities.User.update(to_user_id, {
            reputation_points: toUser.reputation_points + amount
        });

        // Check if toUser reached 10,000 RP for trusted role
        const updatedToUser = await base44.asServiceRole.entities.User.get(to_user_id);
        if (updatedToUser.reputation_points >= 10000 && updatedToUser.user_role === 'member') {
            await base44.asServiceRole.entities.User.update(to_user_id, {
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