import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });
    if (req.method !== 'POST') return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { status: 405, headers });

    try {
        const body = await req.json();
        const { wallet_address, username } = body;

        console.log('=== authWallet v2 called ===');
        console.log('wallet_address:', wallet_address);
        console.log('username:', username);

        if (!wallet_address) {
            return new Response(JSON.stringify({ success: false, error: 'wallet_address is required' }), { status: 400, headers });
        }

        const base44 = createClientFromRequest(req);

        const allPlayers = await base44.asServiceRole.entities.Player.list(null, 1000);
        console.log('Total players found:', allPlayers.length);

        const existingPlayer = allPlayers.find(p =>
            p.wallet_address && p.wallet_address.toLowerCase() === wallet_address.toLowerCase()
        );

        console.log('Existing player found:', existingPlayer ? existingPlayer.username : 'none');

        if (existingPlayer) {
            const player = await base44.asServiceRole.entities.Player.update(existingPlayer.id, {
                last_seen: new Date().toISOString()
            });
            return new Response(JSON.stringify({
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
            }), { status: 200, headers });
        }

        if (!username) {
            return new Response(JSON.stringify({ success: false, error: 'username is required' }), { status: 400, headers });
        }

        if (username.length < 3 || username.length > 16) {
            return new Response(JSON.stringify({ success: false, error: 'Username must be 3-16 characters' }), { status: 400, headers });
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return new Response(JSON.stringify({ success: false, error: 'Username can only contain letters, numbers, and underscores' }), { status: 400, headers });
        }

        const takenUser = allPlayers.find(p => p.username && p.username.toLowerCase() === username.toLowerCase());
        if (takenUser) {
            return new Response(JSON.stringify({ success: false, error: 'Username already taken. Please choose another.' }), { status: 400, headers });
        }

        const player = await base44.asServiceRole.entities.Player.create({
            wallet_address: wallet_address,
            username: username,
            reputation_points: 0,
            total_score: 0,
            games_played: 0,
            user_role: 'member',
            last_seen: new Date().toISOString()
        });

        return new Response(JSON.stringify({
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
        }), { status: 200, headers });

    } catch (error) {
        console.error('Auth error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Authentication failed' }), { status: 500, headers });
    }
});
