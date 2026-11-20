# Owner-Only Actions (consolidated, all five sites)

Everything below needs your accounts, DNS, dashboards or explicit approval. Ordered by priority.

## A. Approvals and publishing
1. **Leader Slot Checker** — review the redesign (screenshots in `docs/screenshots/{before,after}`), confirm Vercel's production branch, merge `claude/bold-ritchie-g1l48h` → `main`. Re-run `npm run test:live` against production afterwards.
2. **Pump X1** — approve the software-WebGL fallback (static logo instead of emulated globe on non-GPU devices), then merge.
3. **X1 Space / 404X1** — merge, then **Publish** in Base44.
4. **X1 Nexus** — complete the Base44 sync isolation procedure first (docs/release/BASE44_SYNC_ISOLATION.md), then merge/publish. Graduation signing, financial restrictions and freezes remain as they are.

## B. Search engine accounts (cannot be done without your login/DNS)
5. **Google Search Console** — add Domain properties for `x1space.xyz`, `x1nexus.xyz`, `404x1.xyz`, `pumpx1.xyz` (DNS TXT), and a URL-prefix property for `https://x1-leader-slot-checker.vercel.app/` (HTML tag or file — send me the token and I will add it). Submit: `x1space.xyz/sitemap.xml`, `x1nexus.xyz/sitemap.xml`, `404x1.xyz/sitemap.xml`, `www.pumpx1.xyz/sitemap.xml`, `x1-leader-slot-checker.vercel.app/sitemap.xml`.
6. **Bing Webmaster Tools** — import from Search Console (or verify via DNS/XML file); submit the same sitemaps.
7. **IndexNow** (Bing/Yandex/Seznam/Naver; Google does not participate) — optional. Requires a key file hosted on each domain; provide/approve a key and I will add it and a submit script. Do **not** use Google's Indexing API (it is only for JobPosting/BroadcastEvent pages).
8. After indexing (2–8 weeks): review Search Console Coverage (expect validator URLs to index gradually), Core Web Vitals, and query data to validate the low-confidence keyword clusters.

## C. Platform and DNS settings
9. **Base44 SEO settings** (each of the three apps): set the site title/description to match the new home titles; upload a 1200×630 social image. Base44 overrides repo `<title>`/description server-side, which is what non-JS crawlers see.
10. **Base44 soft 404s and case duplicates** — unknown routes return HTTP 200 and `/validators` vs `/Validators` both resolve. Client-side noindex/canonical mitigate this; a true 404 status or case redirect needs platform support — ask Base44 whether custom 404 status/redirect rules are possible.
11. **Pump X1**: in Vercel → Domains, change `pumpx1.xyz → www.pumpx1.xyz` from **307 (temporary)** to **308 (permanent)**.
12. **LSC custom domain** (optional): if you add one, update the canonical/OG URLs (`index.html`, `guide.html`, `robots.txt`, `sitemap.xml`, `llms.txt`) and add a redirect from the vercel.app host.
13. Confirm whether `/llms.txt` from the repo overrides Base44's auto-generated file after publishing.

## D. Content decisions
14. **ARKBS Labs identity**: confirm the official site (e.g. arkbslabs.com) and social profiles to add as Organization `url`/`sameAs` (currently only `x.com/rkbehelvi`, the account all sites link).
15. **Pump X1 supply display**: "Fixed supply 18,446,744,073" vs current on-chain 18,444,229,684.27 — keep (minted amount) or show live supply.
16. **X1 Nexus `FairLaunchDetail`**: currently noindex. Opt in only if you want individual launches in search (consider legitimacy/scam-association risk).
17. **404X1 Docs** state "No admin keys"; the token's metadata update authority is set — consider rewording.
18. Re-run `node scripts/generate-sitemaps.mjs` in X1 Space when the validator set changes materially (monthly is enough).

## E. Monitoring to enable
19. Vercel Speed Insights for LSC and Pump (dependency present in LSC; enable in dashboard) for field CWV.
20. Search Console email alerts for coverage and CWV regressions.
