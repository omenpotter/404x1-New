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

        // Force service role context
        const base44 = createClientFromRequest(req).asServiceRole;
        console.log('Service role forced:', !!base44.asServiceRole);

        // Try filter
        let existingPlayer = null;
        try {
            console.log('Trying filter on wallet_address...');
            const filtered = await base44.entities.Player.filter({ wallet_address });
            console.log('Filter returned:', filtered.length, 'records');
            if (filtered.length > 0) {
                existingPlayer = filtered[0];
                console.log('Found via filter:', existingPlayer.username || existingPlayer.id);
            }
        } catch (filterErr) {
            console.error('Filter failed:', filterErr.message);
        }

        // Fallback list
        if (!existingPlayer) {
            console.log('Fallback to full list...');
            const allPlayers = await base44.entities.Player.list('-created_date', 5000, 0);
            console.log('List returned:', allPlayers.length, 'players');
            existingPlayer = allPlayers.find(p =>
                p.wallet_address && p.wallet_address.toLowerCase() === wallet_address.toLowerCase()
            );
            if (existingPlayer) console.log('Found in list:', existingPlayer.username);
        }

        if (existingPlayer) {
            console.log('Existing user found - updating last_seen');
            const updated = await base44.entities.Player.update(existingPlayer.id, {
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

        if (!username) {
            console.log('No username - returning is_new_user: true');
            return new Response(JSON.stringify({
                success: true,
                is_new_user: true
            }), { status: 200, headers });
        }

        // ... rest of create user logic remains the same ...

    } catch (error) {
        console.error('Auth error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Server error' }), { status: 500, headers });
    }
});
