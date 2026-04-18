import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const RESERVED_USERNAMES = [
    'admin','mod','moderator','superuser','system','bot','staff',
    '404x1','x1','owner','root','support','help','official','null','undefined'
];

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
        const payload = body.data || body;
        const wallet_address = payload.wallet_address;
        const username = payload.username;

        if (!wallet_address) {
            return new Response(JSON.stringify({ success: false, error: 'wallet_address is required' }), { status: 200, headers });
        }

        const base44 = createClientFromRequest(req);

        // O(1) indexed lookup — works at any user count, no list+find collapse
        const existingPlayers = await base44.asServiceRole.entities.Player.filter({ wallet_address }, null, 1);
        const existing = existingPlayers.length > 0 ? existingPlayers[0] : null;

        if (existing) {
            // Best-effort last_seen update — ignore errors (RLS may block without auth context)
            base44.asServiceRole.entities.Player.update(existing.id, {
                last_seen: new Date().toISOString()
            }).catch(() => {});

            return new Response(JSON.stringify({
                success: true,
                user: {
                    id: existing.id,
                    wallet_address: existing.wallet_address,
                    username: existing.username,
                    reputation_points: existing.reputation_points,
                    total_score: existing.total_score,
                    games_played: existing.games_played,
                    user_role: existing.user_role
                }
            }), { status: 200, headers });
        }

        // New wallet — needs username
        if (!username) {
            return new Response(JSON.stringify({ success: false, needs_username: true }), { status: 200, headers });
        }

        // Validate username format
        if (username.length < 3 || username.length > 16) {
            return new Response(JSON.stringify({ success: false, error: 'Username must be 3-16 characters' }), { status: 200, headers });
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return new Response(JSON.stringify({ success: false, error: 'Username can only contain letters, numbers, and underscores' }), { status: 200, headers });
        }

        // Block reserved usernames
        if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
            return new Response(JSON.stringify({ success: false, error: 'This username is reserved. Please choose another.' }), { status: 200, headers });
        }

        // Check username taken
        const takenPlayers = await base44.asServiceRole.entities.Player.filter({ username }, null, 1);
        const taken = takenPlayers.find(p => p.wallet_address !== wallet_address);
        if (taken) {
            return new Response(JSON.stringify({ success: false, error: 'Username already taken. Please choose another.' }), { status: 200, headers });
        }

        let p;
        try {
            p = await base44.asServiceRole.entities.Player.create({
                wallet_address,
                username,
                reputation_points: 0,
                total_score: 0,
                games_played: 0,
                user_role: 'member',
                last_seen: new Date().toISOString()
            });
        } catch (createErr) {
            // Catches race condition where two requests pass the uniqueness check simultaneously
            return new Response(JSON.stringify({ success: false, error: 'Username already taken. Please choose another.' }), { status: 200, headers });
        }

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