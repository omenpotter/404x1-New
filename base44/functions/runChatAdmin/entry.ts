import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

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
    try {
        const base44 = createClientFromRequest(req);

        const now = new Date();
        const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const cutoff5min = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
        const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

        // 1. Unreviewed escalations in last 24 hours
        const allLogs = await base44.asServiceRole.entities.ModerationLog.list('-created_date', 200);
        const unreviewedEscalations = allLogs.filter(e =>
            e.escalated === true &&
            e.already_reviewed !== true &&
            e.created_date >= cutoff24h
        );

        for (const entry of unreviewedEscalations) {
            await sendTelegram(
`🚨 <b>UNREVIEWED ESCALATION</b>

Moderator: ${entry.moderator_username || 'N/A'}
Target: ${entry.target_username || 'N/A'}
Action: ${entry.action_type || 'N/A'}
Reason: ${entry.reason || entry.escalation_reason || 'N/A'}
Escalated to: ${entry.escalated_to || 'admin'}

Time: ${now.toISOString()}`
            );
        }

        // 2. Suspicious RP: reputation_points > 500 AND daily_rp_date == today AND messages_sent < 20
        const allPlayers = await base44.asServiceRole.entities.Player.list('-reputation_points', 200);
        const suspiciousRpPlayers = allPlayers.filter(p =>
            (p.reputation_points || 0) > 500 &&
            p.daily_rp_date === todayStr &&
            (p.messages_sent || 0) < 20
        );

        for (const p of suspiciousRpPlayers) {
            await sendTelegram(
`🚨 <b>SUSPICIOUS RP ACCUMULATION</b>

Player: ${p.username}
Reputation Points: ${p.reputation_points}
Messages Sent: ${p.messages_sent || 0}
Daily RP Date: ${p.daily_rp_date}

Possible RP farming — manual review recommended.
Time: ${now.toISOString()}`
            );
        }

        // 3. Concurrent users: count players with last_seen within last 5 minutes
        const activePlayers = allPlayers.filter(p => p.last_seen && p.last_seen >= cutoff5min);
        const concurrentUsers = activePlayers.length;

        if (concurrentUsers > 50) {
            await sendTelegram(
`📊 <b>HIGH CONCURRENT USERS</b>

${concurrentUsers} players active in the last 5 minutes.
Monitor for performance degradation.

Time: ${now.toISOString()}`
            );
        }

        return Response.json({
            success: true,
            unreviewed_escalations: unreviewedEscalations.length,
            suspicious_rp_players: suspiciousRpPlayers.length,
            concurrent_users: concurrentUsers
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});