import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.20';

// Your personal API key - used as fallback if request context doesn't provide service role
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

    console.log('=== authWallet v5 - full script started ===');
    console.log('Received wallet_address:', wallet_address);
    console.log('Received username:', username || '[none - existence check]');
    console.log('Received wallet_type:', wallet_type || 'not provided');
    console.log('Signature present:', !!signature);

    if (!wallet_address) {
      console.log('Missing wallet_address - returning 400');
      return new Response(JSON.stringify({ success: false, error: 'wallet_address is required' }), { status: 400, headers });
    }

    // Step 1: Try service role from request context
    let base44;
    let authMethod = 'request_context';

    try {
      base44 = createClientFromRequest(req).asServiceRole;
      console.log('Service role from request context: ACTIVE');
    } catch (e) {
      console.warn('Service role from request failed:', e.message);
      authMethod = 'fallback_api_key';
      console.log('Falling back to hardcoded API key');
      base44 = createClient(FALLBACK_API_KEY);
    }

    // Debug: Confirm we have a working client
    console.log('Auth method used:', authMethod);
    console.log('Client initialized successfully');

    // Step 2: Try fast filter lookup
    let existingPlayer = null;
    try {
      console.log('Step 2: Trying .filter({ wallet_address })...');
      const filtered = await base44.entities.Player.filter({ wallet_address });
      console.log('Filter returned count:', filtered.length);

      if (filtered.length > 0) {
        existingPlayer = filtered[0];
        console.log('Found existing player via filter:', existingPlayer.username || existingPlayer.id);
      }
    } catch (filterErr) {
      console.error('Filter operation failed:', filterErr.message);
    }

    // Step 3: Fallback to full list if filter didn't find anything
    if (!existingPlayer) {
      try {
        console.log('Step 3: Falling back to .list()...');
        const allPlayers = await base44.entities.Player.list('-created_date', 5000, 0);
        console.log('Full list returned count:', allPlayers.length);

        existingPlayer = allPlayers.find(p =>
          p.wallet_address && p.wallet_address.toLowerCase() === wallet_address.toLowerCase()
        );

        if (existingPlayer) {
          console.log('Found existing player in full list:', existingPlayer.username || existingPlayer.id);
        } else {
          console.log('No player found with this wallet address');
        }
      } catch (listErr) {
        console.error('List operation failed:', listErr.message);
      }
    }

    // Step 4: If player exists → auto-login / refresh last_seen
    if (existingPlayer) {
      console.log('Existing player confirmed - updating last_seen');
      try {
        const updatedPlayer = await base44.entities.Player.update(existingPlayer.id, {
          last_seen: new Date().toISOString()
        });
        console.log('Last seen updated successfully');

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
      } catch (updateErr) {
        console.error('Update last_seen failed:', updateErr.message);
        // Still return success even if update fails (non-critical)
        return new Response(JSON.stringify({
          success: true,
          is_new_user: false,
          user: {
            id: existingPlayer.id,
            wallet_address: existingPlayer.wallet_address,
            username: existingPlayer.username,
            reputation_points: existingPlayer.reputation_points || 0,
            total_score: existingPlayer.total_score || 0,
            games_played: existingPlayer.games_played || 0,
            user_role: existingPlayer.user_role || 'member'
          }
        }), { status: 200, headers });
      }
    }

    // Step 5: New wallet
    if (!username) {
      console.log('No username provided - instructing frontend to show username modal');
      return new Response(JSON.stringify({
        success: true,
        is_new_user: true
      }), { status: 200, headers });
    }

    // Step 6: Username provided - create new player
    console.log('Creating new player with username:', username);

    if (username.length < 3 || username.length > 16) {
      return new Response(JSON.stringify({ success: false, error: 'Username must be 3-16 characters' }), { status: 400, headers });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return new Response(JSON.stringify({ success: false, error: 'Username can only contain letters, numbers, and underscores' }), { status: 400, headers });
    }

    // Check username uniqueness
    let isTaken = false;
    try {
      console.log('Checking if username is taken...');
      const taken = await base44.entities.Player.filter({ username });
      isTaken = taken.length > 0;
      console.log('Username taken check (filter):', isTaken);
    } catch (takenErr) {
      console.warn('Username uniqueness filter failed:', takenErr.message);
      // Fallback
      const all = await base44.entities.Player.list(null, 5000, 0);
      isTaken = all.some(p => p.username?.toLowerCase() === username.toLowerCase());
      console.log('Username taken check (fallback list):', isTaken);
    }

    if (isTaken) {
      return new Response(JSON.stringify({ success: false, error: 'Username already taken. Please choose another.' }), { status: 400, headers });
    }

    // Create the player
    console.log('Creating new player...');
    const newPlayer = await base44.entities.Player.create({
      wallet_address,
      username,
      reputation_points: 0,
      total_score: 0,
      games_played: 0,
      user_role: 'member',
      last_seen: new Date().toISOString()
    });

    console.log('New player created successfully:', newPlayer.username, newPlayer.id);

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
    console.error('=== CRITICAL FUNCTION ERROR ===');
    console.error('Error message:', error.message || error);
    console.error('Stack trace:', error.stack || 'No stack available');
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error: ' + (error.message || 'Unknown error')
    }), { status: 500, headers });
  }
});
