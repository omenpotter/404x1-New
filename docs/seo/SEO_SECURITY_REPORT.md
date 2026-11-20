# SEO Security and Quality Review

| Risk | Finding / mitigation |
|---|---|
| XSS via structured data | All JSON-LD serialisers escape `<`, U+2028, U+2029; Base44 sites insert via `textContent`; tests inject `</script>` payloads. |
| User-controlled metadata | Only on-chain validator names reach titles (X1 Space, LSC): control chars stripped, length-capped, set via DOM APIs. Validator websites only rendered if `http(s)` and given `rel="noopener nofollow ugc"`. |
| Canonical injection | Canonicals built from an allowlist of page names; the only query value admitted is a regex-validated base58 id. Hostile ids tested (`<script>`, invalid chars) → noindex, canonical unchanged. |
| Unsafe dynamic URLs / open redirects | No redirect endpoints added. External links use `noopener noreferrer`; dynamic links use `encodeURIComponent`. |
| Sitemap poisoning | Sitemaps are static files; the validator sitemap is generated from RPC with pubkey validation and positive-stake filter. No user input reaches sitemaps. |
| Excessive RPC from crawlers | LSC API responses `X-Robots-Tag: noindex`, `/api/` disallowed, CDN-cached; validator pages on X1 Space reuse the app's existing cached data hooks (no new RPC paths). |
| Open proxy (pre-existing, LSC) | **Fixed:** read-method allowlist (no send/simulate/airdrop/getProgramAccounts), ≤4 calls, ≤4 KB, filtered schedules only, upstream timeout + bounded retry, wildcard CORS removed, errors no longer rendered with `innerHTML`. |
| CSV export | Formula-injection neutralised (`=`, `+`, `-`, `@` prefixed). |
| Sensitive exposure | No secrets, tokens or internal endpoints in any diff (scanned). Admin/moderation/OAuth pages noindex and disallowed. |
| SSR/caching | Pump pages are static; LSC caches only public chain data; no per-user data in cached responses. |
| CSP | LSC now ships a strict CSP (no inline styles, same-origin connect). Pump CSP unchanged. |
| Existing protections | Not weakened: Nexus freeze/spending guards, Base44 functions, wallet flows, rate limits untouched; no `base44/`, `services/`, `contracts/`, `ops/` changes. |
| Financial safety | No transactions signed or broadcast, no programs upgraded, no tokens moved, no graduation activated. All chain interaction was read-only RPC. |
