import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: superuser only' }, { status: 403 });
        }

        const findings = [];
        const now = Date.now();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

        // Fetch data in parallel
        const [players, messages, reactions, conversions] = await Promise.all([
            base44.asServiceRole.entities.Player.list('-created_date', 500),
            base44.asServiceRole.entities.Message.list('-created_date', 500),
            base44.asServiceRole.entities.Reaction.list('-created_date', 500),
            base44.asServiceRole.entities.RpConversion.list('-created_date', 200),
        ]);

        // 1. RP farming — players with abnormally high daily RP
        const rpFarmers = players.filter(p => (p.daily_rp_messages || 0) + (p.daily_rp_reactions || 0) > 400);
        if (rpFarmers.length > 0) {
            findings.push({
                type: 'rp_farming',
                severity: 'high',
                count: rpFarmers.length,
                details: rpFarmers.map(p => `${p.username} (${(p.daily_rp_messages||0)+(p.daily_rp_reactions||0)} daily RP)`)
            });
        }

        // 2. Duplicate usernames
        const usernameCounts = {};
        for (const p of players) {
            const key = (p.username || '').toLowerCase();
            usernameCounts[key] = (usernameCounts[key] || 0) + 1;
        }
        const dupUsernames = Object.entries(usernameCounts).filter(([, c]) => c > 1).map(([k]) => k);
        if (dupUsernames.length > 0) {
            findings.push({ type: 'duplicate_usernames', severity: 'medium', count: dupUsernames.length, details: dupUsernames });
        }

        // 3. Duplicate wallet addresses
        const walletCounts = {};
        for (const p of players) {
            const key = (p.wallet_address || '').toLowerCase();
            walletCounts[key] = (walletCounts[key] || 0) + 1;
        }
        const dupWallets = Object.entries(walletCounts).filter(([, c]) => c > 1).map(([k]) => k);
        if (dupWallets.length > 0) {
            findings.push({ type: 'duplicate_wallets', severity: 'critical', count: dupWallets.length, details: dupWallets });
        }

        // 4. Banned/muted players still posting messages
        const bannedIds = new Set(players.filter(p => p.is_banned).map(p => p.id));
        const mutedIds = new Set(players.filter(p => p.is_muted && new Date(p.muted_until) > new Date()).map(p => p.id));
        const recentMessages = messages.filter(m => !m.is_deleted && m.created_date > oneDayAgo);
        const bannedPosting = recentMessages.filter(m => bannedIds.has(m.player_id));
        const mutedPosting = recentMessages.filter(m => mutedIds.has(m.player_id));
        if (bannedPosting.length > 0) {
            findings.push({ type: 'banned_user_posting', severity: 'critical', count: bannedPosting.length, details: bannedPosting.map(m => m.username) });
        }
        if (mutedPosting.length > 0) {
            findings.push({ type: 'muted_user_posting', severity: 'high', count: mutedPosting.length, details: mutedPosting.map(m => m.username) });
        }

        // 5. Reaction farming — mutual reaction loops between two users
        const reactionPairs = {};
        for (const r of reactions) {
            const key = [r.from_player_id, r.to_player_id].sort().join('|');
            reactionPairs[key] = (reactionPairs[key] || 0) + 1;
        }
        const suspiciousPairs = Object.entries(reactionPairs).filter(([, c]) => c > 20);
        if (suspiciousPairs.length > 0) {
            findings.push({ type: 'reaction_farming', severity: 'high', count: suspiciousPairs.length, details: suspiciousPairs.map(([k, c]) => `${k} — ${c} mutual reactions`) });
        }

        // 6. High RP conversions — players converting more than 5000 RP in last 24h
        const recentConversions = conversions.filter(c => c.created_date > oneDayAgo);
        const convByPlayer = {};
        for (const c of recentConversions) {
            convByPlayer[c.player_username] = (convByPlayer[c.player_username] || 0) + (c.rp_spent || 0);
        }
        const highConversions = Object.entries(convByPlayer).filter(([, v]) => v > 5000);
        if (highConversions.length > 0) {
            findings.push({ type: 'high_rp_conversion', severity: 'medium', count: highConversions.length, details: highConversions.map(([u, v]) => `${u}: ${v} RP converted`) });
        }

        // 7. Unverified users posting (members without is_verified)
        const unverifiedIds = new Set(players.filter(p => !p.is_verified).map(p => p.id));
        const unverifiedMessages = recentMessages.filter(m => unverifiedIds.has(m.player_id));
        if (unverifiedMessages.length > 50) {
            findings.push({ type: 'high_unverified_activity', severity: 'low', count: unverifiedMessages.length, details: [`${unverifiedMessages.length} messages from unverified users in last 24h`] });
        }

        const criticalCount = findings.filter(f => f.severity === 'critical').length;
        const highCount = findings.filter(f => f.severity === 'high').length;

        // Send Telegram if critical/high findings
        if (criticalCount > 0 || highCount > 0) {
            const lines = findings
                .filter(f => f.severity === 'critical' || f.severity === 'high')
                .map(f => `  · [${f.severity.toUpperCase()}] ${f.type}: ${f.count} issue(s)`)
                .join('\n');
            await sendTelegram(
`🔍 <b>SECURITY AUDIT REPORT</b>

Critical: ${criticalCount} | High: ${highCount} | Total findings: ${findings.length}

<b>Top Issues:</b>
${lines}

Time: ${new Date().toISOString()}`
            );
        }

        return Response.json({ success: true, findings, summary: { total: findings.length, critical: criticalCount, high: highCount } });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});