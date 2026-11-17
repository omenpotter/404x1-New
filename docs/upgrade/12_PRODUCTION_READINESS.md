# Final Production Readiness Report

Branch: `claude/404x1-upgrade` (based on `main` = `c5b32fb`)
Prepared: 2026-11-17
Verdict: **NO-GO until the two secrets are set.** Everything else in scope is complete and verified. Nothing was merged, published, activated or written to production data.

---

## 1. Release-safety corrections made in this pass

**Session hash replay — closed.** A stored digest could previously be presented as a session token: the digest comparison missed (because `SHA-256(D) ≠ D`) and the legacy plaintext comparison then matched `D` verbatim. Storage is now `sha256:<64 hex>`, and any presented value carrying that prefix is refused before a lookup runs. Legacy plaintext sessions are still accepted once and upgraded in place, so **no legitimate player is logged out**.

Verification: `tests/session.test.js` grew from 6 to **15 tests**, four of which exercise `getSessionPlayer` itself against an in-memory Player table — legacy login still works, the row is upgraded, and the upgraded value is then rejected as a credential. Full suite: **43/43 across 4 files**. Typecheck 0 errors, build exit 0.

**Rollback compatibility — measured, not assumed.** The new code reads both formats, so forward is seamless. The old code (verified by reading `main`'s helper) reads only plaintext, so a rollback after publishing costs each active player **one wallet reconnection**, bounded by the 7-day session lifetime. No data repair, no lockout. Documented in `ROLLBACK.md` stage 4 and `10_SESSION_COMPATIBILITY.md` §5.

**Three documentation inconsistencies corrected:**
1. The phase 3 security report claimed every player must reconnect their wallet — contradicted by the lazy upgrade that actually shipped. Rewritten, and the storage format updated to the prefixed form.
2. The session helper's own header comment still described a `TELEGRAM_BOT_TOKEN` fallback that had already been removed, and described storage without the prefix. Rewritten with the format, the three properties that make it safe, and the removal condition.
3. `ROLLBACK.md` still described the retired chart-iframe flow and a stale pre-upgrade commit. Rewritten around the current reference points, staged by merge/publish state, with the session asymmetry called out.

---

## 2. Merge versus publish — what happens when

**Merging applies backend-function changes to `main` and deploys them.** Base44's documentation is explicit: a branch gets its own copy of each function you change, and "when you merge the branch, your changes are deployed to main". It is equally explicit that "your changes only reach your app's users when you publish from main".

Practical consequences:

- After the merge, `main`'s functions are the new ones, but the published app still serves the 2026-11-11 build until you publish.
- **Set `CRON_SECRET` and `LAUNCH_DATE` before merging.** Then no moment exists where the new runners are deployed with a secret they need missing.
- Verify on a preview between merge and publish. That is the one window where you can exercise the new code without users seeing it.
- Publishing is the Publish button in the editor, never a dashboard action.

---

## 3. Custom domain — the status field is stale, the domain works

Platform record: `404x1.xyz`, added 2026-03-10, `verificationStatus: "unverified"`, last status check 2026-03-10. Required records: `A 404x1.xyz → 216.24.57.1` and `CNAME www.404x1.xyz → base44.onrender.com`, both TTL 300.

Independent check this pass: **`https://404x1.xyz` resolves and serves the live app over HTTPS** — the page rendered with real market data (price 0.000034 XNT, 66 holders, market cap 13.77 XNT, live X1 transaction rows). So DNS is functioning; only the recorded verification state is eight months out of date, because nothing has re-run the check since March.

Action (owner, Dashboard → Domains): open the domain and re-run verification. Expect the status to move to verified. No DNS edit is needed unless verification now fails, which would mean the records were removed since March.

---

## 4. Token supply — the hardcoded value is gone, and that is the right outcome

The hardcoded `404404` from the initial audit no longer exists in the codebase: no occurrence remains in any source file. Supply is read from the mint account at request time and market cap is `spot × supply`. If the read fails, the UI shows `N/A` rather than a guess.

Measured on-chain this cycle: **supply = 404,402.625473771**, mint authority **revoked**, and holder balances sum exactly to that supply. Two observations follow:

- The constant was already wrong by 1.37 tokens (supply sits below 404,404 because of burns). A hardcoded figure would have drifted further with every burn, silently inflating market cap. Reading the mint is the only correct approach.
- With the mint authority revoked, no supply expansion is possible; supply can only fall through burns. So the displayed number can only move down, and "fixed supply" copy remains accurate.

Security implications: none. Supply is a public chain value, not a secret, and the page labels it as read from the mint with the authority revoked. Tokenomics were not touched: same mint, same decimals, same halving schedule, same RP caps and sink costs (verified by an empty diff on the economy constants).

---

## 5. Workflow activation — procedure written, nothing activated

`13_WORKFLOW_ACTIVATION_RUNBOOK.md` carries the exact order: set `CRON_SECRET` → set `LAUNCH_DATE` → rotate the Telegram token → merge → add `cron_secret` to the three production workflows → activate them one at a time, checking a run after each → **leave Stress Test Wave inactive** → publish → confirm a ModerationLog row.

**Stress Test Wave stays disabled.** It writes bulk test rows into live tables and depends on `STRESS_TEST_ENABLED`; it is not a production workflow and is excluded from the activation set. All four workflows remain inactive on this branch, and no workflow definition was modified (empty diff).

---

## 6. Blockers

**B1 — `CRON_SECRET` not set.** The platform lists it as a required secret for the four runners and refuses to run them. This is also one of the two "critical" findings in the stored security scan (it is an unregistered environment read, not a leaked credential).

**B2 — `LAUNCH_DATE` not set.** Same mechanism, and the fallback of `2025-01-01` makes the halving rate roughly 4x too low for a 2026 launch. Registering it clears the second critical finding.

Both are Secrets-page actions on `main`. Neither is a code change.

**B3 — workflow steps pass empty arguments.** Covered by the runbook; three workflows need the secret, one stays off.

---

## 7. Residual risks

**R1 — stored-hash replay: closed** (this pass). Kept here only so the change is traceable.

**R2 — rollback costs one reconnection per active player.** Inherent to hashing; documented with the staged procedure.

**R3 — compatibility branch still present.** Deferred by design until migration progress is verified. Removal is the point of no return; inspect `Player.session_token` for values that do not start with `sha256:` to measure progress.

**R4 — security scan is stale.** It will keep reporting 2 critical + 11 dependency + 39 service-role notes until it re-runs against published code. The dependency items are objectively cleared (zod removed, vite 6.4.6, `npm audit` reports 0 of every severity); the service-role notes are a heuristic that cannot see the shared session helper, and the probes contradict them (six endpoints return 401 without a credential).

**R5 — native builds would be refused by the CORS allowlist.** Web is unaffected; a packaged app's origin must be added before such a build ships.

**R6 — no browser automation here.** Responsive verification was a source audit plus one targeted fix; wallet login and score submission happy paths were reviewed, not executed end to end. Recommend one live wallet connect and one score submit on the merged preview.

**R7 — public feed cost.** `chatHistory` pulls 500 messages plus related records per call. Functional, but it is the heaviest read in the app.

**R8 — custom domain status stale** (§3). Works today; re-verify to clear the record.

---

## 8. Release checklist

1. Set `CRON_SECRET` (32+ random chars, not the bot token).
2. Set `LAUNCH_DATE` (`YYYY-MM-DD`, real launch date).
3. Rotate the Telegram bot token; update the secret if it changed.
4. Merge the branch into `main`.
5. Add `cron_secret` to the three production workflows; activate each and confirm one successful run.
6. Leave Stress Test Wave inactive.
7. Preview check: connect a wallet, send a message, submit a score, open the leaderboard on a phone, load the chart, run one RP conversion.
8. Publish from the editor.
9. Re-run the security scan; confirm the two critical and the dependency findings clear.
10. Re-verify the custom domain in Domains.
11. After confirming migration progress (no plaintext `session_token` values remain), remove the legacy lookup.

---

## 9. Bottom line

The build is clean (43/43 tests, 0 type errors, build exit 0, 0 vulnerabilities), the replay defect that survived the earlier hardening is now closed with tests that exercise the real lookup, the documentation matches the code, the custom domain works despite a stale status field, and the supply figure is read from the chain rather than guessed. What stands between this branch and a release is two secrets and one workflow edit, all owner actions on `main`, all reversible except the deliberate cleanup in step 11.

Awaiting explicit owner approval before anything is merged or published.
