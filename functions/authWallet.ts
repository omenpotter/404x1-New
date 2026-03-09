import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

Deno.serve(async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  try {
    const body = await req.json();
    const payload = body.data || body;

    const wallet_address = payload.wallet_address;
    const username = payload.username;

    if (!wallet_address) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "wallet_address required",
        }),
        { status: 200, headers }
      );
    }

    const base44 = createClientFromRequest(req);

    // search existing wallet
    const players = await base44.asServiceRole.entities.Player.list();

    const existing = players.find(
      (p) => p.wallet_address === wallet_address
    );

    if (existing) {
      await base44.asServiceRole.entities.Player.update(existing.id, {
        last_seen: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          existing: true,
          user: existing,
        }),
        { status: 200, headers }
      );
    }

    // wallet new → ask username
    if (!username) {
      return new Response(
        JSON.stringify({
          success: true,
          existing: false,
          needs_username: true,
        }),
        { status: 200, headers }
      );
    }

    if (username.length < 3 || username.length > 16) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Username must be 3-16 characters",
        }),
        { status: 200, headers }
      );
    }

    const taken = players.find(
      (p) =>
        p.username &&
        p.username.toLowerCase() === username.toLowerCase()
    );

    if (taken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Username already taken",
        }),
        { status: 200, headers }
      );
    }

    const player = await base44.asServiceRole.entities.Player.create({
      wallet_address,
      username,
      reputation_points: 0,
      total_score: 0,
      games_played: 0,
      user_role: "member",
      last_seen: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        existing: false,
        user: player,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 200, headers }
    );
  }
});
