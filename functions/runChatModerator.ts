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

// Rule-based detection patterns
const RULES = {
    phishing: {
        patterns: [
            /https?:\/\/[^\s]+/i,                          // any URL
            /verify.*wallet/i,
            /connect.*wallet.*presale/i,
            /claim.*bonus/i,
            /airdrop.*portal/i,
        ],
        keywords: ['wallet-verify', 'airdrop-official', 'presale-x1', 'support-urgent', 'fake-404'],
        action_type: 'delete_message',
        mute_hours: 24,
        escalate: true,
        reason: 'Phishing/scam link detected',
    },
    scam: {
        patterns: [
            /\$\d+\s+into\s+\$[\d,]+/i,
            /guaranteed.*\d+x/i,
            /\d+x\s+guaranteed/i,
            /dm\s+me.*returns/i,
            /dm\s+me.*strategy/i,
            /insider\s+info/i,
            /send\s+\d+\s+sol\s+get/i,
            /whitelist.*paying\s+members/i,
        ],
        action_type: 'delete_message',
        mute_hours: 24,
        escalate: true,
        reason: 'Scam/fraud detected',
    },
    hate_speech: {
        patterns: [
            /brainless\s+people/i,
            /you\s+are\s+all.*idiots/i,
            /get\s+rekt\s+morons/i,
            /complete\s+joke.*community/i,
            /worst\s+community/i,
            /everyone\s+here\s+is\s+a\s+sheep/i,
            /developers\s+are\s+scammers/i,
        ],
        action_type: 'delete_message',
        mute_hours: 24,
        escalate: true,
        reason: 'Hate speech / harassment',
    },
    spam: {
        patterns: [
            /(\b\w+\b)(\s+\1){4,}/i,   // same word repeated 5+ times
            /(.)\1{15,}/,                // same char repeated 15+ times
            /🚀{8,}/,
            /(pump it\s*){3,}/i,
            /(gm\s*){6,}/i,
            /(buy\s*){5,}/i,
            /free\s+tokens.*claim\s+now/i,
        ],
        action_type: 'spam_penalty',
        mute_hours: 1,
        escalate: false,
        reason: 'Spam detected',
    },
    ca_drop: {
        patterns: [
            /\b[A-Za-z0-9]{32,44}\b/,   // solana-style address
        ],
        // Only flag if message has no other context (short messages with just a CA)
        min_length_ratio: 0.7,           // CA chars / total chars > 0.7
        action_type: 'delete_message',
        mute_hours: 0,
        escalate: false,
        reason: 'Raw contract address drop',
    },
};

function detectViolation(message) {
    const content = message.message || '';

    // Phishing: check URLs and keywords
    for (const p of RULES.phishing.patterns) {
        if (p.test(content)) {
            // Check if URL is suspicious (not just any URL)
            const urlMatch = content.match(/https?:\/\/[^\s]+/i);
            if (urlMatch) {
                const url = urlMatch[0].toLowerCase();
                // Legitimate urls (e.g. common sites) - skip
                const safe = ['twitter.com','x.com','dexscreener','birdeye','solscan','phantom','coingecko','coinmarketcap'];
                if (safe.some(s => url.includes(s))) continue;
                return { rule: 'phishing', ...RULES.phishing };
            }
            // Non-URL phishing pattern
            return { rule: 'phishing', ...RULES.phishing };
        }
    }
    for (const kw of RULES.phishing.keywords) {
        if (content.toLowerCase().includes(kw)) {
            return { rule: 'phishing', ...RULES.phishing };
        }
    }

    // Scam
    for (const p of RULES.scam.patterns) {
        if (p.test(content)) return { rule: 'scam', ...RULES.scam };
    }

    // Hate speech
    for (const p of RULES.hate_speech.patterns) {
        if (p.test(content)) return { rule: 'hate_speech', ...RULES.hate_speech };
    }

    // Spam
    for (const p of RULES.spam.patterns) {
        if (p.test(content)) return { rule: 'spam', ...RULES.spam };
    }

    // CA drop - only if message is mostly a CA
    const caMatch = content.match(/\b[A-Za-z0-9]{32,44}\b/);
    if (caMatch) {
        const ratio = caMatch[0].length / content.replace(/\s/g, '').length;
        if (ratio > 0.6) return { rule: 'ca_drop', ...RULES.ca_drop };
    }

    return null;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Fetch recent undeleted messages (last 10 min window + some buffer)
        const allMessages = await base44.asServiceRole.entities.Message.list('-created_date', 100);
        const cutoff = new Date(Date.now() - 15 * 60 * 1000); // last 15 minutes
        const recentMessages = allMessages.filter(m => {
            if (m.is_deleted) return false;
            const created = new Date(m.created_date || m.created_at);
            return created >= cutoff;
        });

        const stats = { scanned: recentMessages.length, deleted: 0, muted: 0, escalated: 0, logs: 0 };
        const escalations = [];

        for (const msg of recentMessages) {
            const violation = detectViolation(msg);
            if (!violation) continue;

            // Delete message
            await base44.asServiceRole.entities.Message.update(msg.id, {
                is_deleted: true,
                deleted_by: '404x1 Chat Moderator AI'
            });
            stats.deleted++;

            // Mute player if needed
            if (violation.mute_hours > 0) {
                const muteUntil = new Date(Date.now() + violation.mute_hours * 60 * 60 * 1000).toISOString();
                await base44.asServiceRole.entities.Player.update(msg.player_id, {
                    is_muted: true,
                    muted_until: muteUntil,
                    muted_by: 'chat_moderator_agent'
                });
                stats.muted++;
            }

            // Write ModerationLog
            await base44.asServiceRole.entities.ModerationLog.create({
                moderator_id: 'chat_moderator_agent',
                moderator_username: '404x1 Chat Moderator AI',
                moderator_role: 'moderator',
                target_player_id: msg.player_id,
                target_username: msg.username,
                action_type: violation.action_type,
                reason: violation.reason,
                message_id: msg.id,
                duration_hours: violation.mute_hours || 0,
                escalated: violation.escalate || false,
                escalated_to: violation.escalate ? 'admin' : undefined,
                escalation_reason: violation.escalate ? `${violation.reason} — message: "${(msg.message || '').slice(0, 100)}"` : undefined,
            });
            stats.logs++;

            if (violation.escalate) {
                stats.escalated++;
                escalations.push({ username: msg.username, rule: violation.rule, reason: violation.reason, message: msg.message });
            }
        }

        // Send Telegram for serious escalations
        if (escalations.length > 0) {
            const lines = escalations.map(e => `  · <b>${e.username}</b>: ${e.rule} — "${(e.message || '').slice(0, 60)}"`).join('\n');
            await sendTelegram(
`🚨 <b>MODERATION ALERT</b>

Scanned: ${stats.scanned} messages
Deleted: ${stats.deleted} | Muted: ${stats.muted} | Escalated: ${stats.escalated}

<b>Escalations:</b>
${lines}

Time: ${new Date().toISOString()}`
            );
        }

        return Response.json({ success: true, stats });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});