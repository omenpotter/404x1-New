import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const { 
            from_player_id, 
            to_player_id, 
            amount, 
            reason,
            grant_type
        } = await req.json();

        if (!from_player_id || !to_player_id || !amount) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Get granter
        const granter = await base44.asServiceRole.entities.Player.get(from_player_id);

        if (!granter) {
            return Response.json({ error: 'Granter not found' }, { status: 404 });
        }

        // Only superuser can manually award RP
        if (granter.user_role !== 'superuser') {
            return Response.json({ 
                success: false, 
                error: 'Only superuser can manually award RP' 
            }, { status: 403 });
        }

        // Get recipient
        const recipient = await base44.asServiceRole.entities.Player.get(to_player_id);

        if (!recipient) {
            return Response.json({ error: 'Recipient not found' }, { status: 404 });
        }

        // Award RP
        await base44.asServiceRole.entities.Player.update(to_player_id, {
            reputation_points: recipient.reputation_points + amount
        });

        // Log the grant
        await base44.asServiceRole.entities.RpGrant.create({
            from_player_id: from_player_id,
            from_username: granter.username,
            to_player_id: to_player_id,
            to_username: recipient.username,
            amount: amount,
            grant_type: grant_type || 'manual_award',
            reason: reason || null
        });

        return Response.json({
            success: true,
            amount_awarded: amount,
            new_rp_total: recipient.reputation_points + amount,
            grant_type: grant_type || 'manual_award'
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});