import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    try {
        const body = await req.json();
        console.log('Raw body:', JSON.stringify(body));

        // base44.functions.invoke wraps payload in a 'data' key
        const payload = body.data || body;
        const wallet_address = payload.wallet_address;
        const username = payload.username;

        console.log('wallet_address:', wallet_address);
        console.log('username:', username);

        if (!wallet_address) {
            return new Response(JSON.stringify({ success: false, error: 'wallet_address is required' }), { status: 200, headers });
        }

        const base44 = createClientFromRequest(req);

        const existing = await base44.asServiceRole.entities.Player.filter({ wallet_address });
        console.log('Existing count:', existing.length);

        if (existing.length > 0) {
            const p = existing[0];
            await base44.asServiceRole.entities.Player.update(p.id, {
                last_seen: new Date().toISOString()
            });
            return new Response(JSON.stringify({
                success: true,
                user: {
                    id: p.id,
                    wallet_address: p.wallet_address,
                    username: p.username,
                    reputation_points: p.reputation_points,
                    total_score: p.total_score,
                    games_played: p.games_played,
                    user_role: p.user_role
                }
            }), { status: 200, headers });
        }

        if (!username || username.startsWith('temp_check_')) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Username must be 3-16 characters'
            }), { status: 200, headers });
        }

        if (username.length < 3 || username.length > 16) {
            return new Response(JSON.stringify({ success: false, error: 'Username must be 3-16 characters' }), { status: 200, headers });
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return new Response(JSON.stringify({ success: false, error: 'Username can only contain letters, numbers, and underscores' }), { status: 200, headers });
        }

        const taken = await base44.asServiceRole.entities.Player.filter({ username });
        if (taken.length > 0) {
            return new Response(JSON.stringify({ success: false, error: 'Username already taken. Please choose another.' }), { status: 200, headers });
        }

        const p = await base44.asServiceRole.entities.Player.create({
            wallet_address,
            username,
            reputation_points: 0,
            total_score: 0,
            games_played: 0,
            user_role: 'member',
            last_seen: new Date().toISOString()
        });

        return new Response(JSON.stringify({
            success: true,
            user: {
                id: p.id,
                wallet_address: p.wallet_address,
                username: p.username,
                reputation_points: p.reputation_points,
                total_score: p.total_score,
                games_played: p.games_played,
                user_role: p.user_role
            }
        }), { status: 200, headers });

    } catch (error) {
        console.error('authWallet error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Authentication failed' }), { status: 200, headers });
    }
});
