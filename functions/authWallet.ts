import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers });
    }

    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ success: false, error: 'Method not allowed' }),
            { status: 405, headers }
        );
    }

    try {
        const { wallet_address, username } = await req.json();

        // Validate inputs
        if (!wallet_address) {
            return new Response(
                JSON.stringify({ success: false, error: 'wallet_address is required' }),
                { status: 400, headers }
            );
        }

        if (!username) {
            return new Response(
                JSON.stringify({ success: false, error: 'username is required' }),
                { status: 400, headers }
            );
        }

        // Validate username length (4-12 characters)
        if (username.length < 4 || username.length > 12) {
            return new Response(
                JSON.stringify({ 
                    success: false, 
                    error: 'Username must be 4-12 characters' 
                }),
                { status: 400, headers }
            );
        }

        // Validate username format (alphanumeric + underscore only)
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return new Response(
                JSON.stringify({ 
                    success: false, 
                    error: 'Username can only contain letters, numbers, and underscores' 
                }),
                { status: 400, headers }
            );
        }

        const base44 = createClientFromRequest(req);

        // Check if wallet already exists
        const existingUsers = await base44.asServiceRole.entities.User.filter({
            wallet_address: wallet_address.toLowerCase()
        });

        let user;

        if (existingUsers.length > 0) {
            // Wallet exists - update last seen and return existing user
            user = await base44.asServiceRole.entities.User.update(existingUsers[0].id, {
                last_seen: new Date().toISOString()
            });

            return new Response(
                JSON.stringify({
                    success: true,
                    user: {
                        id: user.id,
                        wallet_address: user.wallet_address,
                        username: user.username,
                        reputation_points: user.reputation_points,
                        total_score: user.total_score,
                        games_played: user.games_played,
                        user_role: user.user_role
                    }
                }),
                { status: 200, headers }
            );
        }

        // Check if username is taken
        const usernameCheck = await base44.asServiceRole.entities.User.filter({
            username: username
        });

        if (usernameCheck.length > 0) {
            return new Response(
                JSON.stringify({ 
                    success: false, 
                    error: 'Username already taken. Please choose another.' 
                }),
                { status: 400, headers }
            );
        }

        // Create new user
        user = await base44.asServiceRole.entities.User.create({
            wallet_address: wallet_address.toLowerCase(),
            username: username,
            reputation_points: 0,
            total_score: 0,
            games_played: 0,
            user_role: 'member',
            last_seen: new Date().toISOString()
        });

        return new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: user.id,
                    wallet_address: user.wallet_address,
                    username: user.username,
                    reputation_points: user.reputation_points,
                    total_score: user.total_score,
                    games_played: user.games_played,
                    user_role: user.user_role
                }
            }),
            { status: 200, headers }
        );

    } catch (error) {
        console.error('Auth error:', error);
        return new Response(
            JSON.stringify({ 
                success: false, 
                error: error.message || 'Authentication failed' 
            }),
            { status: 500, headers }
        );
    }
});