# SEO Ecosystem Master Report — ARKBS Labs X1 sites

Date: 2026-11-20 · Branch in every repo: `claude/bold-ritchie-g1l48h` · **Nothing merged to `main`, nothing deployed.**

## Status legend
**IMPLEMENTED** = code committed and pushed · **TESTED** = automated tests pass locally/against live RPC · **DEPLOYED** = live on production · **INDEXED** = confirmed in a search index · **RANKING VERIFIED** = measured search-performance change.

| Site | Implementation commit | IMPLEMENTED | TESTED | DEPLOYED | INDEXED | RANKING VERIFIED |
|---|---|---|---|---|---|---|
| X1 Leader Slot Checker | `6b3b687` | ✅ | ✅ 33 unit · 16 E2E · live RPC cross-check | ❌ (needs merge → Vercel) | ❌ | ❌ |
| Pump X1 | `4c126c2` | ✅ | ✅ 27 unit · build · prod-server checks | ❌ | ❌ | ❌ |
| X1 Space | `4e01320` | ✅ | ✅ 413 unit · 15 SEO E2E · keyboard 7/7 | ❌ (needs Base44 sync + Publish) | ❌ | ❌ |
| X1 Nexus | `4dd7832` | ✅ | ✅ 157 unit · 21 base44 · 65 graduation · 30 E2E | ❌ (blocked: Base44 sync isolation) | ❌ | ❌ |
| 404X1 | `2d040cd` | ✅ | ✅ 94 unit · chart E2E | ❌ | ❌ | ❌ |

A docs-only commit adding this report set follows each implementation commit.

## Per-site summary

### X1 Leader Slot Checker (`omenpotter/x1-leader-slot-checker`)
Full redesign ("Validator Command Center") and functional upgrade: identity-filtered schedules (1.4 MB → ~1.6 KB per lookup), vote-account resolution, next-epoch schedule, warmup-aware epoch math, slot-time estimate from performance samples with an uncertainty band (empirically within band on mainnet; old 400 ms assumption was off by 3–10 s at 100–300 slots), live recalibration, production vs. schedule, timeline, paginated table, CSV/JSON export, share links, notifications. Hardened `/api/rpc` (allowlist, limits, same-origin), new CDN-cached `/api/leader` and `/api/clock`. SEO: canonical, OG/Twitter + 1200×630 image, JSON-LD (WebApplication, FAQPage, TechArticle, BreadcrumbList), robots, sitemap, llms.txt, `/guide`, real 404 page. Lighthouse mobile 83 → 95, a11y 92 → 100. Details: `docs/LEADER_SLOT_*.md`.

### Pump X1 (`omenpotter/pump-x1`)
Metadata template + per-page titles/descriptions, new OG image, `robots.ts`/`sitemap.ts` (were 404), JSON-LD with mint-address identifier, on-chain-verified token FAQ, contextual X1 Space/X1 Nexus links, llms.txt. Software-WebGL guard keeps the existing static fallback instead of the emulated globe: mobile performance 56 → 97, TBT 149 s → 30–40 ms (GPU devices unchanged — **owner review item**). Branding-lock hashes verified by test.

### X1 Space (`omenpotter/X1Space-Explorer-new`)
Extended existing per-route meta with descriptions, OG/Twitter, per-route JSON-LD (replaces platform's generic block); deterministic validator entity indexing (336 staked validators in a sitemap index, self-canonical, noindex when missing); new `/Learn` explorer guide; contextual links to Leader Slot Checker and X1 Nexus; CLS fix (mobile 0.286 → 0.015). No `base44/` changes.

### X1 Nexus (`omenpotter/Nexus-ARKBS`)
Frontend-only per-route meta and JSON-LD; sitemap cleaned to 12 indexable pages; admin/wallet/profile/UGC/per-token/legacy pages noindex; wallet identity tags untouched; copy avoids automation claims because graduation signing is not live. No changes to `base44/`, `services/`, `contracts/`, `ops/`, `shared/`, `env/`. **Merge blocked** by the documented Base44 sync isolation requirement.

### 404X1 (`omenpotter/404x1-New`)
Per-route meta and JSON-LD; removed a static homepage canonical; sitemap no longer lists moderation/private pages; robots disallows moderation/OAuth; token entity from verified mint; X1 Space link on contract card. No `base44/` changes.

## Ecosystem
One shared Organization node (`https://x1nexus.xyz/#arkbs-labs`, `sameAs` the X account all five sites link to) referenced as publisher from every site; consistent `X1 blockchain` entity citing x1.xyz / docs.x1.xyz; distinct intent ownership (see `SEO_KEYWORD_OWNERSHIP_MATRIX.md`); six contextual cross-links, no sitewide link blocks.

## What remains (owner-only) → `SEO_OWNER_ONLY_ACTIONS.md`
Merges/publishing, Search Console + Bing verification, sitemap submission, Base44 SEO dashboard fields, Pump apex redirect 307 → 308, Base44 soft-404/case-duplicate behaviour, confirming arkbslabs.com for the Organization `url`.
