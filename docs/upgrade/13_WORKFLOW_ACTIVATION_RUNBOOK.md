# Workflow Activation Runbook

Purpose: bring the four automated workflows online without a window in which a runner is deployed but unauthorised, and without ever enabling the stress test in production.

Nothing here has been executed. All four workflows are **inactive** today and stay that way until the owner runs this procedure on `main`.

## What is true before you start

- All four workflow definitions are unchanged on this branch and on `main` (verified: empty diff).
- Each of the four has a single step invoking its runner with **empty arguments**.
- The runners accept a dedicated `CRON_SECRET`, a staff wallet session, or a platform-admin identity. The Telegram bot token is no longer accepted anywhere.
- `CRON_SECRET` is not set, so the platform treats it as a required secret and refuses to run the runners at all.

## Order of operations (this order matters)

**Step 1 — set the secret first.**
Dashboard, Secrets, Add Secret. Name `CRON_SECRET`, value 32+ random characters (`openssl rand -hex 32`). Do not reuse the Telegram token. Do this before merging, so the very first deploy already has the secret present.

**Step 2 — set the launch date.**
Same page. Name `LAUNCH_DATE`, value the real launch date as `YYYY-MM-DD`. This is read by the RP conversion endpoint and also determines the halving rate.

**Step 3 — rotate the Telegram bot token** in BotFather and update `TELEGRAM_BOT_TOKEN` if it changed. Do this now, not later, so a single publish carries the new value.

**Step 4 — merge the branch into `main`.**
Functions deploy to the main environment at merge. Users are unaffected until publish.

**Step 5 — add the secret to each workflow.**
Workflows page, open each of the three production workflows, edit its single function step, and replace the empty arguments with:

```
{ "cron_secret": "${ .secrets.CRON_SECRET }" }
```

If the editor's expression form differs, pass the app secret directly in the step arguments. Apply to:

- Chat Moderator 24/7 Auto Patrol → `runChatModerator`
- Chat Admin 24/7 Escalation Review → `runChatAdmin`
- Daily Staff RP Rewards → `runDailyStaffRewards`

**Step 6 — activate those three, one at a time.**
Activate one, open its run history, confirm the first run succeeds, then move to the next. A runner that reports `Unauthorized` means the secret expression did not resolve; stop and fix before continuing.

**Step 7 — leave Stress Test Wave inactive.**
Do not add the secret to it and do not activate it. It writes bulk test rows into production tables and depends on `STRESS_TEST_ENABLED`. It is a load-testing tool, not a production workflow.

**Step 8 — publish**, then confirm in the moderation log that a real action was recorded with a plausible timestamp.

## Verification per workflow

| Workflow | Success looks like |
| --- | --- |
| Chat Moderator | A run appears at its schedule (every 30 min), and any flagged message shows a ModerationLog row authored by the moderator agent |
| Chat Admin | A run appears hourly; escalations it reviews are marked `already_reviewed` |
| Daily Staff RP Rewards | One run around 21:00 UTC; staff `reputation_points` rise by the configured reward, and an RpGrant records it |
| Stress Test Wave | Stays inactive; nothing to verify, by design |

## If a run reports Unauthorized

1. Confirm `CRON_SECRET` exists in Secrets and its value has no leading or trailing whitespace.
2. Confirm the step's arguments contain the secret, not an empty object.
3. As a fallback the platform-admin branch authorises a run triggered from the dashboard, which distinguishes "secret not passed" from "runner broken": if a manual run succeeds and the scheduled one fails, the step arguments are the cause.

## Deactivation

Any workflow can be paused from the same page without losing its definition. To stop everything, deactivate all four; that is also the rollback step in `ROLLBACK.md`.
