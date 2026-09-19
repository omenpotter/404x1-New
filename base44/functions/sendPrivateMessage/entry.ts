import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getSessionPlayer } from '../../shared/session.ts';

Deno.serve(async (req) => {
    try {
        const { conversation_id, content, message_type, image_url, session_token } = await req.json();

        if (!conversation_id || !content) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (content.length > 2000) {
            return Response.json({ error: 'Message too long (max 2000 characters)' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Sender is the authenticated caller — never trust client-supplied sender_id.
        const sender = await getSessionPlayer(base44, session_token);
        if (!sender) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        if (sender.is_muted && sender.muted_until && new Date() < new Date(sender.muted_until)) {
            const muteEnd = new Date(sender.muted_until).toLocaleString();
            return Response.json({ error: `You are muted until ${muteEnd}` }, { status: 403 });
        }

        const conversation = await base44.asServiceRole.entities.Conversation.get(conversation_id);
        if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

        if (!conversation.participant_ids.includes(sender.id)) {
            return Response.json({ error: 'You are not a participant in this conversation' }, { status: 403 });
        }

        const message = await base44.asServiceRole.entities.PrivateMessage.create({
            conversation_id,
            sender_id: sender.id,
            sender_username: sender.username,
            content,
            message_type: message_type || 'text',
            image_url: image_url || null,
            is_deleted: false,
            is_edited: false,
            delivered_to: [sender.id],
            read_by: [sender.id]
        });

        await base44.asServiceRole.entities.Conversation.update(conversation_id, {
            last_message: content.substring(0, 100),
            last_message_at: new Date().toISOString(),
            last_message_sender_id: sender.id
        });

        return Response.json({ success: true, message });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});