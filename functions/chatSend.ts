import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const { user_id, message } = await req.json();

        if (!user_id || !message) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (message.length > 500) {
            return Response.json({ error: 'Message too long (max 500 characters)' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Get player info
        const player = await base44.asServiceRole.entities.Player.get(user_id);

        if (!player) {
            return Response.json({ error: 'Player not found' }, { status: 404 });
        }

        // Create message
        const newMessage = await base44.asServiceRole.entities.Message.create({
            player_id: user_id,
            username: player.username,
            message: message
        });

        // Award 1 RP for sending a message
        await base44.asServiceRole.entities.Player.update(user_id, {
            reputation_points: player.reputation_points + 1,
            last_seen: new Date().toISOString()
        });

        return Response.json({
            success: true,
            message: newMessage
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});