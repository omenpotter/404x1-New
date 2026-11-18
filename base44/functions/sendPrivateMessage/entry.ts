import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getSessionPlayer, isBanned } from '../../shared/session.ts';
import { normalizeImageUrl, isOversizedImage } from '../../shared/images.ts';
import { participantsOf, withUnhiddenFor } from '../../shared/conversations.ts';

Deno.serve(async (req) => {
    try {
        const { conversation_id, content, image_url, session_token } = await req.json();

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
        if (isBanned(sender)) return Response.json({ error: 'Your account is suspended' }, { status: 403 });

        if (sender.is_muted && sender.muted_until && new Date() < new Date(sender.muted_until)) {
            const muteEnd = new Date(sender.muted_until).toLocaleString();
            return Response.json({ error: `You are muted until ${muteEnd}` }, { status: 403 });
        }

        const conversation = await base44.asServiceRole.entities.Conversation.get(conversation_id);
        if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

        if (!conversation.participant_ids.includes(sender.id)) {
            return Response.json({ error: 'You are not a participant in this conversation' }, { status: 403 });
        }

        // Same rule as public chat: only a file this app uploaded may be attached. The
        // message type is derived here too, so a client cannot label its own message
        // "system" and slip a fabricated notice into the thread.
        let attachedImage: string | null = null;
        if (image_url) {
            attachedImage = normalizeImageUrl(image_url);
            if (!attachedImage) {
                return Response.json({ error: 'External image links are not allowed — upload the image instead' }, { status: 400 });
            }
            if (await isOversizedImage(attachedImage)) {
                return Response.json({ error: 'Image is too large (max 5 MB)' }, { status: 400 });
            }
        }
        const messageType = attachedImage ? 'image' : 'text';

        const message = await base44.asServiceRole.entities.PrivateMessage.create({
            conversation_id,
            sender_id: sender.id,
            sender_username: sender.username,
            content,
            message_type: messageType,
            image_url: attachedImage,
            is_deleted: false,
            is_edited: false,
            delivered_to: [sender.id],
            read_by: [sender.id]
        });

        // A new message brings the thread back for both sides: if either participant had
        // hidden it, the message would otherwise be delivered into a list they cannot see.
        await base44.asServiceRole.entities.Conversation.update(conversation_id, {
            last_message: content.substring(0, 100),
            last_message_at: new Date().toISOString(),
            last_message_sender_id: sender.id,
            hidden_for: withUnhiddenFor(conversation, participantsOf(conversation))
        });

        return Response.json({ success: true, message });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});