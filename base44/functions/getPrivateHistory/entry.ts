import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { getSessionPlayer } from '../../shared/session.ts';
import { normalizeImageUrl } from '../../shared/images.ts';

const MAX_PAGE = 200;

Deno.serve(async (req) => {
    try {
        const body = await req.json();
        const { conversation_id, session_token, before } = body;
        const requested = parseInt(body.limit);
        const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : MAX_PAGE, 1), MAX_PAGE);

        if (!conversation_id) {
            return Response.json({ error: 'conversation_id is required' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Caller is the authenticated player — never trust client-supplied player_id.
        const caller = await getSessionPlayer(base44, session_token);
        if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const conversation = await base44.asServiceRole.entities.Conversation.get(conversation_id);
        if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

        if (!conversation.participant_ids.includes(caller.id)) {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }

        // Read backwards from the newest message, then reverse for display. The previous version
        // loaded the OLDEST 200 rows and paged into them, so a thread longer than 200 messages
        // never showed either participant anything recent. `before` walks further back.
        const query: Record<string, unknown> = { conversation_id, is_deleted: false };
        if (typeof before === 'string' && before) query.created_date = { $lt: before };

        const rows = (await base44.asServiceRole.entities.PrivateMessage.filter(
            query,
            '-created_date',
            limit
        )) || [];

        const page = [...rows].reverse();

        // Delivery is recorded with one atomic $addToSet rather than a read-modify-write per
        // message, so two readers arriving together cannot overwrite each other's receipt.
        const undeliveredIds = page
            .filter(m => m.sender_id !== caller.id && !(m.delivered_to || []).includes(caller.id))
            .map(m => m.id);

        if (undeliveredIds.length) {
            await base44.asServiceRole.entities.PrivateMessage.updateMany(
                { id: { $in: undeliveredIds } },
                { $addToSet: { delivered_to: caller.id } }
            );
        }

        let total = page.length;
        try {
            total = await base44.asServiceRole.entities.PrivateMessage.count({ conversation_id, is_deleted: false });
        } catch { /* a count failure never blocks the page itself */ }

        return Response.json({
            success: true,
            // Message images are re-checked on the way out too, so a row written before
            // the upload policy existed cannot make a reader's browser call a third party.
            messages: page.map(m => ({ ...m, image_url: normalizeImageUrl(m.image_url) })),
            total,
            has_more: rows.length === limit,
            next_before: page.length ? page[0].created_date : null,
            conversation
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});