# Baseline Audit — ARKBS Labs X1 Ecosystem (5 sites)

Captured 2026-11-20 before any change. **LIVE** = observed on the production URL from this session; **SOURCE** = read from `main` in the repository. Backups: every repository's pre-change state is `main` (unchanged; all work is on `claude/bold-ritchie-g1l48h`).

## 1. Identity, hosting and deployment (verified)

| Site | Repository | Production URL (LIVE) | Host (LIVE) | Framework (SOURCE) | Deploys from |
|---|---|---|---|---|---|
| X1 Space | `omenpotter/X1Space-Explorer-new` | https://x1space.xyz (`www` → 301 apex) | Base44 behind Cloudflare | React 18 SPA, Vite, Base44 SDK | Base44 two-way GitHub sync on `main`, then Publish in Base44. `vercel.json` exists but production is **not** Vercel. |
| X1 Nexus | `omenpotter/Nexus-ARKBS` | https://x1nexus.xyz (`www` → 301 apex) | Base44 behind Cloudflare | React SPA, Vite, Base44 SDK + off-platform services | Base44 sync on `main`; backend functions may go live on sync (docs/release/BASE44_SYNC_ISOLATION.md). |
| 404X1 | `omenpotter/404x1-New` | https://404x1.xyz (`www` → 301 apex) | Base44 behind Cloudflare | React SPA, Vite, Base44 SDK | Base44 sync on `main`. `vercel.json` (with `X-Robots-Tag: noindex`) only affects a Vercel copy, not production. |
| Pump X1 | `omenpotter/pump-x1` | https://www.pumpx1.xyz (apex → **307** www) | Vercel | Next.js 16 App Router (SSG + API routes) | Vercel Git integration (production branch assumed `main`; owner to confirm). |
| X1 Leader Slot Checker | `omenpotter/x1-leader-slot-checker` | https://x1-leader-slot-checker.vercel.app | Vercel | Static HTML + Vercel edge function | Vercel Git integration (production branch assumed `main`). No custom domain found in repo or environment. |

**What the sites actually are (verified from source + chain):**
- **X1 Space** — independent X1 mainnet explorer/analytics (blocks, transactions, validators, tokens, XDEX pools, network health, JSON API).
- **X1 Nexus** — fair-launch launchpad (fixed 1B supply, single mint price in XNT, documented graduation to an xDEX pool), swap via xDEX pools, locks, vesting, token verification. Graduation live signing is **not activated** (dry-run).
- **404X1** — community platform for the **404 ERROR** Token-2022 meme token (`4o4Uhe…zPb2`): token dashboard, wallet sign-in, chat, DMs, arcade, reputation points.
- **Pump X1** — site for the **PUMP** Token-2022 community token (`Pumps1X…zb2C`): contract/tokenomics, XDEX market data, community links. *Not* a token launchpad.
- **X1 Leader Slot Checker** — read-only validator leader-schedule lookup.

## 2. Indexing and metadata (LIVE)

| Check | X1 Space | X1 Nexus | 404X1 | Pump X1 | Leader Slot Checker |
|---|---|---|---|---|---|
| robots.txt | repo file served | platform/older file (`Allow: /` + Sitemap) | `Allow: /`, no Sitemap line | **404** | **404** |
| sitemap.xml | 12 list pages (repo file) | 14 URLs incl. `/index`, `/Home` (dupes of `/`), `/UserProfilePage`, `/FairLaunchDetail` | 9 URLs incl. `/ModPanel`, `/ModerationLogs`, `/Messages`, `/Profile` | **404** | **404** |
| llms.txt | platform-generated, generic ("Main page") | platform-generated | platform-generated | 404 | 404 |
| Server title | platform: "Validators \| X1Space Explorer" | platform: "Token Discovery \| X1Nexus Launcher" | platform: "Docs \| 404x1" | Next SSR, good | single static title |
| Canonical | platform injects self-canonical per path | same | same | Next per page | **none** |
| Unknown route status | **200** (soft 404) | **200** | **200** | 404 (real) | 404 |
| Case duplicates | `/validators` and `/Validators` both 200, each self-canonical server-side | same pattern | same | n/a | n/a |
| JSON-LD | platform generic `WebSite`+`Organization` (name only) | same | same | none | none |
| Server-visible body | platform `<noscript>`-style page list with generic text | same | same | full SSR | short static page |
| OG image | platform default 1200×630 | platform default | square icon | square 1024 logo | none |

Client-side (SOURCE): X1 Space already corrected title/canonical/robots per route (`src/lib/pageMeta.js`, tested). Nexus set a fixed title "X1Nexus Launcher" on every route. 404X1 had a **static canonical to `/` in index.html**.

## 3. Performance baseline (LIVE, Lighthouse 12.6, simulated throttling)

| Site | Mobile P / A / BP / SEO | Mobile LCP · TBT · CLS | Desktop P / A / BP / SEO |
|---|---|---|---|
| X1 Space | 62 / 100 / 96 / 100 | 4.6 s · 180 ms · **0.25** | 95 / 100 / 96 / 100 |
| X1 Nexus | 80 / **78** / 96 / 100 | 3.8 s · 70 ms · 0 | 94 / 78 / 96 / 100 (CLS 0.128) |
| 404X1 | 78 / 100 / 100 / 100 | 4.5 s · 50 ms · 0 | 92 / 100 / 100 / 100 |
| Pump X1 | **56** / 100 / 96 / 100 | 2.8 s · **148,860 ms** · 0 | 60 / 100 / 100 / 100 |
| Leader Slot Checker | 83 / 92 / 100 / 100 | 4.6 s · 0 ms · 0 | 98 / 92 / 100 / 100 |

Field data (CrUX) was not available from this session; these are lab numbers.

## 4. Security headers (LIVE)

- Base44 sites: HSTS, `X-Frame-Options: DENY`, `Cache-Control: private, no-store` on HTML; CSP via `<meta>` on X1 Space only.
- Pump X1: full CSP, HSTS, XFO, nosniff, Referrer-Policy; preview deployments `noindex`.
- Leader Slot Checker: HSTS only (Vercel default). `/api/rpc` was an **open JSON-RPC proxy** with `Access-Control-Allow-Origin: *`, no method allowlist and `innerHTML` rendering of upstream error text.

## 5. Notable findings

1. Soft 404s and case-duplicate URLs on all three Base44 sites (platform behaviour; mitigated client-side, needs platform/owner action for true status codes).
2. Base44 overrides `<title>`/description/canonical server-side from dashboard settings; repo `index.html` titles never appear live.
3. Live x1nexus.xyz is running an **older build than repo `main`** (RC4 merged in git but not published in Base44): its accessibility failures do not exist in `main`.
4. Pump X1 mobile TBT 149 s: the three.js globe's continuous render loop on software-emulated WebGL.
5. Pump X1 shows "fixed supply 18,446,744,073.71"; on-chain supply is 18,444,229,684.27 (mint authority null, so only burns can change it).
6. Name collision risk: Google autocomplete pairs "x1 explorer" with **X1 EcoChain** and "x1 mainnet" with **BlockDAG X1** — unrelated networks.
7. Leader Slot Checker used Solana assumptions (400 ms fallback, "~2 days per epoch") that are wrong for X1 (216,000-slot epochs, ~365 ms observed slots).
8. Analytics present: Base44 analytics (3 sites), Vercel Analytics (Pump, LSC). **No** Search Console / Bing verification tags found in any repo or live HTML.
