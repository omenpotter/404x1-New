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
            // Only the newest challenge stays live: anything still open for this player is
            // retired first, so an older question cannot be answered later out of a screenshot.
            try {
                await challenges.deleteMany({ player_id, consumed: false });
            } catch { /* retiring old challenges is best effort */ }

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