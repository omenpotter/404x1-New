# Generative & Answer Engine Optimisation (GEO / AEO)

No AI search system publishes a ranking algorithm, and they do not share one. The work below improves the inputs all of them rely on: crawlable text, clear entities, direct answers, citations, stable URLs and accurate structured data. **No hidden text, cloaking, prompt injection or "AI-only" content was added.**

## Implemented (by principle)

| Principle | Implementation |
|---|---|
| Clear entity definitions | Shared Organization node (ARKBS Labs); `X1 blockchain` Thing (url x1.xyz, sameAs docs.x1.xyz); token entities with **mint address as identifier** (PUMP, 404 ERROR); Leader Slot Checker glossary (`DefinedTerm`-style `<dl>`). |
| Concise summaries | "In short" callouts at the top of LSC `/guide` and X1 Space `/Learn`; one-sentence descriptions per page. |
| Direct answers to real questions | LSC FAQ (8 Q&As incl. "What is an X1 leader slot?", "How long is an X1 epoch?", "Why might estimates differ?"), Pump token FAQ (6, on-chain verified), existing Nexus Docs FAQ preserved. FAQ schema text matches visible text exactly (tested). |
| Disambiguation | X1 Space `/Learn#names`: X1 ≠ X1 EcoChain ≠ BlockDAG X1 (collisions observed in autocomplete). Mint addresses in llms.txt/JSON-LD disambiguate PUMP and 404 from same-named tokens. |
| Transparent data sources | Every guide ends with Sources; LSC shows `rpc.mainnet.x1.xyz`, methodology and the exact RPC calls; Pump/404 llms.txt state verification date and method. |
| Stable URLs | Canonicals on every indexable page; validator entity URLs deterministic; query-string URLs never become canonical except the validated validator id. |
| Timestamps | `dateModified`/`datePublished` on TechArticles; visible "Updated 20 November 2026"; sitemaps carry `lastmod`. |
| Authorship & attribution | "By ARKBS Labs" on guides; publisher/author refs in JSON-LD; independence statements ("not affiliated with the X1 core team / xDEX"). |
| Authoritative citations | docs.x1.xyz (intro, zero-cost votes, dynamic fees, validator rewards, leader selection roadmap, RPC limits), Solana RPC and Token Extensions docs. |
| Crawlable without wallets | LSC and Pump content is static/SSR HTML; Base44 sites render content client-side without any wallet requirement (Google renders JS; some AI crawlers do not — see limitation). |
| Accuracy over claims | Corrected Solana-derived assumptions (epoch length, slot time); removed "automatic graduation" wording; did not repeat unverifiable "no admin keys"; validator names labelled self-published. |

## llms.txt (experimental, optional)
Curated `llms.txt` on all five sites (three replace Base44's auto-generated, generic file — whether the static file takes precedence over the platform's must be confirmed after publishing). Treated as a convenience, not a ranking mechanism.

## Limitation: client-rendered Base44 pages
X1 Space, X1 Nexus and 404X1 deliver one HTML shell; their meaningful text and per-page meta appear after JavaScript runs. Googlebot and Bingbot render JavaScript; several AI crawlers fetch raw HTML only and will see Base44's server-injected title/description and page list. Mitigations available to the owner: (1) set accurate titles/descriptions in Base44's SEO settings (owner-only), (2) keep llms.txt current, (3) if Base44 ever offers prerendering/SSR, enable it. A framework migration was not done (out of scope, high risk).
