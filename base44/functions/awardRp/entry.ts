import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getSessionPlayer } from '../../shared/session.ts';

Deno.serve(async (req) => {
    try {
        const body = await req.json();
        const { session_token, to_player_id, amount, reason, grant_type } = body;

        if (!to_player_id || !amount) {
            return Response.json({ success: false, error: 'Missing required fields' });
        }

        const base44 = createClientFromRequest(req);

        // Identify granter from session — never trust client-supplied from_player_id.
        const granter = await getSessionPlayer(base44, session_token);
        if (!granter || granter.user_role !== 'superuser') {
            return Response.json({ success: false, error: 'Only superuser can award RP' }, { status: 403 });
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
        return Response.json({ success: false, error: err.message });
    }
});