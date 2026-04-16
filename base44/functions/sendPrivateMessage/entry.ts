import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const { conversation_id, content, message_type, image_url, sender_id } = await req.json();

        if (!conversation_id || !content || !sender_id) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (content.length > 2000) {
            return Response.json({ error: 'Message too long (max 2000 characters)' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Get sender
        const sender = await base44.asServiceRole.entities.Player.get(sender_id);
        if (!sender) return Response.json({ error: 'Sender not found' }, { status: 404 });

        // Check mute
        if (sender.is_muted && sender.muted_until && new Date() < new Date(sender.muted_until)) {
            const muteEnd = new Date(sender.muted_until).toLocaleString();
            return Response.json({ error: `You are muted until ${muteEnd}` }, { status: 403 });
        }

        // Verify conversation exists and sender is a participant
        const conversation = await base44.asServiceRole.entities.Conversation.get(conversation_id);
        if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

        if (!conversation.participant_ids.includes(sender_id)) {
            return Response.json({ error: 'You are not a participant in this conversation' }, { status: 403 });
        }

        // Create message
        const message = await base44.asServiceRole.entities.PrivateMessage.create({
            conversation_id,
            sender_id,
            sender_username: sender.username,
            content,
            message_type: message_type || 'text',
            image_url: image_url || null,
            is_deleted: false,
            is_edited: false,
            delivered_to: [sender_id],
            read_by: [sender_id]
        });

        // Update conversation last message
        await base44.asServiceRole.entities.Conversation.update(conversation_id, {
            last_message: content.substring(0, 100),
            last_message_at: new Date().toISOString(),
            last_message_sender_id: sender_id
        });

        return Response.json({ success: true, message });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});