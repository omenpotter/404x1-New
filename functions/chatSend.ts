import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const { 
            user_id, 
            message, 
            reply_to_message_id, 
            reply_to_username,
            reply_to_message,
            image_url 
        } = await req.json();

        if (!user_id || !message) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (message.length > 5000) {
            return Response.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Get player info
        const player = await base44.asServiceRole.entities.Player.get(user_id);

        if (!player) {
            return Response.json({ error: 'Player not found' }, { status: 404 });
        }

        // Check if muted
        if (player.is_muted) {
            if (player.muted_until && new Date() < new Date(player.muted_until)) {
                const muteEnd = new Date(player.muted_until).toLocaleString();
                return Response.json({ 
                    success: false, 
                    error: `You are muted until ${muteEnd}` 
                }, { status: 403 });
            } else {
                // Unmute if time has passed
                await base44.asServiceRole.entities.Player.update(user_id, {
                    is_muted: false,
                    muted_until: null,
                    muted_by: null
                });
            }
        }

        // Determine RP reward based on message type
        const is_reply = !!reply_to_message_id;
        const has_image = !!image_url;
        
        let rp_earned = 0;
        if (has_image) {
            rp_earned = 3;  // Image post: +3 RP
        } else if (is_reply) {
            rp_earned = 2;  // Reply: +2 RP
        } else {
            rp_earned = 2;  // New post: +2 RP
        }

        // Create message
        const newMessage = await base44.asServiceRole.entities.Message.create({
            player_id: user_id,
            username: player.username,
            message: message,
            is_reply: is_reply,
            reply_to_message_id: reply_to_message_id || null,
            reply_to_username: reply_to_username || null,
            reply_to_message: reply_to_message || null,
            has_image: has_image,
            image_url: image_url || null,
            is_deleted: false,
            is_flagged: false,
            reaction_count: 0
        });

        // Award RP
        await base44.asServiceRole.entities.Player.update(user_id, {
            reputation_points: player.reputation_points + rp_earned,
            messages_sent: (player.messages_sent || 0) + 1,
            last_seen: new Date().toISOString()
        });

        return Response.json({
            success: true,
            message: newMessage,
            rp_earned: rp_earned
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});