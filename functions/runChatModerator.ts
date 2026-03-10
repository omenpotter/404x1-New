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

        // Snapshot of recent ModerationLog entries BEFORE agent runs (to detect new ones after)
        const before = await base44.asServiceRole.entities.ModerationLog.list('-created_date', 100);
        const beforeIds = new Set(before.map(e => e.id));

        // Create a fresh conversation with the moderator agent
        const conversation = await base44.asServiceRole.agents.createConversation({
            agent_name: 'chat_moderator',
            metadata: { name: 'Auto Moderation Run', type: 'scheduled' }
        });

        // Tell the agent to review recent messages - be very explicit
        const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // last 10 minutes
        await base44.asServiceRole.agents.addMessage(conversation, {
            role: 'user',
            content: `MODERATION SWEEP — ACT NOW.

Query the Message entity filtered by is_deleted: false, sorted by created_date descending, limit 50.

For EACH message you find, check the content carefully:
- SPAM: repeated words, excessive caps, emoji floods, pump messages → set is_deleted: true on the message, create ModerationLog entry
- SCAM/PHISHING: DM for returns, airdrop scams, fake links, guaranteed profits → set is_deleted: true, mute player (is_muted: true, muted_until: 24h from now), create ModerationLog entry with escalated: true
- HATE SPEECH: insults targeting the community, calling people idiots/morons/brainless → set is_deleted: true, mute player, create ModerationLog entry with escalated: true
- CA DROPS: raw contract addresses with no context → set is_deleted: true, create ModerationLog entry

For every action taken, you MUST create a ModerationLog record with: moderator_id: "chat_moderator_agent", moderator_username: "404x1 Chat Moderator AI", moderator_role: "moderator", target_player_id, target_username, action_type, reason.

Do not skip any violations. Process all messages now and take action.`
        });

        // Wait for agent to complete (agents typically take 60-90s for full scan)
        await new Promise(r => setTimeout(r, 75000));

        const after = await base44.asServiceRole.entities.ModerationLog.list('-created_date', 100);
        const newEntries = after.filter(e => !beforeIds.has(e.id));

        // Only send Telegram for serious events
        for (const entry of newEntries) {
            const isSerious = entry.escalated ||
                entry.action_type === 'permanent_ban' ||
                (entry.reason || '').toLowerCase().includes('doxx') ||
                (entry.reason || '').toLowerCase().includes('scam') ||
                (entry.reason || '').toLowerCase().includes('phish');

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
Banned by: Chat Moderator Agent
Superuser action required: Review and confirm or reverse this ban

Time: ${time}`
                );
            } else if (entry.escalated) {
                await sendTelegram(
`🚨 <b>MODERATION ALERT</b>

Agent: Chat Moderator
Action: ${entry.action_type || 'N/A'}
User: ${entry.target_username}
Reason: ${entry.reason || 'N/A'}
Escalated to admin: yes

Time: ${time}`
                );
            }
        }

        return Response.json({ success: true, conversation_id: conversation.id, new_logs: newEntries.length });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});