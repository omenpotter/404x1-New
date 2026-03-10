import { base44 } from "@base44/sdk";

export default async function authWallet(req, res) {

  try {

    // Get parameters sent from frontend
    const { wallet_address, username } = req.data || {};

    // Wallet address required
    if (!wallet_address) {
      return res.json({
        success: false,
        error: "WALLET_REQUIRED"
      });
    }

    // Find existing player
    const players = await base44.entities.Player.filter({
      wallet_address: wallet_address
    });

    const existing = players.length > 0 ? players[0] : null;

    // ----------------------------------------------------
    // EXISTING USER LOGIN
    // ----------------------------------------------------
    if (existing && !username) {

      await base44.entities.Player.update(existing.id, {
        last_seen: new Date().toISOString()
      });

      return res.json({
        success: true,
        user: existing
      });
    }

    // ----------------------------------------------------
    // WALLET EXISTS BUT USERNAME SENT
    // ----------------------------------------------------
    if (existing && username) {
      return res.json({
        success: false,
        error: "WALLET_ALREADY_REGISTERED"
      });
    }

    // ----------------------------------------------------
    // NEW WALLET → NEED USERNAME
    // ----------------------------------------------------
    if (!existing && !username) {
      return res.json({
        needs_username: true
      });
    }

    // ----------------------------------------------------
    // CREATE NEW USER
    // ----------------------------------------------------
    if (!existing && username) {

      const created = await base44.entities.Player.create({
        wallet_address: wallet_address,
        username: username,
        bio: "",
        reputation_points: 0,
        total_score: 0,
        games_played: 0,
        messages_sent: 0,
        user_role: "player",
        is_muted: false,
        muted_until: null,
        muted_by: null,
        is_banned: false,
        banned_by: null,
        banned_reason: null,
        is_typing: false,
        typing_since: null,
        last_seen: new Date().toISOString()
      });

      return res.json({
        success: true,
        user: created
      });
    }

  } catch (error) {

    console.error("AUTH WALLET ERROR:", error);

    return res.json({
      success: false,
      error: "SERVER_ERROR"
    });
  }
}
