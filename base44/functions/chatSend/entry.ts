import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { getSessionPlayer, isBanned } from '../../shared/session.ts';
import { normalizeImageUrl, inspectStoredImage } from '../../shared/images.ts';

const COOLDOWN_MS = 3000;
const DAILY_MSG_RP_CAP = 200;

// A message image is accepted only when it points at a file this app itself uploaded.
// Any other URL would make every reader's browser call that host, which is how an
// external tracking image works, so it is refused before the message is written.
async function resolveMessageImage(raw: unknown): Promise<{ url: string | null; error?: string }> {
    if (raw === undefined || raw === null || raw === '') return { url: null };
    const url = normalizeImageUrl(raw);
    if (!url) return { url: null, error: 'External image links are not allowed — upload the image instead' };
    const problem = await inspectStoredImage(url);
    if (problem) return { url: null, error: problem };
    return { url };
}

Deno.serve(async (req) => {
    try {
        const body = await req.json();
        const { session_token, message, reply_to_message_id, image_url } = body;

        if (!message) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (message.length > 5000) {
            return Response.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Author is the authenticated caller — never trust client-supplied user_id.
        const player = await getSessionPlayer(base44, session_token);
        if (!player) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        if (isBanned(player)) return Response.json({ success: false, error: 'Your account is suspended' }, { status: 403 });

        if (player.is_verified === false) {
            return Response.json({ success: false, error: 'Complete human verification first', needs_verification: true });
        }

        if (player.is_muted) {
            if (player.muted_until && new Date() < new Date(player.muted_until)) {
                return Response.json({ success: false, error: `You are muted until ${new Date(player.muted_until).toLocaleString()}` }, { status: 403 });
            } else {
                await base44.asServiceRole.entities.Player.update(player.id, { is_muted: false, muted_until: null, muted_by: null });
            }
        }

        const image = await resolveMessageImage(image_url);
        if (image.error) return Response.json({ success: false, error: image.error }, { status: 400 });

        const now = Date.now();
        const lastMsg = player.last_message_at ? new Date(player.last_message_at).getTime() : 0;
        if (now - lastMsg < COOLDOWN_MS) {
            return Response.json({ error: 'Slow down — 3 second cooldown between messages' }, { status: 429 });
        }

        const today = new Date().toISOString().slice(0, 10);
        const sameDay = player.daily_rp_date === today;
        const dailyMsgRp = sameDay ? (player.daily_rp_messages || 0) : 0;
        // Roll the daily counter over first — the guard only matches a date that is not today.
        if (!sameDay) {
            await base44.asServiceRole.entities.Player.updateMany(
                { id: player.id, daily_rp_date: { $ne: today } },
                { $set: { daily_rp_date: today, daily_rp_messages: 0 } }
            );
        }

        // Reply metadata is derived server-side from the referenced message — client-supplied
        // reply_to_username / reply_to_message would let a user fabricate quotes by others.
        let replyMeta = { reply_to_message_id: null, reply_to_username: null, reply_to_message: null };
        if (reply_to_message_id) {
            const target = await base44.asServiceRole.entities.Message
                .get(reply_to_message_id)
                .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
            if (!target || target.is_deleted) {
                return Response.json({ error: 'Reply target message not found' }, { status: 400 });
            }
            replyMeta = {
                reply_to_message_id: target.id,
                reply_to_username: target.username,
                reply_to_message: (target.message || '').slice(0, 500)
            };
        }

        const is_reply = !!replyMeta.reply_to_message_id;
        // Only a validated image earns the image reward, so a bare external URL cannot buy RP.
        const has_image = !!image.url;
        let rp_earned = 0;
        if (dailyMsgRp < DAILY_MSG_RP_CAP) {
            rp_earned = Math.min(has_image ? 3 : 2, DAILY_MSG_RP_CAP - dailyMsgRp);
        }

        const newMessage = await base44.asServiceRole.entities.Message.create({
            player_id: player.id,
            username: player.username,
            message,
            is_reply,
            ...replyMeta,
            has_image,
            image_url: image.url,
            is_deleted: false,
            is_flagged: false,
            reaction_count: 0
        });

        // The daily message RP is claimed only while the cap still has room — that condition is
        // part of the write, so parallel sends cannot exceed the cap or mint RP twice.
        let rpCredited = 0;
        if (rp_earned > 0) {
            const claim = await base44.asServiceRole.entities.Player.updateMany(
                { id: player.id, daily_rp_date: today, daily_rp_messages: { $lte: DAILY_MSG_RP_CAP - rp_earned } },
                { $inc: { reputation_points: rp_earned, daily_rp_messages: rp_earned } }
            );
            if (claim.updated) rpCredited = rp_earned;
        }

        // Activity counters are incremented in place, never written back from a stale read.
        await base44.asServiceRole.entities.Player.updateMany(
            { id: player.id },
            {
                $inc: { messages_sent: 1 },
                $set: {
                    last_seen: new Date().toISOString(),
                    last_message_at: new Date().toISOString(),
                    daily_rp_date: today
                }
            }
        );

        return Response.json({ success: true, message: newMessage, rp_earned: rpCredited });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});