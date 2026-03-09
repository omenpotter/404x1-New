import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { status: 405, headers });
    }

    try {
        const body = await req.json();
        const { wallet_address, wallet_type, signature, username } = body;

        if (!wallet_address) {
            return new Response(JSON.stringify({ success: false, error: 'wallet_address is required' }), { status: 400, headers });
        }

        // ────────────────────────────────────────────────
        // 1. Verify signature (critical security step)
        // ────────────────────────────────────────────────
        // You MUST implement this — example placeholders:
        let isValidSignature = false;

        if (wallet_type === 'metamask') {
            // Use ethers.js or similar to verify eth personal_sign
            // isValidSignature = verifyEthSignature(wallet_address, signature, message);
        } else {
            // Solana-style (ed25519) verification for x1/phantom/backpack
            // isValidSignature = verifySolanaSignature(wallet_address, signature, message);
        }

        if (!isValidSignature) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid signature' }), { status: 401, headers });
        }

        const base44 = createClientFromRequest(req);

        // ────────────────────────────────────────────────
        // 2. Find existing player — fetch ALL (or use proper query)
        // ────────────────────────────────────────────────
        // Option A: If you expect < 5000 users — fetch more
        // Option B (recommended): Use .findFirst() with filter (if Base44 supports it)

        // Best: if Base44 allows filtering by field
        let existingPlayer = await base44.asServiceRole.entities.Player.findFirst({
            filter: { wallet_address: { eq: wallet_address } } // case-sensitive
            // or { wallet_address: { ilike: wallet_address } } if case-insensitive supported
        });

        // Fallback: list + find (only if no filter support)
        if (!existingPlayer) {
            const allPlayers = await base44.asServiceRole.entities.Player.list(null, 5000); // increase limit
            existingPlayer = allPlayers.find(p => 
                p.wallet_address?.toLowerCase() === wallet_address.toLowerCase()
            );
        }

        if (existingPlayer) {
            // Existing user — return data + update last_seen
            const updated = await base44.asServiceRole.entities.Player.update(existingPlayer.id, {
                last_seen: new Date().toISOString()
            });

            return new Response(JSON.stringify({
                success: true,
                is_new_user: false,          // ← critical: tell frontend it's existing
                user: {
                    id: updated.id,
                    wallet_address: updated.wallet_address,
                    username: updated.username,
                    reputation_points: updated.reputation_points,
                    total_score: updated.total_score,
                    games_played: updated.games_played,
                    user_role: updated.user_role
                }
            }), { status: 200, headers });
        }

        // ────────────────────────────────────────────────
        // New user — require username
        // ────────────────────────────────────────────────
        if (!username) {
            return new Response(JSON.stringify({
                success: true,
                is_new_user: true           // ← tell frontend to show modal
            }), { status: 200, headers });
        }

        // Username validations
        if (username.length < 3 || username.length > 16) {
            return new Response(JSON.stringify({ success: false, error: 'Username must be 3-16 characters' }), { status: 400, headers });
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return new Response(JSON.stringify({ success: false, error: 'Username can only contain letters, numbers, and underscores' }), { status: 400, headers });
        }

        // Check uniqueness (case-insensitive)
        const taken = await base44.asServiceRole.entities.Player.findFirst({
            filter: { username: { ilike: username } } // if supported, else use list + find
        });
        if (taken) {
            return new Response(JSON.stringify({ success: false, error: 'Username already taken. Please choose another.' }), { status: 400, headers });
        }

        // Create
        const newPlayer = await base44.asServiceRole.entities.Player.create({
            wallet_address,
            username,
            reputation_points: 0,
            total_score: 0,
            games_played: 0,
            user_role: 'member',
            last_seen: new Date().toISOString(),
            // bio: null, is_muted: false, etc. — defaults are fine
        });

        return new Response(JSON.stringify({
            success: true,
            is_new_user: false,
            user: {
                id: newPlayer.id,
                wallet_address: newPlayer.wallet_address,
                username: newPlayer.username,
                reputation_points: newPlayer.reputation_points,
                total_score: newPlayer.total_score,
                games_played: newPlayer.games_played,
                user_role: newPlayer.user_role
            }
        }), { status: 200, headers });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Server error' }), { status: 500, headers });
    }
});
