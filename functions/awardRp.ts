import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const body = await req.json();
        const { to_player_id, amount, reason, grant_type } = body;

        if (!to_player_id || !amount) {
            return Response.json({ success: false, error: 'Missing required fields' });
        }

        const base44 = createClientFromRequest(req);

        // FIXED: get granter from auth session — cannot be spoofed from body
        const authUser = await base44.auth.me();
        if (!authUser) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const granter = await base44.asServiceRole.entities.Player.get(authUser.id);
        if (!granter) {
            return Response.json({ success: false, error: 'Granter not found' });
        }

        if (granter.user_role !== 'superuser') {
            return Response.json({ success: false, error: 'Only superuser can award RP' });
        }

        if (granter.id === to_player_id) {
            return Response.json({ success: false, error: 'Cannot award RP to yourself' });
        }

        const recipient = await base44.asServiceRole.entities.Player.get(to_player_id);
        if (!recipient) {
            return Response.json({ success: false, error: 'Recipient not found' });
        }

        const newRP = recipient.reputation_points + amount;

        await base44.asServiceRole.entities.Player.update(to_player_id, { reputation_points: newRP });

        await base44.asServiceRole.entities.RpGrant.create({
            from_player_id: granter.id,
            from_username: granter.username,
            to_player_id,
            to_username: recipient.username,
            amount,
            grant_type: grant_type || 'manual_award',
            reason: reason || null
        });

        return Response.json({ success: true, amount_awarded: amount, new_rp_total: newRP });

    } catch (err) {
        console.error(err);
        return Response.json({ success: false, error: err.message });
    }
});