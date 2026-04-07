import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID   = Deno.env.get('TELEGRAM_CHAT_ID');
const ENABLED = Deno.env.get('STRESS_TEST_ENABLED') === 'true';

const BOT_TAG = 'stress_bot';
const TOTAL_BOTS = 100;
const BOTS_PER_WAVE = 15;
const RESPAWN_THRESHOLD = 10;

const ATTACKS = {
  spam: [
    'BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY',
    'FREE TOKENS FREE TOKENS FREE TOKENS CLAIM NOW CLAIM NOW CLAIM NOW',
    '🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀',
    'gm gm gm gm gm gm gm gm gm gm gm gm gm gm gm gm gm gm gm gm',
    'PUMP IT PUMP IT PUMP IT PUMP IT PUMP IT PUMP IT PUMP IT PUMP IT',
  ],
  scam: [
    'DM me for guaranteed 10x returns, limited spots available NOW',
    'I turned $100 into $50,000 in 3 days — DM me for my secret strategy',
    'AIRDROP LIVE: send 1 SOL get 10 SOL back — first 50 only!!',
    'Exclusive whitelist for new X1 project — only paying members, DM for alpha',
    '100x guaranteed next week — insider info from dev team, DM now',
  ],
  hate: [
    'All holders are idiots for buying this garbage token',
    'This community is a complete joke, you are all going to zero',
    'Developers are scammers and everyone here is a sheep',
    'Only brainless people invest in meme tokens like this one',
    'Get rekt morons, this is the worst community on X1',
  ],
  ca_drop: [
    'New gem just launched: AnotherScam111111111111111111111111111 — 100x easy',
    'Better than 404: FakeToken222222222222222222222222222222222 buy now',
    'Buy this instead: PumpAndDump33333333333333333333333333333333333',
    'Real alpha: XYZToken4444444444444444444444444444444444 — dev is based',
    'Gem drop: AbcDeFgHiJkLmNoPqRsTuVwXyZ123456789AAABBBCCC low cap play',
  ],
  phishing: [
    'Claim your 404x1 bonus here: http://fake-404x1-bonus.xyz/claim',
    'Urgent: verify your wallet at http://x1-wallet-verify.net or lose funds',
    'Official 404x1 airdrop portal: http://404x1-airdrop-official.io — hurry',
    'Your wallet has been flagged — fix it at http://x1-support-urgent.com',
    'Exclusive presale access — connect wallet: http://presale-x1-404.xyz',
  ],
  flood: [
    'a', '.', 'x', '1', '?',
  ],
};

const ATTACK_TYPES = Object.keys(ATTACKS);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBotName(i) {
  const adj = ['toxic','spam','bad','fake','evil','scam','bot','junk','void','null'];
  const noun = ['user','actor','node','unit','agent','seed','proc','task','job','run'];
  return `${pick(adj)}_${pick(noun)}_${BOT_TAG}_${i}_${Math.random().toString(36).slice(2,6)}`;
}

function randomWallet(i) {
  const base = 'STRESSTEST' + String(i).padStart(5, '0');
  const pad = Math.random().toString(36).slice(2).toUpperCase().padEnd(32, 'X');
  return (base + pad).slice(0, 44);
}

async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
    });
  } catch(e) {}
}

Deno.serve(async (req) => {
  if (!ENABLED) {
    return Response.json({ skipped: true, reason: 'STRESS_TEST_ENABLED is not true' });
  }

  try {
    const base44 = createClientFromRequest(req);
    const now = new Date().toISOString();
    const stats = { wave: 0, created: 0, sent: 0, banned: 0, active: 0, respawned: false };

    // STEP 1: Get all existing stress bots
    const allPlayers = await base44.asServiceRole.entities.Player.list('-created_date', 500);
    const allBots = allPlayers.filter(p => p.username?.includes(BOT_TAG));
    const activeBots = allBots.filter(p => !p.is_banned);
    const bannedCount = allBots.length - activeBots.length;
    stats.active = activeBots.length;
    stats.banned = bannedCount;

    // STEP 2: Respawn if nearly all banned
    let botsToUse = [...activeBots];

    if (activeBots.length < RESPAWN_THRESHOLD) {
      stats.respawned = true;

      // Retire old bots
      for (const bot of allBots) {
        try {
          await base44.asServiceRole.entities.Player.update(bot.id, {
            username: bot.username + '_retired'
          });
        } catch(e) {}
      }

      // Create fresh batch of 100
      botsToUse = [];
      for (let i = 0; i < TOTAL_BOTS; i++) {
        try {
          const bot = await base44.asServiceRole.entities.Player.create({
            wallet_address: randomWallet(i),
            username: randomBotName(i),
            reputation_points: 0,
            total_score: 0,
            games_played: 0,
            messages_sent: 0,
            user_role: 'member',
            is_muted: false,
            is_banned: false,
            last_seen: now
          });
          botsToUse.push(bot);
          stats.created++;
        } catch(e) {}
      }
    }

    // STEP 3: Pick random bots for this wave
    const shuffled = botsToUse.sort(() => Math.random() - 0.5);
    const wave = shuffled.slice(0, Math.min(BOTS_PER_WAVE, shuffled.length));
    stats.wave = wave.length;

    // STEP 4: Send attack messages
    const waveAttackTypes = [];
    for (const bot of wave) {
      const attackType = pick(ATTACK_TYPES);
      const message = pick(ATTACKS[attackType]);
      waveAttackTypes.push(attackType);
      try {
        await base44.asServiceRole.entities.Message.create({
          player_id: bot.id,
          username: bot.username,
          message: message,
          is_reply: false,
          is_deleted: false,
          is_flagged: false,
          reaction_count: 0
        });

        await base44.asServiceRole.entities.Player.update(bot.id, {
          messages_sent: (bot.messages_sent || 0) + 1,
          last_seen: now
        });

        stats.sent++;
      } catch(e) {}
    }

    // STEP 5: Telegram summary
    const respawnNote = stats.respawned ? `\n🔄 <b>RESPAWNED:</b> Old bots retired, 100 fresh bots created` : '';
    const uniqueTypes = [...new Set(waveAttackTypes)];

    const msg = [
      '🤖 <b>STRESS TEST WAVE</b>',
      `Active bots: ${stats.active} (${stats.banned} banned)`,
      `Wave size: ${stats.wave} bots attacked this run`,
      `Messages sent: ${stats.sent}`,
      respawnNote,
      '',
      '⚔️ Attack types this wave:',
      uniqueTypes.map(t => `  · ${t}`).join('\n'),
      '',
      '👮 Moderator runs every 5min — watching...',
    ].filter(Boolean).join('\n');

    await sendTelegram(msg);

    return Response.json({ success: true, stats });

  } catch(error) {
    await sendTelegram(`❌ Stress test error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});