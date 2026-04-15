import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

async function sendTelegram(text) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
    });
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Snapshot before agent runs
        const before = await base44.asServiceRole.entities.ModerationLog.list('-created_date', 100);
        const beforeIds = new Set(before.map(e => e.id));

        // Create a fresh conversation with the admin agent
        const conversation = await base44.asServiceRole.agents.createConversation({
            agent_name: 'chat_admin',
            metadata: { name: 'Auto Admin Review Run', type: 'scheduled' }
        });

        // Tell the agent to check for unreviewed escalations
        await base44.asServiceRole.agents.addMessage(conversation, {
            role: 'user',
            content: 'Check the ModerationLog entity for any entries where escalated is true AND escalated_to is "admin" AND already_reviewed is NOT true. Review each one, take appropriate action (extend mutes, apply permanent bans where required, escalate to superuser if needed), then mark each handled entry as already_reviewed: true. Act now.'
        });

        // Wait briefly for agent to complete actions
        await new Promise(r => setTimeout(r, 15000));

        const after = await base44.asServiceRole.entities.ModerationLog.list('-created_date', 100);
        const newEntries = after.filter(e => !beforeIds.has(e.id));

        // Send Telegram alerts for serious new entries
        for (const entry of newEntries) {
            const isSerious = (entry.escalated_to === 'superuser') ||
                entry.action_type === 'permanent_ban' ||
                (entry.reason || '').toLowerCase().includes('doxx');

            if (!isSerious) continue;

            const time = new Date().toISOString();

            if ((entry.reason || '').toLowerCase().includes('doxx')) {
                await sendTelegram(
`🚨🚨 <b>URGENT — DOXXING INCIDENT</b>

User: ${entry.target_username}
Message deleted: yes
Permanent ban applied: yes
Superuser review required immediately

Time: ${time}`
                );
            } else if (entry.action_type === 'permanent_ban') {
                await sendTelegram(
`🔴🔴 <b>PERMANENT BAN APPLIED</b>

User: ${entry.target_username}
Reason: ${entry.reason || 'N/A'}
Banned by: Chat Admin Agent
Superuser action required: Review and confirm or reverse this ban

Time: ${time}`
                );
            } else if (entry.escalated_to === 'superuser') {
                await sendTelegram(
`🔴 <b>ADMIN ESCALATION</b>

Agent: Chat Admin
Action: ${entry.action_type || 'N/A'}
User: ${entry.target_username}
Reason: ${entry.escalation_reason || entry.reason || 'N/A'}
Requires superuser review: ${entry.requires_unban_review ? 'yes' : 'no'}

Time: ${time}`
                );
            }
        }

        // Alert: suspicious RP accumulation — players with very high RP earned recently
        const allPlayers = await base44.asServiceRole.entities.Player.list('-reputation_points', 50);
        const suspiciousRp = allPlayers.filter(p => (p.daily_rp_messages || 0) + (p.daily_rp_reactions || 0) > 500);
        if (suspiciousRp.length > 0) {
            const lines = suspiciousRp.map(p => `  · ${p.username}: ${(p.daily_rp_messages||0)+(p.daily_rp_reactions||0)} daily RP`).join('\n');
            await sendTelegram(
`🚨 <b>SUSPICIOUS RP ACCUMULATION</b>

${suspiciousRp.length} player(s) earning abnormally high RP today:
${lines}

Possible RP farming — manual review recommended.
Time: ${new Date().toISOString()}`
            );
        }

        // Alert: high concurrent users (active in last 5 min)
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const activePlayers = allPlayers.filter(p => p.last_seen && p.last_seen > fiveMinAgo);
        if (activePlayers.length > 50) {
            await sendTelegram(
`📊 <b>HIGH CONCURRENT USERS</b>

${activePlayers.length} players active in the last 5 minutes
Monitor for performance degradation.

Time: ${new Date().toISOString()}`
            );
        }

        return Response.json({ success: true, conversation_id: conversation.id, new_logs: newEntries.length });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});