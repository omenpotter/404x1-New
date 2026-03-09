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

        // Validate wallet address
        if (!wallet_address) {
            return new Response(
                JSON.stringify({ success: false, error: 'wallet_address is required' }),
                { status: 400, headers }
            );
        }

        const base44 = createClientFromRequest(req);

        // ✅ STEP 1: CHECK IF WALLET EXISTS FIRST (returning user)
        const existingPlayers = await base44.asServiceRole.entities.Player.filter({
            wallet_address: wallet_address.toLowerCase()
        });

        if (existingPlayers.length > 0) {
            // ✅ STEP 2: Wallet exists - auto-login (ignore username parameter)
            const player = await base44.asServiceRole.entities.Player.update(existingPlayers[0].id, {
                last_seen: new Date().toISOString()
            });

            return new Response(
                JSON.stringify({
                    success: true,
                    user: {
                        id: player.id,
                        wallet_address: player.wallet_address,
                        username: player.username,
                        reputation_points: player.reputation_points,
                        total_score: player.total_score,
                        games_played: player.games_played,
                        user_role: player.user_role
                    }
                }),
                { status: 200, headers }
            );
        }

        // ✅ STEP 3: New wallet - validate username
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

        // ✅ STEP 4: Check username uniqueness
        const usernameCheck = await base44.asServiceRole.entities.Player.filter({
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

        // ✅ STEP 5: Create new player
        const player = await base44.asServiceRole.entities.Player.create({
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
                    id: player.id,
                    wallet_address: player.wallet_address,
                    username: player.username,
                    reputation_points: player.reputation_points,
                    total_score: player.total_score,
                    games_played: player.games_played,
                    user_role: player.user_role
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
