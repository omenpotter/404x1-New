# Technical SEO — Audit and Implementation

## Indexing eligibility rules (deterministic)

| Site | Indexable | Noindex (follow) | Never canonical |
|---|---|---|---|
| X1 Space | 12 list pages + `/Learn`; `/ValidatorDetail?id=<well-formed pubkey>` | Search, Watchlist, Portfolio, CustomDashboard, OAuthConsent, ValidatorAlerts, AddressLookup, Block/Transaction/Flow detail, ValidatorCompare; ValidatorDetail with missing/invalid id or not-found record | any other query string (`?mint=`, `?q=`, `?page=`) |
| X1 Nexus | Launchpad `/` + 11 pages | Admin, Dashboard, UserProfilePage, TokenReports (UGC), FairLaunchDetail (per-token, unverified legitimacy), Presale, PresaleLegacy, X1TokenLauncher | `/Minting`, `/Home`, `/index` → canonical `/` |
| 404X1 | `/`, `/Docs`, `/Game` | Chat, Leaderboard, Messages, Profile, ModPanel, ModerationLogs, OAuthConsent | — |
| Pump X1 | `/`, `/token/`, `/market/`, `/community/` | preview deployments (pre-existing header) | `/api/*` disallowed |
| Leader Slot Checker | `/`, `/guide` | `/?validator=…` (JS sets noindex; canonical stays `/`), 404 page | `/api/*` disallowed + `X-Robots-Tag: noindex` |

Validator entity bound: the sitemap lists only current, staked vote accounts (336 on 2026-11-20); `scripts/generate-sitemaps.mjs` regenerates it with one read-only RPC call. Arbitrary addresses, transactions and tokens are never advertised, so crawlers cannot be pushed into infinite URL spaces through the sitemap.

## Per-site implementation

| Item | X1 Space | X1 Nexus | 404X1 | Pump X1 | LSC |
|---|---|---|---|---|---|
| Unique titles | ✅ (approved titles kept) | ✅ | ✅ | ✅ template | ✅ |
| Descriptions | ✅ all indexable | ✅ | ✅ | ✅ | ✅ |
| Canonical | ✅ case-normalised | ✅ case-normalised, home aliases | ✅ | ✅ trailing-slash | ✅ static |
| Robots meta | ✅ | ✅ | ✅ | ✅ | ✅ |
| OG/Twitter | ✅ title/desc/url per route | ✅ | ✅ | ✅ + new image | ✅ + new image |
| robots.txt | kept + sitemap | rewritten | rewritten | new (`app/robots.ts`) | new |
| Sitemap | index → pages + validators | 12 URLs | 3 URLs | `app/sitemap.ts` | 2 URLs |
| 404 handling | client noindex (200 from platform) | client noindex | client noindex | real 404 | real 404 (`404.html`) |
| Redirects | platform `www`→apex 301 ✅ | same ✅ | same ✅ | apex→www **307** (owner: make 308) ; `/x`→`/x/` 308 ✅ | `/guide.html`→`/guide`, `/index`→`/` 308 |
| `lang`, semantic structure, single H1 | ✅ (existing) | ✅ | ✅ | ✅ | ✅ (tested) |

## Rendering
- **SSR/static:** Pump X1 (Next SSG), Leader Slot Checker (static HTML with full educational text; live data via JS).
- **Client-rendered on Base44:** X1 Space, X1 Nexus, 404X1. No framework change (would be a rebuild). Base44 injects a server-side page list and its own title/description; per-route values are applied client-side. Owner should align Base44 dashboard SEO fields with the new titles (see owner actions).

## Blockchain-specific route evaluation

| Route type | Platform | Decision | Reason |
|---|---|---|---|
| Validators | X1 Space | **Index** (bounded set) | Meaningful, stable entity; on-chain facts; ~336 URLs |
| Blocks / transactions | X1 Space | Noindex | Unbounded, ephemeral, thin individually |
| Wallets / addresses | X1 Space | Noindex | Unbounded; privacy |
| Tokens (`?mint=`) | X1 Space | Consolidate to `/TokenExplorer` | Anyone can mint tokens; legitimacy not assessed |
| Liquidity pools | X1 Space | List page only | Detail is a drawer, not a URL |
| Launches (`FairLaunchDetail`) | X1 Nexus | Noindex (owner may opt in) | Third-party tokens; avoid endorsing via index |
| Leader schedules (`?validator=`) | LSC | Noindex, canonical `/` | Live, per-user; prevents duplicate pages |
| Network statistics | X1 Space | Index `/NetworkHealth` | Stable URL, live data |
| Developer docs | X1 Space, LSC, Nexus | Index (`/ApiDocs`, `/guide`, `/Docs`) | Durable content |
| Stake accounts, graduation records | — | Not implemented | No such public routes exist |
