# Initial Audit (static; no live Base44 runtime access)

Base: `main` @ `f00d17cefa1fec84fe0d10599981bc28128b7680`. Reviewed: source, entity schemas, 38 backend functions, build tooling. **Not** reviewed at runtime: Base44 production, its database, entity-rule enforcement, the live site.

## Baseline tooling (before changes)
| Check | Result |
|---|---|
| `npm run build` | pass |
| `npm run lint` | pass (warnings only) |
| `npm run typecheck` | **fails, 64 pre-existing errors** (e.g. `OAuthConsent.jsx`, `Profile.jsx`); not touched this milestone except to add none |
| `npm audit` | 26 vulns (1 low, 8 moderate, 17 high, 0 critical) |
| unit tests | none existed |

## Findings
**Fixed this milestone**
- Coin graph (see COIN_GRAPH_ROOT_CAUSE.md).
- `xdexProxy`: endpoint now must start with `/api/`, 10 s upstream timeout, upstream failures return 502 instead of masquerading as data, non-JSON handled. Auth (session required) unchanged. *Not deployed or runtime-tested* (Base44 deploy not authorised).
- `index.html` title was "Base44 APP"; now a real title and description (SEO).
- Preview-only read-only guard (`VITE_PREVIEW_READ_ONLY`).

**Open — recommended for next milestone (not changed: risk to production data/behaviour)**
1. `chatHistory` has no auth, CORS `*`, uses service role, and spreads the whole `Message` record (`...msg`) into the response — verify no private fields leak. It also loads 500 messages + 1000 players + 1000 reactions per call (performance).
2. `authorizeCronOrAdmin` falls back to `TELEGRAM_BOT_TOKEN` as the cron secret — secret reuse; set a dedicated `CRON_SECRET`.
3. Session tokens are stored in plaintext on `Player` and kept in `localStorage` (XSS-exposed); hash at rest and consider httpOnly cookies.
4. 12 functions return `Access-Control-Allow-Origin: *`; restrict to 404x1.xyz (and the preview origin).
5. 135 `asServiceRole` uses across functions: authorisation relies entirely on each function's own checks; needs a per-function review.
6. Functions with no session check: `authWallet` (expected), `chatHistory`, `chatSearch`, `gameLeaderboard`, and cron/admin runners (which use `authorizeCronOrAdmin`).
7. Home price/holder code: `getProgramAccounts` for holders is heavy on public RPC; holder count shows N/A when it fails. Market cap uses a hard-coded supply (`404404`).
8. `index.html` references `/manifest.json` which does not exist in `public/` (404). No meta robots/OG tags; accessibility (chart has no text alternative, low-contrast #444 text) not reviewed in depth.
9. Dependencies: 25 vulns remain (mostly transitive: react-router, rollup, quill/dompurify, etc.); `npm audit fix` needs a regression pass.
10. Typecheck baseline is red (64 errors).
Pages not exercised in a browser against a real backend: Chat, Messages, Profile, Leaderboard, Game, ModPanel, ModerationLogs, OAuthConsent. Only Home was exercised (mocked RPC, backend calls aborted).
