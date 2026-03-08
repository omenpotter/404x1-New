import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID   = Deno.env.get('TELEGRAM_CHAT_ID');

const REWARDS = {
  moderator: {
    base_active:      100,
    per_delete:        10,
    per_mute:          15,
    per_escalation:    20,
    daily_cap:        500,
  },
  admin: {
    base_active:      200,
    per_delete:        10,
    per_mute:          15,
    per_review:        20,
    per_ban:           25,
    daily_cap:        700,
  },
  superuser: {
    base_active:      300,
    daily_cap:       1000,
  },
};

async function sendTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
      }
    );
  } catch(e) {}
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now       = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const todayLabel = now.toISOString().slice(0, 10);

    // STEP 1: Get all staff
    const allPlayers = await base44.asServiceRole.entities.Player.list('-created_date', 500);
    const staff = allPlayers.filter(p => ['moderator', 'admin', 'superuser'].includes(p.user_role));

    if (staff.length === 0) {
      return Response.json({ success: true, message: 'No staff found', rewarded: [] });
    }

    // STEP 2: Get last 24h ModerationLog entries
    const allLogs   = await base44.asServiceRole.entities.ModerationLog.list('-created_date', 1000);
    const recentLogs = allLogs.filter(l => l.created_date >= yesterday);

    // STEP 3: Calculate + award RP per staff member
    const report = [];

    for (const member of staff) {
      const role = member.user_role;
      const cfg  = REWARDS[role];
      if (!cfg) continue;

      const isActive = member.last_seen && member.last_seen >= yesterday;
      if (!isActive) {
        report.push({ username: member.username, role, rp_awarded: 0, reason: 'Not active in last 24h' });
        continue;
      }

      const myLogs = recentLogs.filter(l => l.moderator_id === member.id);
      let rp = cfg.base_active;
      const breakdown = [`base: +${cfg.base_active}`];

      if (role === 'moderator') {
        const deletes     = myLogs.filter(l => l.action_type === 'delete_message').length;
        const mutes       = myLogs.filter(l => l.action_type === 'mute').length;
        const escalations = myLogs.filter(l => l.escalated === true).length;

        rp += deletes     * cfg.per_delete;
        rp += mutes       * cfg.per_mute;
        rp += escalations * cfg.per_escalation;

        if (deletes)     breakdown.push(`${deletes}× delete: +${deletes * cfg.per_delete}`);
        if (mutes)       breakdown.push(`${mutes}× mute: +${mutes * cfg.per_mute}`);
        if (escalations) breakdown.push(`${escalations}× escalate: +${escalations * cfg.per_escalation}`);
      }

      if (role === 'admin') {
        const deletes = myLogs.filter(l => l.action_type === 'delete_message').length;
        const mutes   = myLogs.filter(l => l.action_type === 'mute').length;
        const reviews = myLogs.filter(l => l.already_reviewed === true).length;
        const bans    = myLogs.filter(l => l.action_type === 'permanent_ban').length;

        rp += deletes * cfg.per_delete;
        rp += mutes   * cfg.per_mute;
        rp += reviews * cfg.per_review;
        rp += bans    * cfg.per_ban;

        if (deletes) breakdown.push(`${deletes}× delete: +${deletes * cfg.per_delete}`);
        if (mutes)   breakdown.push(`${mutes}× mute: +${mutes * cfg.per_mute}`);
        if (reviews) breakdown.push(`${reviews}× review: +${reviews * cfg.per_review}`);
        if (bans)    breakdown.push(`${bans}× ban: +${bans * cfg.per_ban}`);
      }

      // Superuser: flat base_active only
      rp = Math.min(rp, cfg.daily_cap);

      await base44.asServiceRole.entities.Player.update(member.id, {
        reputation_points: (member.reputation_points || 0) + rp
      });

      await base44.asServiceRole.entities.RpGrant.create({
        from_player_id: member.id,
        from_username:  'SYSTEM',
        to_player_id:   member.id,
        to_username:    member.username,
        amount:         rp,
        grant_type:     'daily_staff_reward',
        reason:         `Daily reward ${todayLabel}: ${breakdown.join(' | ')}`
      });

      report.push({
        username:   member.username,
        role,
        rp_awarded: rp,
        actions:    myLogs.length,
        breakdown:  breakdown.join(' | ')
      });
    }

    // STEP 4: Send Telegram daily report
    const active   = report.filter(r => r.rp_awarded > 0);
    const inactive = report.filter(r => r.rp_awarded === 0);
    const roleEmoji = { superuser: '👑', admin: '🔴', moderator: '🟡' };

    const lines = [
      `📊 <b>DAILY STAFF REWARDS — ${todayLabel}</b>`,
      '',
      ...active.map(r =>
        `${roleEmoji[r.role] || '👤'} <b>${r.username}</b> [${r.role.toUpperCase()}]\n` +
        `   +${r.rp_awarded} RP  |  ${r.actions} actions\n` +
        `   ${r.breakdown}`
      ),
    ];

    if (inactive.length > 0) {
      lines.push('');
      lines.push(`😴 Inactive (0 RP): ${inactive.map(r => r.username).join(', ')}`);
    }

    lines.push('');
    lines.push(`Staff: ${staff.length}  |  Rewarded: ${active.length}  |  Inactive: ${inactive.length}`);

    await sendTelegram(lines.join('\n'));

    return Response.json({ success: true, rewarded: report });

  } catch (error) {
    await sendTelegram(`❌ Daily staff rewards error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});