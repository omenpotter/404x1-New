# Workflow Automation Authentication — Required Changes

Status: code on this branch is ready; the workflow-side change below is a **main-branch, owner action** (workflows cannot be edited from a feature branch). Until it is done, nothing runs, because all four workflows are currently **inactive**.

The step-by-step activation order, including which workflows to enable and the standing decision that Stress Test Wave stays disabled in production, is in `13_WORKFLOW_ACTIVATION_RUNBOOK.md`.

## What changed

Automated runners (`runChatModerator`, `runChatAdmin`, `runDailyStaffRewards`, `runStressTest`, `runSecurityAudit`) no longer accept the Telegram bot token as an authorisation key. `authorizeCronOrAdmin()` in `base44/shared/session.ts` accepts exactly three things:

| Mode | Credential | Who sends it |
| --- | --- | --- |
| `cron` | `cron_secret` body field equal to the `CRON_SECRET` secret (constant-time compare) | scheduled workflow steps |
| `admin` | `session_token` whose Player has `user_role` of `admin` or `superuser` | staff using the dashboard |
| `platform` | platform admin identity (`base44.auth.me().role === 'admin'`) | dashboard "Run" button, platform-scheduled invocation |

Why: a messaging credential that also authorises the moderation and economy surface is a single point of compromise. Rotating the bot token would have required changing every runner, and leaking it would have granted far more than alerting.

## Required change per workflow

Current state of every step in all four workflows: the function is invoked with **empty arguments** (`{}`). Under the new rules that request is rejected unless the platform supplies an admin identity.

Preferred fix — pass the secret explicitly, in each `call` step:

```jsonc
"arguments": {
  "cron_secret": "${ .secrets.CRON_SECRET }"
}
```

If the expression form is unavailable, use the app secret directly in the step arguments from the workflow editor.

Acceptable alternative — rely on the `platform` branch: platform-scheduled invocation carries an admin identity, so an empty payload still authorises. This is the fallback already implemented, but it removes the explicit secret check, so prefer the explicit secret.

## Precondition before the workflows can run at all

`CRON_SECRET` must exist as an app secret. The runners reference it, so the platform reports it as a required secret and refuses to run them until it is set. Per the owner's instruction this is deferred to final release preparation; it is recorded as blocker **B1** in `12_PRODUCTION_READINESS_REPORT.md`.

Suggested value: 32+ random characters, e.g. `openssl rand -hex 32`. Do not reuse `TELEGRAM_BOT_TOKEN`. If the Telegram token was ever used as the automation secret, rotate it in BotFather as a precaution; `TELEGRAM_CHAT_ID` is not sensitive.

## Verification performed on this branch

- `gameStats` with no credential → **401** (auth gate live).
- `chatHistory` with no credential → **200** (public feed intentionally open).
- `chatSend`, `spendRp`, `gameStart`, `playerSearch`, `xdexProxy` with no credential → **401**, and `xdexProxy` rejects before any upstream request.
- `logout` with no session → **200** `{ success: true }` (idempotent).
- `convertRp` could not be exercised: the platform refuses to run it while `LAUNCH_DATE` is unset (blocker **B2**). Its authentication logic is unchanged and was not part of that change.

## Rollback for this item

Revert `authorizeCronOrAdmin()` in `base44/shared/session.ts` to accept `TELEGRAM_BOT_TOKEN` as the cron secret. No schema or workflow change is needed for the rollback, and the `platform` branch already covers dashboard invocation.
