# Baseline vs. After

"Before" = live production (Lighthouse 12.6, 2026-11-20). "After" = production build of the branch served locally (Next `start`, `vite preview`, or the Vercel-like dev server). **Not like-for-like:** local servers lack CDN compression and, for Base44 sites, the platform's injected runtime/analytics. Re-measure after deployment.

## Lighthouse (mobile · desktop) — Performance / Accessibility / Best practices / SEO

| Site | Before mobile | After mobile | Before desktop | After desktop |
|---|---|---|---|---|
| Leader Slot Checker `/` | 83 / 92 / 100 / 100 | **95 / 100 / 100 / 100** | 98 / 92 / 100 / 100 | **100 / 100 / 100 / 100** |
| Pump X1 `/` | 56 / 100 / 96 / 100 | **97 / 100 / 93\* / 100** | 60 / 100 / 100 / 100 | **98 / 100 / 96\* / 100** |
| X1 Space `/` | 62 / 100 / 96 / 100 | **79 / 100 / 96 / 100** | 95 / 100 / 96 / 100 | **99 / 100 / 96 / 100** |
| X1 Nexus `/` | 80 / 78 / 96 / 100 | 93 / 100 / 96 / 100† | 94 / 78 / 96 / 100 | 100 / 100 / 96 / 100† |
| 404X1 `/` | 78 / 100 / 100 / 100 | 82 / 100 / 96\* / 100 | 92 / 100 / 100 / 100 | 99 / 100 / 96\* / 100 |

\* Best-practices deductions locally are console errors from scripts that only exist in production (`/_vercel/insights`, platform runtime) or hosts blocked in this sandbox (`api.xdex.xyz`).
† Most of the Nexus delta comes from RC4 work already in `main` but **not yet published** to x1nexus.xyz (live is an older build), not from this SEO change.

## Core Web Vitals (lab)

| Site | LCP mobile before → after | TBT mobile before → after | CLS mobile before → after |
|---|---|---|---|
| Leader Slot Checker | 4.6 s → 2.8 s | 0 → 0 ms | 0 → 0 |
| Pump X1 | 2.8 s → 2.3 s | **148,860 → 30 ms** | 0 → 0.021 |
| X1 Space | 4.6 s → 4.3 s | 180 → 150 ms | **0.25 → 0.015** |
| X1 Nexus | 3.8 s → 2.9 s | 70 → 40 ms | 0 → 0.02 |
| 404X1 | 4.5 s → 3.9 s | 50 → 50 ms | 0 → 0.003 |

## Indexing hygiene

| Item | Before | After |
|---|---|---|
| Sites with robots.txt + sitemap | 3 / 5 | 5 / 5 |
| Private/admin/duplicate URLs in sitemaps | 8 (Nexus 4, 404X1 4) | 0 |
| Per-route descriptions | Pump (3 pages) only | all indexable pages on all 5 sites |
| Accurate per-page JSON-LD | none | all indexable pages |
| Static wrong canonical | 404X1 (all routes → `/`) | removed |
| Indexable entity pages | 0 | 336 X1 validators (X1 Space) |
| Unknown-route handling (Base44) | 200 + self-canonical | 200 + client `noindex, nofollow` + no canonical (true 404 status needs platform) |
| llms.txt accuracy | generic platform text | curated, fact-checked, on all 5 |
