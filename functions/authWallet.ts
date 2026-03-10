import { base44 } from "@base44/sdk";

export default async function authWallet(req, res) {

  const { wallet_address, username } = req.body;

  if (!wallet_address) {
    return res.json({ success:false, error:"WALLET_REQUIRED" });
  }

  try {

    const existing = await base44.db.players.findFirst({
      where: { wallet_address }
    });

    // EXISTING USER
    if (existing && !username) {

      return res.json({
        success: true,
        user: existing
      });

    }

    // WALLET EXISTS BUT USERNAME ATTEMPT
    if (existing && username) {

      return res.json({
        success:false,
        error:"WALLET_ALREADY_REGISTERED"
      });

    }

    // NEW USER – NEED USERNAME
    if (!existing && !username) {

      return res.json({
        needs_username: true
      });

    }

    // CREATE NEW USER
    if (!existing && username) {

      const created = await base44.db.players.create({
        wallet_address,
        username,
        rp: 0
      });

      return res.json({
        success:true,
        user: created
      });

    }

  } catch (err) {

    console.error(err);

    return res.json({
      success:false,
      error:"SERVER_ERROR"
    });

  }

}
