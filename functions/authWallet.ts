import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.20';

// Your personal API key - used as fallback if service role context fails
const FALLBACK_API_KEY = '3089da33589f4ea8806ed64a037262a7';

Deno.serve(async (req) => {
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
        return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { status: 405, headers });
    }

    try {
        const body = await req.json();
        const { wallet_address, wallet_type, signature, username } = body;

        console.log('=== authWallet called (v4 - fixed permissions) ===');
        console.log('wallet_address:', wallet_address);
        console.log('wallet_type:', wallet_type || 'unknown');
        console.log('signature:', signature ? '[present]' : '[missing]');
        console.log('username:', username || '[none - first check / existence lookup]');

        if (!wallet_address) {
            return new Response(JSON.stringify({ success: false, error: 'wallet_address is required' }), { status: 400, headers });
        }

        // 1. Try to get service role from request context
        let base44 = createClientFromRequest(req).asServiceRole;
        let isServiceRole = !!base44.asServiceRole;

        console.log('Service role from request context:', isServiceRole ? 'ACTIVE' : 'NOT ACTIVE');

        // 2. Fallback to hardcoded API key if service role didn't work
        if (!isServiceRole) {
            console.warn('Service role not active - falling back to API key');
            base44 = createClient(FALLBACK_API_KEY);
            console.log('Using fallback API key client');
        }

        // Debug: Confirm we have access
        console.log('Client ready. Trying to access Player table...');

        // Try filter first (fastest)
        let existingPlayer = null;
        try {
            console.log('Trying .filter({ wallet_address })...');
            const filtered = await base44.entities.Player.filter({ wallet_address });
            console.log('Filter result count:', filtered.length);
            if (filtered.length > 0) {
                existingPlayer = filtered[0];
                console.log('Found via filter:', existingPlayer.username || existingPlayer.id);
            }
        } catch (filterErr) {
            console.error('Filter failed:', filterErr.message);
        }

        // Fallback to full list + case-insensitive search
        if (!existingPlayer) {
            console.log('Falling back to .list()...');
            const allPlayers = await base44.entities.Player.list('-created_date', 5000, 0);
            console.log('List result count:', allPlayers.length);

            existingPlayer = allPlayers.find(p =>
                p.wallet_address && p.wallet_address.toLowerCase() === wallet_address.toLowerCase()
            );

            if (existingPlayer) {
                console.log('Found in list fallback:', existingPlayer.username || existingPlayer.id);
            } else {
                console.log('No matching wallet found in database');
            }
        }

        // Existing user → auto-login / update last_seen
        if (existingPlayer) {
            console.log('Existing user detected → updating last_seen');
            const updatedPlayer = await base44.entities.Player.update(existingPlayer.id, {
                last_seen: new Date().toISOString()
            });

            return new Response(JSON.stringify({
                success: true,
                is_new_user: false,
                user: {
                    id: updatedPlayer.id,
                    wallet_address: updatedPlayer.wallet_address,
                    username: updatedPlayer.username,
                    reputation_points: updatedPlayer.reputation_points || 0,
                    total_score: updatedPlayer.total_score || 0,
                    games_played: updatedPlayer.games_played || 0,
                    user_role: updatedPlayer.user_role || 'member'
                }
            }), { status: 200, headers });
        }

        // New wallet
        if (!username) {
            console.log('No username provided → returning is_new_user: true (show modal)');
            return new Response(JSON.stringify({
                success: true,
                is_new_user: true
            }), { status: 200, headers });
        }

        // Username provided → create new player
        console.log('Creating new player with username:', username);

        if (username.length < 3 || username.length > 16) {
            return new Response(JSON.stringify({ success: false, error: 'Username must be 3-16 characters' }), { status: 400, headers });
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return new Response(JSON.stringify({ success: false, error: 'Username can only contain letters, numbers, and underscores' }), { status: 400, headers });
        }

        // Check username uniqueness
        console.log('Checking username uniqueness...');
        let usernameTaken = false;
        try {
            const taken = await base44.entities.Player.filter({ username });
            usernameTaken = taken.length > 0;
        } catch {
            const all = await base44.entities.Player.list(null, 5000, 0);
            usernameTaken = all.some(p => p.username?.toLowerCase() === username.toLowerCase());
        }

        if (usernameTaken) {
            return new Response(JSON.stringify({ success: false, error: 'Username already taken. Please choose another.' }), { status: 400, headers });
        }

        // Create
        const newPlayer = await base44.entities.Player.create({
            wallet_address,
            username,
            reputation_points: 0,
            total_score: 0,
            games_played: 0,
            user_role: 'member',
            last_seen: new Date().toISOString()
        });

        console.log('New player created:', newPlayer.username, newPlayer.id);

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
        console.error('Auth error:', error.message || error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Authentication failed' }), { status: 500, headers });
    }
});
