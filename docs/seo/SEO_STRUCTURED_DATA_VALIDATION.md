# Structured Data — Coverage and Validation

## Entity graph
- `Organization` **ARKBS Labs** — `@id https://x1nexus.xyz/#arkbs-labs` on all five sites; `sameAs: https://x.com/rkbehelvi` (the X account each site already links as its own). No `url` except on Nexus pages (arkbslabs.com not verifiable from this session — owner action).
- `WebSite` per domain, `publisher` → Organization.
- `Thing` **X1 blockchain** — `url https://x1.xyz/`, `sameAs https://docs.x1.xyz/`. No ownership of X1, Solana or xDEX is claimed anywhere.
- `Thing` tokens — PUMP (`identifier` = `Pumps1XfLYk4DttvL4ai9WsKtqPvoT5DE3AsijSzb2C`), 404 ERROR (`4o4UheANLdqF4gSV4zWTbCTCercQNSaTm6nVcDetzPb2`); facts limited to on-chain-verified decimals/authorities.

## Coverage

| Site | Types |
|---|---|
| Leader Slot Checker | Organization, WebSite, WebApplication, WebPage, Thing, FAQPage; `/guide`: TechArticle, BreadcrumbList |
| Pump X1 | Organization, WebSite, Thing (X1, PUMP); per page WebPage + BreadcrumbList; `/token/` FAQPage |
| X1 Space | Organization, WebSite, Thing; WebPage or TechArticle (`/Learn`, `/ApiDocs`); WebApplication (home); BreadcrumbList (inner, incl. Validators › validator) |
| X1 Nexus | Organization, WebSite, Thing; WebPage/TechArticle (`/Docs`); WebApplication (home); BreadcrumbList |
| 404X1 | Organization, WebSite, Thing (token); WebPage/TechArticle (`/Docs`); BreadcrumbList |

Noindex and 404 routes emit **no** JSON-LD. Base44's generic builder JSON-LD is removed client-side and replaced.

## Validation performed
- **Syntax:** every JSON-LD block parsed with `JSON.parse` in automated tests (LSC E2E, Pump unit, X1 Space vitest + E2E, Nexus/404X1 unit) and in rendered pages via Playwright.
- **Safety:** all serializers escape `<`, U+2028, U+2029 (tests inject `</script>` payloads). Validator names (user-controlled, on-chain) only reach `document.title`/meta via DOM APIs, never HTML parsing.
- **Semantics:** FAQPage question text equals the visible `<summary>` text (LSC E2E asserts it); no `aggregateRating`, `review`, `award` or price/offer claims (asserted in tests on four sites).
- **Rich-result eligibility (honest):** FAQ rich results are limited by Google to authoritative government/health sites since 2023 — FAQPage is kept only because it accurately describes visible content. Breadcrumbs and Organization are eligible. SoftwareApplication/WebApplication rich results require ratings or offers we will not fabricate, so none are expected.
- **Not performed:** Google Rich Results Test / Schema.org validator web tools (not reachable from this sandbox) — owner action after deployment.
