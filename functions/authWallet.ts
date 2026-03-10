import { base44 } from "@base44/sdk";

export default async function authWallet(req, res) {

  const { wallet_address, username } = req.data || {};

  if (!wallet_address) {
    return res.json({
      success: false,
      error: "WALLET_REQUIRED"
    });
  }

  try {

    const players = await base44.entities.Player.filter({
      wallet_address: wallet_address
    });

    const existing = players[0];

    // EXISTING USER LOGIN
    if (existing && !username) {

      await base44.entities.Player.update(existing.id, {
        last_seen: new Date().toISOString()
      });

      return res.json({
        success: true,
        user: existing
      });

    }

    // WALLET EXISTS BUT USERNAME PROVIDED
    if (existing && username) {

      return res.json({
        success: false,
        error: "WALLET_ALREADY_REGISTERED"
      });

    }

    // NEW WALLET
    if (!existing && !username) {

      return res.json({
        needs_username: true
      });

    }

    // CREATE NEW USER
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
        is_banned: false,
        is_typing: false,
        last_seen: new Date().toISOString()
      });

      return res.json({
        success: true,
        user: created
      });

    }

  } catch (err) {

    console.error("AUTH WALLET ERROR:", err);

    return res.json({
      success: false,
      error: "SERVER_ERROR"
    });

  }

}
