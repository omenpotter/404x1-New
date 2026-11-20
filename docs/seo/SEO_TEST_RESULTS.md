# Test Results — 2026-11-20

| Site | Suite | Command | Result |
|---|---|---|---|
| LSC | Unit (core + API on recorded X1 fixtures) | `npm test` | 33/33 ✅ |
| LSC | Browser E2E (Playwright) | `npm run test:e2e` | 16/16 ✅ |
| LSC | Live X1 Mainnet cross-validation (4 validators) | `npm run test:live` | all pass ✅ |
| Pump X1 | Unit incl. new SEO + branding-lock hash test | `npm test` | 27/27 ✅ |
| Pump X1 | Lint (`--max-warnings 0`), `tsc --noEmit`, `next build` | — | ✅ |
| Pump X1 | Prod server: status codes, robots, sitemap, canonical, JSON-LD, FAQ | manual script | ✅ |
| X1 Space | Vitest (existing 401 + 12 new SEO) | `npx vitest run` | 413/413 ✅ |
| X1 Space | SEO E2E (existing 12 + 3 new) | `node tests/e2e/seo.mjs` | 15/15 ✅ |
| X1 Space | Keyboard E2E | `node tests/e2e/keyboard.mjs` | 7/7 ✅ |
| X1 Space | General E2E | `node tests/e2e/run.mjs` | page renders pass on all viewports except **LPExplorer and token XDEX-status checks**, which fail because `api.xdex.xyz` is not reachable from this sandbox (pages not modified). Run cut at 500 s before writing its summary. |
| X1 Space | Lint / typecheck / build | — | ✅ (5 pre-existing lint warnings, unchanged) |
| X1 Nexus | Unit (157 incl. 8 new) · Base44 shared (21) · graduation (65) · E2E (30) | `npm run test:unit` etc. | all ✅ |
| X1 Nexus | Lint / build | — | ✅ · typecheck: 265 pre-existing errors on `main`, 0 added |
| 404X1 | Vitest (86 existing + 8 new) | `npx vitest run` | 94/94 ✅ |
| 404X1 | Chart E2E (mock) · lint · build · typecheck | — | ✅ |

## Not run / limitations
- No deployment (preview or production) was made; Vercel/Base44-specific behaviour (CDN caching, platform injection, static-file precedence for llms.txt) is untested.
- Live checks of api.xdex.xyz-dependent features impossible from this sandbox.
- Lighthouse measured locally without compression; CWV field data unavailable.
- Browser notifications (LSC) not exercised headlessly.
- Google Rich Results Test, Search Console URL Inspection: require deployment and owner accounts.
