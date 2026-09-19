import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import nacl from 'npm:tweetnacl@1.0.3';
import bs58 from 'npm:bs58@4.0.1';
import { ethers } from 'npm:ethers@6.13.4';
import { issueSession } from '../../shared/session.ts';

const RESERVED_USERNAMES = [
    'admin','mod','moderator','superuser','system','bot','staff',
    '404x1','x1','owner','root','support','help','official','null','undefined'
];

// Signatures are valid for 30 minutes — gives users time to pick a username.
const MAX_AGE_MS = 30 * 60 * 1000;

function isEvmAddress(addr: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function hexToBytes(hex: string): Uint8Array {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return bytes;
}

// Verify the wallet-owned signature for `message` matches `address`.
// Solana signatures arrive hex-encoded; EVM signatures are 0x-prefixed hex strings.
function verifySignature(address: string, message: string, signature: string): boolean {
    try {
        if (isEvmAddress(address)) {
            const recovered = ethers.verifyMessage(message, signature);
            return recovered.toLowerCase() === address.toLowerCase();
        }
        // Solana
        const msgBytes = new TextEncoder().encode(message);
        const sigBytes = hexToBytes(signature);
        const pubBytes = bs58.decode(address);
        return nacl.sign.detached.verify(msgBytes, sigBytes, pubBytes);
    } catch (e) {
        return false;
    }
}

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
        const signature = payload.signature;
        const message = payload.message;

        if (!wallet_address) {
            return new Response(JSON.stringify({ success: false, error: 'wallet_address is required' }), { status: 200, headers });
        }

        // Require wallet signature
        if (!signature || !message) {
            return new Response(JSON.stringify({ success: false, error: 'Wallet signature required' }), { status: 200, headers });
        }

        // Validate message freshness
        const tsMatch = String(message).match(/Timestamp: (.+)/);
        if (!tsMatch) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid message format' }), { status: 200, headers });
        }
        const msgTime = new Date(tsMatch[1]).getTime();
        if (isNaN(msgTime) || Math.abs(Date.now() - msgTime) > MAX_AGE_MS) {
            return new Response(JSON.stringify({ success: false, error: 'Signature expired — please reconnect your wallet' }), { status: 200, headers });
        }

        if (!verifySignature(wallet_address, String(message), String(signature))) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid wallet signature' }), { status: 200, headers });
        }

        const base44 = createClientFromRequest(req);

        // O(1) indexed lookup
        const existingPlayers = await base44.asServiceRole.entities.Player.filter({ wallet_address }, null, 1);
        const existing = existingPlayers.length > 0 ? existingPlayers[0] : null;

        if (existing) {
            // Issue a fresh session token on every login
            const session = await issueSession(base44, existing.id);

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
                    user_role: existing.user_role,
                    session_token: session.token
                }
            }), { status: 200, headers });
        }

        // New wallet — needs username
        if (!username) {
            return new Response(JSON.stringify({ success: false, needs_username: true }), { status: 200, headers });
        }

        if (username.length < 3 || username.length > 16) {
            return new Response(JSON.stringify({ success: false, error: 'Username must be 3-16 characters' }), { status: 200, headers });
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return new Response(JSON.stringify({ success: false, error: 'Username can only contain letters, numbers, and underscores' }), { status: 200, headers });
        }

        if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
            return new Response(JSON.stringify({ success: false, error: 'This username is reserved. Please choose another.' }), { status: 200, headers });
        }

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
                last_seen: new Date().toISOString(),
                is_verified: false,
                verification_attempts: 0
            });
        } catch (createErr) {
            return new Response(JSON.stringify({ success: false, error: 'Username already taken. Please choose another.' }), { status: 200, headers });
        }

        const session = await issueSession(base44, p.id);

        return new Response(JSON.stringify({
            success: true,
            user: {
                id: p.id,
                wallet_address: p.wallet_address,
                username: p.username,
                reputation_points: p.reputation_points,
                total_score: p.total_score,
                games_played: p.games_played,
                user_role: p.user_role,
                session_token: session.token
            }
        }), { status: 200, headers });

    } catch (error) {
        console.error('authWallet error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message || 'Authentication failed' }), { status: 200, headers });
    }
});