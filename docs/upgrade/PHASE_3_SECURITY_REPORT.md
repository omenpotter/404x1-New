# Phase 3 — Security Hardening Report

Branch: `claude/404x1-upgrade`
Scope: authorisation model, session credentials, CORS policy, secrets hygiene.
Verification: typecheck 0 errors, 28/28 unit tests pass, production build exits 0.

## 1. Identity model (what every backend call may rely on)

| Caller | Credential | Resolved by |
| --- | --- | --- |
| Player (browser / native) | `session_token` in body or `Authorization: Bearer` | `getSessionPlayer()` in `base44/shared/session.ts` |
| Staff (moderator / admin / superuser) | wallet session token, role read from the Player row | same helper + role check |
| Automation (workflows) | `cron_secret` = `CRON_SECRET` | `authorizeCronOrAdmin()` |
| Dashboard / platform-admin invocation | platform identity | `authorizeCronOrAdmin()` platform-admin branch |

Rules enforced in this phase:

- No client-supplied player, moderator or user id is trusted for authorisation decisions. Every state-changing endpoint derives the caller from a session token.
- Every sensitive endpoint validates the session **before** reading the payload's privileged fields, and rejects banned accounts.
- `getPlayerActivity` strips `session_token` and `session_expires_at` from its response.

## 2. Session tokens at rest

Tokens are no longer stored in plaintext. `issueSession()` writes `SHA-256(token)` to `Player.session_token`, and lookups hash the presented token before querying. A database read (or a log that captured the field) can no longer be replayed as a working credential.

Consequence: sessions issued before this change stop matching, so every player reconnects their wallet once. No schema change was needed — the hashed value occupies the existing field.

## 3. Automation authorisation

`authorizeCronOrAdmin()` accepts exactly three things:

1. `cron_secret` matching the dedicated `CRON_SECRET` secret, compared in constant time.
2. A wallet session belonging to a Player whose `user_role` is `admin` or `superuser`.
3. A platform-admin identity (`base44.auth.me().role === 'admin'`), which is how the dashboard run button and the scheduled workflow runner reach these functions.

The previous fallback that accepted `TELEGRAM_BOT_TOKEN` as an authorisation key was removed. Messaging credentials must not double as backend authorisation keys: leaking the bot token would otherwise grant the whole moderation and economy surface. `TELEGRAM_BOT_TOKEN` is still used, only where it belongs — sending alerts.

## 4. CORS policy

Nine functions previously answered with `Access-Control-Allow-Origin: *` while accepting session tokens. All now use the shared `corsHeaders(req)` helper, which grants only an explicit allowlist: `404x1.xyz`, `www.404x1.xyz`, `localhost`, `127.0.0.1`, plus `*.base44.app` and `*.vercel.app`. Unlisted origins receive no grant, so a token-bearing request from an attacker page cannot read the response.

Functions converted: `authWallet`, `chatDelete`, `chatPin`, `chatTyping`, `convertRp`, `gameStart`, `gameSubmit`, `getSystemHealth`, `spendRp`, `xdexProxy`.

Caveat: a packaged native app presents a non-http origin, which gets no CORS grant. Same-origin web calls are unaffected. If the iOS/Android build calls these functions directly, its origin must be added to the allowlist first.

## 5. Verified behaviour

- `gameStats` with no credential returns 401 (auth gate is live, not decorative).
- `chatHistory` remains readable without a credential, as designed for the public feed.
- Typecheck: 0 errors. Unit tests: 28/28. Build: exit 0.

## 6. Open items that must be completed on the main branch

These are configuration and workflow changes; they are refused on a feature branch.

1. **Set `CRON_SECRET`.** The four automated runners reference it, so the platform reports it as a required secret and will not run them until it exists. Generate a 32+ character random value.
2. **Set `LAUNCH_DATE`.** `convertRp` computes the RP→RPx halving rate from it and falls back to `2025-01-01` when unset, which makes the rate 4x lower than a real launch date implies. Set the real date; the fallback in code was intentionally left untouched so tokenomics were not silently changed.
3. **Pass `cron_secret` from the workflows.** `Chat Moderator — 24/7 Auto Patrol`, `Chat Admin — 24/7 Escalation Review`, `Daily Staff RP Rewards` and `Stress Test Wave` currently invoke their functions with empty arguments. Either add `"cron_secret": "{{CRON_SECRET}}"` to each step, or rely on the platform-admin branch. The four workflows are currently inactive, so nothing is running meanwhile.
4. **Rotate the Telegram bot token** if it was ever used as the automation secret, and treat `TELEGRAM_CHAT_ID` as non-sensitive.

## 7. Not changed in this phase

- The RP→RPx halving schedule and all economy constants.
- `chatHistory`'s optional `session_token` query parameter (read-only identification; no privileged action depends on it).
- Admin-only entity access rules: the wallet session model means Base44 platform roles, not Player roles, govern RLS. Server functions act with service role after wallet-session checks, which is the intended design; this phase hardened those checks rather than the RLS layer.
