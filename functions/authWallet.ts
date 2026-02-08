import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ethers } from 'npm:ethers@6.13.0';

Deno.serve(async (req) => {
    try {
        const { wallet_address, signature, message, username } = await req.json();

        if (!wallet_address || !signature || !message) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify signature
        const recoveredAddress = ethers.verifyMessage(message, signature);
        
        if (recoveredAddress.toLowerCase() !== wallet_address.toLowerCase()) {
            return Response.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const base44 = createClientFromRequest(req);
        
        // Check if user exists
        const existingUsers = await base44.asServiceRole.entities.User.filter({
            wallet_address: wallet_address.toLowerCase()
        });

        let user;
        
        if (existingUsers.length > 0) {
            // Update last seen
            user = await base44.asServiceRole.entities.User.update(existingUsers[0].id, {
                last_seen: new Date().toISOString()
            });
        } else {
            // Create new user
            if (!username) {
                return Response.json({ error: 'Username required for new users' }, { status: 400 });
            }

            // Check if username is taken
            const usernameCheck = await base44.asServiceRole.entities.User.filter({
                username: username
            });

            if (usernameCheck.length > 0) {
                return Response.json({ error: 'Username already taken' }, { status: 409 });
            }

            user = await base44.asServiceRole.entities.User.create({
                wallet_address: wallet_address.toLowerCase(),
                username: username,
                reputation_points: 0,
                total_score: 0,
                games_played: 0,
                role: 'member',
                last_seen: new Date().toISOString()
            });
        }

        return Response.json({
            success: true,
            user: user
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});