# 404X1 Security Hardening V2 — consolidated report

Branch: `security-hardening` (no merge, no publish, no production writes, no secret changes,
no workflow activation). Date of run: 2026-11-18.

---

## 1. What changed in this phase

| Area | Change |
| --- | --- |
| Private conversation deletion | `deleteConversation` now adds the caller to `Conversation.hidden_for` with `$addToSet` instead of deleting the thread and its messages. `getConversations` filters by `isVisibleTo`. `sendPrivateMessage` and `createConversation` un-hide a thread when it becomes active again. |
| Human verification | Fixed 20-question list replaced by server-generated challenges stored in the new `VerificationChallenge` entity: question generated per request, answer stored only as SHA-256, 5-minute expiry, single-use consumption, 2 attempts then 10-minute lockout, per-player binding, oldest open challenge retired. |
| RP conversion | `convertRp` refuses before touching any balance when `LAUNCH_DATE` is missing, unparseable or in the future, returning `success:false, disabled:true` with a user-facing message. Formula, caps, floors and rates untouched. |
| Daily staff payout | Grant record is written first and the earliest record for the day wins; a losing concurrent run deletes its own row and pays nothing. Balance is incremented only after the claim is confirmed. |
| Image policy | Size check extended into one HEAD inspection that also rejects non-image content types and SVG. Applied to public chat and DMs. |
| Shared modules | New `base44/shared/conversations.ts` (visibility rules) and `base44/shared/challenge.ts` (challenge generation, hashing, expiry). |

### Files modified

- `base44/entities/Conversation.jsonc` (added `hidden_for`, all prior fields and RLS unchanged)
- `base44/entities/VerificationChallenge.jsonc` (new)
- `base44/shared/conversations.ts` (new)
- `base44/shared/challenge.ts` (new)
- `base44/shared/images.ts` (`isOversizedImage` → `inspectStoredImage`)
- `base44/functions/verifyHuman/entry.ts`
- `base44/functions/deleteConversation/entry.ts`
- `base44/functions/getConversations/entry.ts`
- `base44/functions/sendPrivateMessage/entry.ts`
- `base44/functions/createConversation/entry.ts`
- `base44/functions/convertRp/entry.ts`
- `base44/functions/chatSend/entry.ts`
- `base44/functions/runDailyStaffRewards/entry.ts`
- `tests/images.test.js`, `tests/usernames.test.js`, `tests/challenge.test.js`, `tests/conversations.test.js` (new)
- `docs/upgrade/PRODUCTION_CLEANUP_PLAN.md` (new)

No visual, branding, copy or tokenomics change. The verification modal, DM list and conversion
modal render exactly as before.

---

## 2. Security verification results

### 2.1 Concurrency and atomicity

| Claim | Verdict | Basis |
| --- | --- | --- |
| Case-insensitive username uniqueness | Holds | Uniqueness decided on `usernameKey`; the platform rejected a declarative unique constraint, so the guard is write-then-recheck: earliest record by (`created_date`, `id`) keeps the name, later claimant deletes only its own row. Unit-tested key collapsing (`tests/usernames.test.js`). |
| Duplicate registration under simultaneous requests | Prevents duplicate *claims*; no DB-level constraint | Same mechanism. Two requests can both insert briefly; only the earliest survives. A crash between insert and recheck can leave a duplicate for manual cleanup. |
| Nonce consumption / signature replay | Holds | Nonce is inside the signed text, signature freshness window is enforced, and `last_auth_nonce` refusal blocks reuse. Two simultaneous requests replaying the *same* nonce can both pass the compare-before-write step (no unique constraint); impact is two sessions for the same already-proven wallet. |
| Session expiry / revocation / migration | Holds | Stored value is `sha256:<digest>`; a presented prefixed value is refused; expiry checked per request; logout nulls token and expiry; legacy plaintext tokens are upgraded in place. Covered by `tests/session.test.js`. |
| RP increments / deductions / conversions | Holds with a documented window | All mutations use conditional `updateMany` with `$inc` and range guards. Conversion is claim capacity → conditional debit → rollback capacity if debit fails. The rollback step is a separate write, so a crash between debit and rollback can hold weekly capacity without a debit. |
| Concurrent daily payouts | Holds after this change | Claim-then-verify ordering above. Remaining exposure is a run whose clock straddles UTC midnight. |
| Image ownership / type / size / bypasses | Holds | App-folder URL match, https only, no credentials, no traversal or whitespace, 512-char cap, 5 MB ceiling, image/* only, SVG refused. Covered by 14 tests. |
| Entity-level access / direct SDK queries | Effective gate is the backend | Players authenticate by wallet into `Player` rows, not into platform accounts, so a client SDK query is unauthenticated and RLS denies it. `PrivateMessage`, `Conversation`, `RpGrant`, `RpConversion`, `RpSpend`, `ModerationLog`, `VerificationChallenge` all deny non-owner reads. Public chat (`Message`, `Score`, `Reaction` read = public) is intentionally public. |
| Sensitive fields in direct queries | Not exposed | `session_token` is stored as a prefixed digest (unusable as a credential); `gameStats` and `getPlayerActivity` return whitelisted public fields only; `playerSearch` returns username/role. |

Not executed, by instruction: live concurrency against the production database, and any write to a
test account. Concurrency verdicts above are from the code paths and the exact query semantics each
one depends on, not from a live race run on production.

### 2.2 Per-function assessment (39 functions)

| Function | Assessment |
| --- | --- |
| authWallet | Signature + freshness + single-use nonce + case-insensitive claim recheck; issues hashed session. Minor residual: same-nonce parallel replay can mint two sessions. |
| awardRp | Superuser only; atomic `$inc`. |
| changeRole | Superuser only; role whitelist; hierarchy guard. |
| chatAwardRp | Session, banned check, whole-number bounds, atomic two-sided `$inc`, daily caps. |
| chatDelete | Session; own message or staff; soft delete. |
| chatHistory | Session; paginated; image URLs re-validated on read. |
| chatPin | Staff roles only; RP charged atomically before pin. |
| chatReact | Session, banned check, atomic; daily caps. |
| chatSearch | Public, read-only, capped, public fields only (intended). |
| chatSend | Session, banned, mute, image policy, RP caps; reply metadata derived server-side. |
| chatTyping | Session; writes own typing flag only. |
| convertRp | Session, banned, atomic capacity claim + conditional debit + rollback; disabled without valid `LAUNCH_DATE`. |
| createConversation | Session, banned, mute, both players exist, reuses thread and un-hides it for the caller. |
| deleteConversation | Session, participant check, per-participant hide only. |
| gameLeaderboard | Public read, capped. |
| gameStart | Session; issues single-use play session. |
| gameStats | Session required; public stats only. Accepts a `user_id` for public profiles. |
| gameSubmit | Session + play token; server-side score/duration plausibility; atomic updates; daily cap. |
| getConversations | Session; participant + visibility filter. |
| getModLogs | Staff roles only; capped. |
| getPlayerActivity | Session; self or staff; sensitive fields stripped. |
| getPrivateHistory | Session; participant only. |
| getSystemHealth | Staff roles only. |
| issueWarning | Staff roles only; hierarchy guard. |
| logout | Session; revokes token server-side. |
| moderateUser | Staff only; hierarchy and per-role caps; atomic penalties. |
| playerSearch | Session; capped; public fields. |
| privateReadReceipt | Session; participant check. |
| privateTyping | Session; participant check. |
| runChatAdmin | Cron secret or admin/platform admin only. |
| runChatModerator | Cron secret or admin/platform admin only. |
| runDailyStaffRewards | Cron/admin only; claim-then-verify payout. |
| runSecurityAudit | Platform admin only. |
| runStressTest | Cron/admin + `STRESS_TEST_ENABLED`. Residual: when enabled it creates real players and messages in production. |
| sendPrivateMessage | Session, banned, mute, participant; image policy; un-hides thread for both sides. |
| spendRp | Session, banned; atomic conditional debit; perk validation. |
| updateProfile | Session, banned; field whitelist and length caps. |
| verifyHuman | Session; server-generated, single-use, expiring, hashed challenges; attempt + lockout limits. |
| xdexProxy | Session; endpoint allowlist; blocks `@`, `://`, `..`. |

---

## 3. Regression verification

| Check | Result |
| --- | --- |
| Automated test suite | **84 passed / 84**, 8 files, 0 failed (`npx vitest run`) |
| Previously failing tests | Fixed: division challenge could generate a fractional answer (generator now builds from a whole quotient) |
| TypeScript check | **0 errors** (`tsc -p jsconfig.json --noEmit`, exit 0) |
| Production build | **Success**, `vite build` exit 0, `dist/` written |
| Dependency audit | **12 high, 0 critical, 0 moderate, 0 low** |
| Authentication security tests | `tests/session.test.js` (hashing, legacy upgrade, prefix refusal, expiry) pass |
| Concurrent registration tests | `tests/usernames.test.js` (8) pass |
| Signature replay tests | Nonce/replay logic verified by inspection; no automated test can drive a real wallet signature without production writes |
| Concurrent RP economy tests | Conditional-update semantics verified by inspection; no live race run (production writes forbidden) |
| Private messaging tests | `tests/conversations.test.js` (8) pass |
| Image validation tests | `tests/images.test.js` (14) pass, includes mocked storage responses |
| Entity permission tests | Verified by reading each entity's RLS; not runnable as an unauthenticated client from this environment |
| Responsive / mobile regression | Not executed this phase; DM list, verification modal and conversion modal markup unchanged |

### Dependency findings (single root cause)

All 12 high findings trace to **GHSA-fc5q-39xc-vjpf**: `picomatch` vulnerable to ReDoS, range
`<=4.0.7`, and **4.0.7 is the latest published version**, so no patched release exists. It reaches
the tree through `fdir`/`tinyglobby`/`micromatch` → `fast-glob`/`chokidar` → `tailwindcss`,
`vite`, `vitest`, `tailwindcss-animate`. `npm audit fix` cannot resolve it (npm `edgesOut` error
with the existing `overrides`), and the suggested `vite`/`vitest` downgrades are semver-major.
These are build and test tooling, not code shipped in the browser bundle. No dependency was
changed: version changes need owner approval per the earlier decision.

---

## 4. Production cleanup plan

See `docs/upgrade/PRODUCTION_CLEANUP_PLAN.md`. Summary:

- racea13015 `6af4748978657add715158e5`, raceb13154 `6af4748920f460c5bbee69ec`
- RpAward `6af474a0783b986bb01106c9`, RpConversion `6afc609683d86ab0bf154642`
- GameSession `6af4740844f508086eee70f5` (player_id `probe_player`)
- Stress logs: **202** rows match `*_stress_bot_*` (full ID list in the plan). The other 60 log rows
  are older bot-harness activity and include six rows against the live `test` account, so they are
  excluded from any bulk delete.
- Protected: the six legitimate players (IDs listed), the real daily RpGrant, all conversations,
  reactions and live-account messages. Cross-reference check: no other record references either
  race account.

---

## 5. Platform limitations

1. No declarative unique constraint on entity fields, so username and payout exclusion rest on
   ordering after write, not on the database.
2. No multi-document transactions. Compensation (rollback of weekly capacity) is a separate write.
3. No conditional update that returns the updated record, so "read → compare → write" gaps remain
   for non-`updateMany` paths.
4. Entity records are not branched: branch code and production data are separate, but a function
   run on a branch still acts on live records.
5. RLS is expressed against platform users; this app's players are wallet-authenticated rows, so
   backend functions are the real authorization boundary. RLS still denies direct client queries.
6. Backend functions have no environment flag, so preview and production share behaviour. The only
   isolation is the preview build's read-only guard.
7. Workflows cannot be changed on a branch. Agents changed here go live only after merge.

---

## 6. Remaining risks

1. Same-nonce parallel replay can issue two sessions for one wallet (low impact, same signer).
2. Conversion capacity can be held without a debit if the process dies between the two writes.
3. `runStressTest` writes real data when enabled; it needs the secret and the flag.
4. Verification challenge issuance is unthrottled beyond a 10-second reuse window.
5. Session tokens live in browser storage (XSS-reachable); a cookie-based scheme is not available
   for this custom wallet auth.
6. `Conversation` and `PrivateMessage` RLS still allow a participant with a platform session to
   hard-delete a row. Changing RLS is refused on this branch; do it on main.
7. 12 high npm advisories with no patched upstream release.
8. Human verification is a text challenge, not a bot-proof control; it stops casual scripting only.

---

## 7. Release readiness

- Code quality gates: build, types and the full test suite pass.
- Functional changes are additive except two deliberate behaviour changes: deletion now hides for
  the caller only, and RP conversion is refused while `LAUNCH_DATE` is unset. The second is
  user-visible and blocks converting RP until the owner sets the schedule.
- Not ready to publish until: the owner approves the cleanup, decides `LAUNCH_DATE`, and accepts or
  fixes the remaining risks above.

## 8. Rollback

1. Revert the branch (no merge has happened, so `main` is untouched).
2. If already merged: revert the merge commit; all changes are in tracked files.
3. Data rollback is not needed for the entity change: `hidden_for` is additive and ignored by older
   code; `VerificationChallenge` rows are disposable.
4. Restore previous function versions from `main`; no entity field was removed or retyped, so no
   migration is required in either direction.
5. If the cleanup has been executed by then, restore from the JSON exports taken beforehand.
