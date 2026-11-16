# Vercel Preview Setup (`404x1-preview`)

**Status: NOT deployed.** The Vercel MCP connector failed to connect in this session (proxy 403) and there is no Vercel CLI credential here. The branch is prepared; the owner must create the project.

## What is in the repo
`vercel.json`: Vite build (`npm ci`, `npm run build`, output `dist`), SPA rewrite to `/index.html` (excluding `/assets/`), `X-Robots-Tag: noindex`, nosniff, frame deny, immutable asset caching. No redirects, no domains.

## Owner steps (manual)
1. Vercel → New Project → import `omenpotter/404x1-New` → name it **`404x1-preview`** (a *new, separate* project; do not use the project that serves 404x1.xyz).
2. Settings → Git: **Production Branch = `claude/404x1-upgrade`** (so `main` is never the release source), and disable auto-deploy of `main` (Ignored Build Step: `[ "$VERCEL_GIT_COMMIT_REF" != "claude/404x1-upgrade" ]`). Add no custom domain; keep the `*.vercel.app` URL.
3. Settings → Deployment Protection: enable Vercel Authentication (preview is for the owner only).
4. Environment variables (all non-secret):
   - `VITE_PREVIEW_READ_ONLY=true` — client-side guard: only `chatHistory`, `chatSearch`, `gameLeaderboard`, `xdexProxy` and entity reads are allowed; every other function/write is rejected before leaving the browser.
   - `VITE_BASE44_APP_BASE_URL` — the Base44 app URL, only if you want the preview to read live data. Without it, backend calls have nowhere to go and the chart (which only needs the public X1 RPC) still works.
   - Do **not** add `TELEGRAM_*`, `CRON_SECRET`, Base44 tokens or any secret; `VITE_*` values are public in the bundle. Verified: build output contains none of these strings.
5. Base44 backend dependencies (unchanged, production-hosted): functions listed in `base44/functions/*`, entities in `base44/entities/*`, secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`, `LAUNCH_DATE`, `STRESS_TEST_ENABLED`. The preview does not deploy any of them. The `xdexProxy` hardening in this branch only takes effect when you deploy functions via Base44 (not done).
6. The preview origin must be allowed by the Base44 app's CORS/OAuth settings if you want authenticated testing; wallet login on the preview would create sessions in production data, so with the read-only guard it is deliberately blocked.

## Safety properties
- Distinct project/URL, noindex, no domain attached, not built from `main`.
- Read-only guard blocks writes client-side. **Guard not exercised against a real backend**; it was only confirmed that the app builds and the chart page loads with the flag on. Server-side protection must still come from Base44 rules.
