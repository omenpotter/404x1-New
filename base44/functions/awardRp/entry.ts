import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { getSessionPlayer } from '../../shared/session.ts';

// Superuser grants are bounded: an unbounded value (or a NaN from a missing field) would
// corrupt the balance it is written into, and a mistyped amount is unrecoverable by hand.
const MAX_GRANT = 1_000_000;

Deno.serve(async (req) => {
    try {
        const body = await req.json();
        const { session_token, to_player_id, reason, grant_type } = body;

        if (!to_player_id || body.amount === undefined || body.amount === null) {
            return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const amount = Number(body.amount);
        if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > MAX_GRANT) {
            return Response.json({
                success: false,
                error: `amount must be a whole number between -${MAX_GRANT} and ${MAX_GRANT}`
            }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Identify granter from session — never trust client-supplied from_player_id.
        const granter = await getSessionPlayer(base44, session_token);
        if (!granter || granter.user_role !== 'superuser') {
            return Response.json({ success: false, error: 'Only superuser can award RP' }, { status: 403 });
        }

        if (granter.id === to_player_id) {
            return Response.json({ success: false, error: 'Cannot award RP to yourself' }, { status: 400 });
        }

        const recipient = await base44.asServiceRole.entities.Player.get(to_player_id);
        if (!recipient) {
            return Response.json({ success: false, error: 'Recipient not found' }, { status: 404 });
        }

        // Applied as an increment, not as a balance read then written back: a concurrent
        // award or game reward on the same player would otherwise be overwritten.
        await base44.asServiceRole.entities.Player.updateMany(
            { id: to_player_id },
            { $inc: { reputation_points: amount } }
        );

        const updated = await base44.asServiceRole.entities.Player.get(to_player_id);

        await base44.asServiceRole.entities.RpGrant.create({
            from_player_id: granter.id,
            from_username: granter.username,
            to_player_id,
            to_username: recipient.username,
            amount,
            grant_type: grant_type || 'manual_award',
            reason: reason || null
        });

        return Response.json({ success: true, amount_awarded: amount, new_rp_total: updated?.reputation_points ?? null });

    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
});