import { createClientFromRequest } from 'npm:@base44/sdk@0.8.60';
import { getSessionPlayer } from '../../shared/session.ts';
import {
  generateChallenge,
  hashAnswer,
  answerMatches,
  isExpired,
  expiryFrom,
  MAX_ATTEMPTS,
} from '../../shared/challenge.ts';

// Challenges are generated here, server-side, and stored with a hashed answer. Nothing the
// client holds can be reused: the question is new each time, belongs to one player, expires,
// and can be consumed exactly once.
const LOCKOUT_MS = 10 * 60 * 1000;
const MAX_CHALLENGE_ID_LEN = 80;
// Issuance is metered per player: minting a challenge is the cheapest thing this endpoint does,
// so it is the thing that gets hammered. Rows older than the window are pruned as we go, so the
// count only ever reflects recent use rather than lifetime calls.
const ISSUE_WINDOW_MS = 10 * 60 * 1000;
const ISSUE_LIMIT = 5;

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json().catch(() => ({}));
        const { action, challenge_id, answer } = body;

        const player = await getSessionPlayer(base44, body.session_token);
        if (!player) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        const player_id = player.id;

        // Already verified
        if (player.is_verified) return Response.json({ success: true, already_verified: true });

        // Check lockout
        if (player.verified_locked_until && new Date() < new Date(player.verified_locked_until)) {
            const remaining = Math.max(1, Math.ceil((new Date(player.verified_locked_until).getTime() - Date.now()) / 60000));
            return Response.json({
                success: false,
                locked: true,
                error: `Too many failed attempts. Try again in ${remaining} minute(s).`
            });
        }

        const challenges = base44.asServiceRole.entities.VerificationChallenge;

        if (action === 'get_challenge') {
            const recentRows = await challenges
                .filter({ player_id }, '-created_date', 50)
                .catch(() => []);
            const windowStart = Date.now() - ISSUE_WINDOW_MS;
            const issuedInWindow = (recentRows || []).filter(
                c => new Date(c.created_date || 0).getTime() > windowStart
            );

            // Rate limit before anything is generated or written.
            if (issuedInWindow.length >= ISSUE_LIMIT) {
                const oldest = issuedInWindow[issuedInWindow.length - 1];
                const retryMs = new Date(oldest.created_date || 0).getTime() + ISSUE_WINDOW_MS - Date.now();
                return Response.json({
                    success: false,
                    rate_limited: true,
                    error: `Too many verification requests. Try again in ${Math.max(1, Math.ceil(retryMs / 60000))} minute(s).`
                }, { status: 429 });
            }

            // Reuse a challenge issued seconds ago instead of minting a new row per click.
            const latest = (recentRows || [])[0];
            if (latest && !latest.consumed && !isExpired(latest.expires_at) && Date.now() - new Date(latest.created_date || 0).getTime() < 10_000) {
                return Response.json({
                    challenge_id: latest.id,
                    question: latest.question,
                    expires_at: latest.expires_at,
                    attempts_allowed: MAX_ATTEMPTS
                });
            }

            // Prune rows outside the window. Older open challenges no longer need deleting:
            // submit_answer only honours the newest open one, so an earlier question cannot be
            // answered later even if its row still exists.
            try {
                await challenges.deleteMany({
                    player_id,
                    created_date: { $lt: new Date(windowStart).toISOString() }
                });
            } catch { /* pruning is best effort */ }

            const generated = generateChallenge();
            const record = await challenges.create({
                player_id,
                question: generated.question,
                answer_hash: await hashAnswer(generated.answer),
                expires_at: expiryFrom(),
                consumed: false,
                attempts: 0
            });

            return Response.json({
                challenge_id: record.id,
                question: record.question,
                expires_at: record.expires_at,
                attempts_allowed: MAX_ATTEMPTS
            });
        }

        if (action === 'submit_answer') {
            if (typeof challenge_id !== 'string' || !challenge_id || challenge_id.length > MAX_CHALLENGE_ID_LEN) {
                return Response.json({ error: 'Missing challenge_id or answer' }, { status: 400 });
            }
            if (typeof answer !== 'string' || !answer.trim()) {
                return Response.json({ error: 'Missing challenge_id or answer' }, { status: 400 });
            }

            const challenge = await challenges.get(challenge_id).catch(() => null);
            // Someone else's challenge is treated exactly like an unknown one.
            if (!challenge || challenge.player_id !== player_id) {
                return Response.json({ success: false, error: 'Invalid challenge. Request a new one.' });
            }
            // Replay: a consumed challenge is refused outright, even with the right answer.
            if (challenge.consumed) {
                return Response.json({ success: false, error: 'This challenge has already been used. Request a new one.' });
            }
            if (isExpired(challenge.expires_at)) {
                return Response.json({ success: false, expired: true, error: 'This challenge expired. Request a new one.' });
            }

            // Only the newest open challenge may be answered, so a question captured from an
            // earlier round carries no value even though its row is still open.
            const newestOpen = await challenges
                .filter({ player_id, consumed: false }, '-created_date', 1)
                .catch(() => []);
            const newest = (newestOpen || [])[0];
            if (newest && newest.id !== challenge.id) {
                return Response.json({ success: false, expired: true, error: 'This challenge expired. Request a new one.' });
            }

            const correct = await answerMatches(answer, challenge.answer_hash);

            if (correct) {
                // Single use: the consume only lands while the challenge is still open, so two
                // simultaneous submissions of the same answer cannot both be honoured.
                const consume = await challenges.updateMany(
                    { id: challenge.id, consumed: false },
                    { $set: { consumed: true } }
                );
                if (!consume.updated) {
                    return Response.json({ success: false, error: 'This challenge has already been used. Request a new one.' });
                }

                await base44.asServiceRole.entities.Player.update(player_id, {
                    is_verified: true,
                    verification_attempts: 0,
                    verified_locked_until: null
                });
                return Response.json({ success: true, message: 'Verification complete! You can now chat.' });
            }

            const attempts = (challenge.attempts || 0) + 1;
            const locked = attempts >= MAX_ATTEMPTS;

            // Optimistic claim: it only lands against the attempt count we just read, so
            // parallel wrong answers cannot be counted once.
            const claim = await challenges.updateMany(
                { id: challenge.id, consumed: false, attempts: challenge.attempts || 0 },
                { $set: { attempts, consumed: locked } }
            );
            if (!claim.updated) {
                return Response.json({ success: false, error: 'That answer is already being checked. Try again.' });
            }

            const updates: Record<string, unknown> = { verification_attempts: attempts };
            if (locked) {
                updates.verified_locked_until = new Date(Date.now() + LOCKOUT_MS).toISOString();
            }
            await base44.asServiceRole.entities.Player.update(player_id, updates);

            return Response.json({
                success: false,
                locked,
                error: locked
                    ? 'Too many wrong answers. Locked out for 10 minutes.'
                    : 'Wrong answer. You have one more attempt.',
                attempts_remaining: Math.max(0, MAX_ATTEMPTS - attempts)
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});