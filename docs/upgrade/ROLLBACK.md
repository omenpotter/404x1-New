# Rollback

Current state of the safety net, and what reversal looks like at each stage.

## Reference points

- `main` = `c5b32fb` ("Update base44 packages"). Untouched by this work.
- `claude/404x1-upgrade` = the branch carrying every change described in these reports.
- Production has published once, on 2026-11-11, from `main`. Nothing in this branch has been published.
- No entity schema changed (verified: empty diff on the entity folder), so **no data migration and no record repair exists to reverse**. This is the most important fact for any rollback decision.
- No workflow definition changed (verified: empty diff on the workflow folder).

## Stage 1 — before merging

Production is untouched. Discard at will: delete the branch. Nothing else to do.

## Stage 2 — merged, not yet published

Merging applies this branch's backend-function and frontend changes to `main` and deploys the functions to the main environment, but it does not put them in front of users; that happens only on publish from `main`. To reverse: revert the merge commit on `main`, or reset `main` to `c5b32fb`. The published app keeps serving the 2026-11-11 build throughout, so users see no change either way.

One detail to watch in this stage: the session format changed. Anyone who connects a wallet against code running the new format gets a `sha256:`-prefixed stored value. Old code cannot read that, and the player reconnects once. Stage 4 explains why that is a logout and not a lockout.

## Stage 3 — published

1. **Code:** restore the previous checkpoint from the editor's version history and publish it again. That is the fastest path back to 2026-11-11 behaviour.
2. **Site down urgently:** unpublish from the dashboard's danger zone instead.
3. **Functions:** they follow the published version; no separate step.
4. **Data:** nothing to undo. Balances, messages, scores and sessions were never restructured.
5. **Workflows:** deactivate them. They return to the inactive state they are in today.

## Stage 4 — session impact of a rollback (the only asymmetry)

The new code reads both formats, so **forward is seamless**. The old code reads only plaintext, so **backward is not**: after a rollback, every player holding a hashed session must reconnect their wallet once. That is a logout, not a lockout: wallet re-authentication is immediate and issues a fresh plaintext token under the old code.

Expect a visible rise in "connect wallet" prompts for up to seven days (one session lifetime), then normal behaviour.

There is no way to make hashed sessions readable by the old code without storing them in plaintext, which would undo the reason for the change. The mitigation is a short rollback window, not a compatibility shim.

## Stage 5 — after the legacy plaintext branch is removed

Once every plaintext row has drained (one session lifetime after publish, and only with the owner confirming migration progress), the legacy lookup is deleted. From then on, rolling back to pre-hash code would invalidate all sessions at once, so **treat that deletion as the point of no return** and take it only when the release has settled.

## What was never at risk

`main`, the Base44 database, entity access rules, the RP economy constants, and the `404x1.xyz` DNS. No secret value was ever committed, so there is no credential to scrub from history.
