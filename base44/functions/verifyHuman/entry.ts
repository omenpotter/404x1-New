import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CHALLENGES = [
  { id: 0,  q: "What is 8 + 5?",                                    a: "13" },
  { id: 1,  q: "What comes next: 2, 4, 6, ___?",                    a: "8" },
  { id: 2,  q: "Which is a fruit: car, apple, table?",              a: "apple" },
  { id: 3,  q: "What is 15 - 7?",                                   a: "8" },
  { id: 4,  q: "Which is an animal: rock, dog, chair?",             a: "dog" },
  { id: 5,  q: "What is 3 x 4?",                                    a: "12" },
  { id: 6,  q: "What comes next: 1, 3, 5, ___?",                    a: "7" },
  { id: 7,  q: "Which is a color: happy, blue, fast?",              a: "blue" },
  { id: 8,  q: "What is 20 / 4?",                                   a: "5" },
  { id: 9,  q: "What comes next: 10, 20, 30, ___?",                 a: "40" },
  { id: 10, q: "Which is a planet: banana, Mars, peace?",           a: "mars" },
  { id: 11, q: "What is 6 + 9?",                                    a: "15" },
  { id: 12, q: "Which is a number: cat, seven, sky?",               a: "seven" },
  { id: 13, q: "What is 100 - 37?",                                 a: "63" },
  { id: 14, q: "What letter comes after C: A, B, C, ___?",          a: "d" },
  { id: 15, q: "Which is a vehicle: tree, car, mountain?",          a: "car" },
  { id: 16, q: "What is 9 x 3?",                                    a: "27" },
  { id: 17, q: "What comes next: 5, 10, 15, ___?",                  a: "20" },
  { id: 18, q: "Which is a country: cloud, France, idea?",          a: "france" },
  { id: 19, q: "What is 50 + 25?",                                  a: "75" },
];

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const { player_id, action, challenge_id, answer } = body;

        if (!player_id) return Response.json({ error: 'Missing player_id' }, { status: 400 });

        const player = await base44.asServiceRole.entities.Player.get(player_id);
        if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

        // Already verified
        if (player.is_verified) return Response.json({ success: true, already_verified: true });

        // Check lockout
        if (player.verified_locked_until && new Date() < new Date(player.verified_locked_until)) {
            const remaining = Math.ceil((new Date(player.verified_locked_until) - new Date()) / 60000);
            return Response.json({
                success: false,
                locked: true,
                error: `Too many failed attempts. Try again in ${remaining} minute(s).`
            });
        }

        if (action === 'get_challenge') {
            const c = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
            return Response.json({ challenge_id: c.id, question: c.q });
        }

        if (action === 'submit_answer') {
            if (challenge_id === undefined || answer === undefined) {
                return Response.json({ error: 'Missing challenge_id or answer' }, { status: 400 });
            }

            const challenge = CHALLENGES[challenge_id];
            if (!challenge) return Response.json({ error: 'Invalid challenge' }, { status: 400 });

            const correct = String(answer).trim().toLowerCase() === challenge.a.toLowerCase();

            if (correct) {
                await base44.asServiceRole.entities.Player.update(player_id, {
                    is_verified: true,
                    verification_attempts: 0,
                    verified_locked_until: null
                });
                return Response.json({ success: true, message: 'Verification complete! You can now chat.' });
            } else {
                const attempts = (player.verification_attempts || 0) + 1;
                const updates = { verification_attempts: attempts };
                if (attempts >= 2) {
                    updates.verified_locked_until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
                }
                await base44.asServiceRole.entities.Player.update(player_id, updates);
                return Response.json({
                    success: false,
                    locked: attempts >= 2,
                    error: attempts >= 2
                        ? 'Too many wrong answers. Locked out for 10 minutes.'
                        : 'Wrong answer. You have one more attempt.',
                    attempts_remaining: Math.max(0, 2 - attempts)
                });
            }
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});