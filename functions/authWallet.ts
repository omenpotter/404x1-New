import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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
        const { wallet_address, wallet_type, signature, username } = body;

        console.log('=== authWallet called ===');
        console.log('wallet_address:', wallet_address);
        console.log('username:', username || '[none - checking existence]');

        if (!wallet_address) {
            return new Response(JSON.stringify({ success: false, error: 'wallet_address is required' }), { status: 400, headers });
        }

        const base44 = createClientFromRequest(req);

        // 1. Try efficient filter lookup
        let existingPlayer = null;
        try {
            const filtered = await base44.asServiceRole.entities.Player.filter({ wallet_address });
            if (filtered.length > 0) {
                existingPlayer = filtered[0];
                console.log('Found via filter:', existingPlayer.username || existingPlayer.id);
            }
        } catch (filterErr) {
            console.warn('Filter failed:', filterErr.message);
        }

        // 2. Fallback to list if needed (case-insensitive)
        if (!existingPlayer) {
            const allPlayers = await base44.asServiceRole.entities.Player.list('-created_date', 5000, 0);
            console.log('Fallback list loaded:', allPlayers.length, 'players');
            existingPlayer = allPlayers.find(p =>
                p.wallet_address && p.wallet_address.toLowerCase() === wallet_address.toLowerCase()
            );
            if (existingPlayer) console.log('Found in fallback:', existingPlayer.username);
        }

        // Existing user → auto-login
        if (existingPlayer) {
            console.log('Existing user found - auto-login');
            const updated = await base44.asServiceRole.entities.Player.update(existingPlayer.id, {
                last_seen: new Date().toISOString()
            });
            return new Response(JSON.stringify({
                success: true,
                is_new_user: false,
                user: {
                    id: updated.id,
                    wallet_address: updated.wallet_address,
                    username: updated.username,
                    reputation_points: updated.reputation_points || 0,
                    total_score: updated.total_score || 0,
                    games_played: updated.games_played || 0,
                    user_role: updated.user_role || 'member'
                }
            }), { status: 200, headers });
        }

        // New user logic
        if (!username) {
            // First call - no username yet → show modal
            console.log('No username provided - returning is_new_user: true');
            return new Response(JSON.stringify({
                success: true,
                is_new_user: true
            }), { status: 200, headers });
        }

        // Username was sent → validate & create
        if (username.length < 3 || username.length > 16) {
            return new Response(JSON.stringify({ success: false, error: 'Username must be 3-16 characters' }), { status: 400, headers });
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return new Response(JSON.stringify({ success: false, error: 'Username can only contain letters, numbers, and underscores' }), { status: 400, headers });
        }

        // Check uniqueness
        let isTaken = false;
        try {
            const taken = await base44.asServiceRole.entities.Player.filter({ username });
            isTaken = taken.length > 0;
        } catch {
            const all = await base44.asServiceRole.entities.Player.list(null, 5000, 0);
            isTaken = all.some(p => p.username?.toLowerCase() === username.toLowerCase());
        }

        if (isTaken) {
            return new Response(JSON.stringify({ success: false, error: 'Username already taken' }), { status: 400, headers });
        }

        // Create new player
        const newPlayer = await base44.asServiceRole.entities.Player.create({
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
            is_new_user: false,
            user: {
                id: newPlayer.id,
                wallet_address: newPlayer.wallet_address,
                username: newPlayer.username,
                reputation_points: 0,
                total_score: 0,
                games_played: 0,
                user_role: 'member'
            }
        }), { status: 200, headers });

    } catch (error) {
        console.error('Auth error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Server error' }), { status: 500, headers });
    }
});
