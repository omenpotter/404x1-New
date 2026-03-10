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

        // Tell the agent to review recent messages
        await base44.asServiceRole.agents.addMessage(conversation, {
            role: 'user',
            content: 'Review the last 50 messages in the Message entity for any rule violations. Check for spam, off-topic content, NSFW, scams, hate speech, doxxing, impersonation, and raw CA drops. Take appropriate action on any violations you find and log everything to ModerationLog. Act now.'
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