import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

        console.log('=== authWallet called ===');
        console.log('wallet_address:', wallet_address);
        console.log('wallet_type:', wallet_type);
        console.log('signature present:', !!signature);
        console.log('username:', username || '(none - initial check)');

        if (!wallet_address) {
            return new Response(JSON.stringify({ success: false, error: 'wallet_address is required' }), { status: 400, headers });
        }

        // TODO: Add real signature verification here (critical for security!)
        // Example placeholder:
        // if (!verifySignature(wallet_address, signature, wallet_type)) {
        //     return new Response(JSON.stringify({ success: false, error: 'Invalid signature' }), { status: 401, headers });
        // }

        const base44 = createClientFromRequest(req);

        // ────────────────────────────────────────────────
        // 1. Try efficient filter lookup first
        // ────────────────────────────────────────────────
        console.log('Trying .filter() by wallet_address...');
        let existingPlayer = null;
        try {
            const filtered = await base44.asServiceRole.entities.Player.filter({ wallet_address });
            if (filtered.length > 0) {
                existingPlayer = filtered[0];
                console.log('Found via filter:', existingPlayer.username || existingPlayer.id);
            }
        } catch (filterErr) {
            console.warn('Filter failed (possibly unsupported):', filterErr.message);
        }

        // ────────────────────────────────────────────────
        // 2. Fallback: list + find (case-insensitive)
        // ────────────────────────────────────────────────
        if (!existingPlayer) {
            console.log('Falling back to .list()...');
            const allPlayers = await base44.asServiceRole.entities.Player.list('-created_date', 5000, 0);
            console.log('Total players loaded:', allPlayers.length);

            existingPlayer = allPlayers.find(p =>
                p.wallet_address && p.wallet_address.toLowerCase() === wallet_address.toLowerCase()
            );

            if (existingPlayer) {
                console.log('Found via list fallback:', existingPlayer.username || existingPlayer.id);
            } else {
                console.log('No existing player found');
            }
        }

        // ────────────────────────────────────────────────
        // Existing user → auto-login / refresh last_seen
        // ────────────────────────────────────────────────
        if (existingPlayer) {
            console.log('Updating last_seen for existing user');
            const updatedPlayer = await base44.asServiceRole.entities.Player.update(existingPlayer.id, {
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

        // ────────────────────────────────────────────────
        // No username provided → this is the "check existence" phase
        // ────────────────────────────────────────────────
        if (!username) {
            console.log('No username provided → returning is_new_user: true');
            return new Response(JSON.stringify({
                success: true,
                is_new_user: true
            }), { status: 200, headers });
        }

        // ────────────────────────────────────────────────
        // Username provided → create new player
        // ────────────────────────────────────────────────
        console.log('Creating new player with username:', username);

        if (username.length < 3 || username.length > 16) {
            return new Response(JSON.stringify({ success: false, error: 'Username must be 3-16 characters' }), { status: 400, headers });
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return new Response(JSON.stringify({ success: false, error: 'Username can only contain letters, numbers, and underscores' }), { status: 400, headers });
        }

        // Check username uniqueness (case-insensitive)
        console.log('Checking username uniqueness...');
        let usernameTaken = false;
        try {
            const taken = await base44.asServiceRole.entities.Player.filter({ username });
            usernameTaken = taken.length > 0;
        } catch {
            // Fallback
            const all = await base44.asServiceRole.entities.Player.list(null, 5000, 0);
            usernameTaken = all.some(p => p.username?.toLowerCase() === username.toLowerCase());
        }

        if (usernameTaken) {
            return new Response(JSON.stringify({ success: false, error: 'Username already taken. Please choose another.' }), { status: 400, headers });
        }

        // Create
        console.log('Creating new player...');
        const newPlayer = await base44.asServiceRole.entities.Player.create({
            wallet_address,
            username,
            reputation_points: 0,
            total_score: 0,
            games_played: 0,
            user_role: 'member',
            last_seen: new Date().toISOString()
            // bio, is_muted, etc. → defaults are fine
        });

        console.log('New player created:', newPlayer.id, newPlayer.username);

        return new Response(JSON.stringify({
            success: true,
            is_new_user: false,
            user: {
                id: newPlayer.id,
                wallet_address: newPlayer.wallet_address,
                username: newPlayer.username,
                reputation_points: newPlayer.reputation_points || 0,
                total_score: newPlayer.total_score || 0,
                games_played: newPlayer.games_played || 0,
                user_role: newPlayer.user_role || 'member'
            }
        }), { status: 200, headers });

    } catch (error) {
        console.error('Auth error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Authentication failed' }), { status: 500, headers });
    }
});
