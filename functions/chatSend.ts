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

        // Get user info
        const user = await base44.asServiceRole.entities.User.get(user_id);
        
        if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        // Create message
        const newMessage = await base44.asServiceRole.entities.Message.create({
            user_id: user_id,
            username: user.username,
            message: message
        });

        // Award 1 RP for sending a message
        await base44.asServiceRole.entities.User.update(user_id, {
            reputation_points: user.reputation_points + 1,
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