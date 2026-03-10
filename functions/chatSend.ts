import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const COOLDOWN_MS = 3000;          // 3 seconds between messages
const DAILY_MSG_RP_CAP = 200;      // max RP from messages per day

Deno.serve(async (req) => {
    try {
        const { 
            message, 
            reply_to_message_id, 
            reply_to_username,
            reply_to_message,
            image_url 
        } = await req.json();

        if (!message) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (message.length > 5000) {
            return Response.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Wallet auth: user_id comes from payload (no Base44 session)
        const body2 = { message, reply_to_message_id, reply_to_username, reply_to_message, image_url };
        const { user_id: uid } = await req.json().catch(() => ({}));
        // user_id is already destructured from the first req.json() call above
        // We need to get it from the already-parsed body — re-read from parsed fields
        // Actually user_id was not in the destructured list — get it separately

        const player = await base44.asServiceRole.entities.Player.get(user_id);
        if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

        // Check if muted
        if (player.is_muted) {
            if (player.muted_until && new Date() < new Date(player.muted_until)) {
                const muteEnd = new Date(player.muted_until).toLocaleString();
                return Response.json({ success: false, error: `You are muted until ${muteEnd}` }, { status: 403 });
            } else {
                await base44.asServiceRole.entities.Player.update(user_id, {
                    is_muted: false, muted_until: null, muted_by: null
                });
            }
        }

        // Rate limit: 3s cooldown
        const now = Date.now();
        const lastMsg = player.last_message_at ? new Date(player.last_message_at).getTime() : 0;
        if (now - lastMsg < COOLDOWN_MS) {
            return Response.json({ error: 'Slow down — 3 second cooldown between messages' }, { status: 429 });
        }

        // Daily RP cap from messages
        const today = new Date().toISOString().slice(0, 10);
        const sameDay = player.daily_rp_date === today;
        const dailyMsgRp = sameDay ? (player.daily_rp_messages || 0) : 0;

        const is_reply = !!reply_to_message_id;
        const has_image = !!image_url;
        
        let rp_earned = 0;
        if (dailyMsgRp < DAILY_MSG_RP_CAP) {
            rp_earned = has_image ? 3 : 2;
            // Don't exceed cap
            rp_earned = Math.min(rp_earned, DAILY_MSG_RP_CAP - dailyMsgRp);
        }

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

        await base44.asServiceRole.entities.Player.update(user_id, {
            reputation_points: player.reputation_points + rp_earned,
            messages_sent: (player.messages_sent || 0) + 1,
            last_seen: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
            daily_rp_date: today,
            daily_rp_messages: dailyMsgRp + rp_earned
        });

        return Response.json({ success: true, message: newMessage, rp_earned });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});