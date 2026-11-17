# Upgrade Documentation — Index

Twelve technical reports plus the consolidated production readiness report. Read the readiness report first; it references the others and lists the blockers.

| # | Report | Answers |
| --- | --- | --- |
| — | **`12_PRODUCTION_READINESS.md`** | Go/no-go, blockers, risks, release checklist |
| 1 | `INITIAL_AUDIT.md` | What state the app was in when the upgrade began |
| 2 | `PHASE_2_REDESIGN_REPORT.md` | The visual system rebuild: layout, nav, page structure |
| 3 | `PHASE_2_REGRESSION_REPORT.md` | Proof the redesign did not break existing behaviour |
| 4 | `DESIGN_SYSTEM.md` | Tokens, typography, spacing, component rules, do-nots |
| 5 | `05_QA_REGRESSION.md` | Typecheck, tests, build, auth probes, live mainnet run, responsive audit |
| 6 | `LIVE_MARKET_DATA_REPAIR.md` | How the price chart and market data were made correct |
| 7 | `COIN_GRAPH_ROOT_CAUSE.md` | Root cause of the token graph defect and why the fix holds |
| 8 | `PHASE_3_SECURITY_REPORT.md` | Identity model, tokens at rest, CORS allowlist, automation auth |
| 9 | `09_WORKFLOW_AUTH_MIGRATION.md` | The cron secret change, and the exact workflow edits required |
| 10 | `10_SESSION_COMPATIBILITY.md` | Whether existing sessions survive token hashing (they do) |
| 11 | `11_PERFORMANCE_REPORT.md` | Bundle measurements before/after, and what was deliberately not changed |
| 12 | `ROLLBACK.md` | How to reverse the branch safely, in order, per stage |
| 13 | `13_WORKFLOW_ACTIVATION_RUNBOOK.md` | Exact order for secrets and workflow activation; Stress Test stays off |

Supporting material:

- `RESPONSIVE_TEST_RESULTS.md` — earlier full breakpoint matrix, with raw output in `live/responsive-results.json`.
- `TEST_RESULTS.md` — unit and integration results from the phase 2 window.
- `VERCEL_PREVIEW_SETUP.md` — preview deployment configuration.
- `live/live-verify.json` — machine-readable proof of the mainnet checks (24/24).
- `screenshots/` — visual evidence captured during the redesign.

## Reading order by role

- **Owner deciding whether to ship:** `12_PRODUCTION_READINESS.md`, then the two blocker reports it cites (9 and 10).
- **Developer picking the work up:** 1 → 8 → 11, then the index entries for whatever area you are touching.
- **Reviewer checking the security claims:** 8 → 9 → 10 → 5 (section 2).
