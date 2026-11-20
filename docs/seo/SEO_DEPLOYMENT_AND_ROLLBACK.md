# Deployment and Rollback

Nothing was merged or deployed. Each repository has its pre-change state on `main` (unchanged) — that is the backup.

| Site | Branch head (impl.) | Base (`main`) | How production updates | Merge decision |
|---|---|---|---|---|
| LSC | `6b3b687` | `58df1f3` | Vercel auto-deploys the production branch (default `main`) | **Owner approval required** — redesign must not publish without it |
| Pump X1 | `4c126c2` | `900250a` | Vercel auto-deploy from `main` | Owner approval (visible change on software-WebGL devices) |
| X1 Space | `4e01320` | `906ae12` | Base44 two-way sync on `main` → Publish in Base44 | Owner: merge, then Publish; no backend files changed |
| X1 Nexus | `4dd7832` | `f30a185` | Base44 sync on `main`; functions may go live on sync | **Blocked** until sync isolation (docs/release/BASE44_SYNC_ISOLATION.md). This SEO change touches no functions, but merging `main` would also carry whatever else is pending |
| 404X1 | `2d040cd` | `9f50dc3` | Base44 sync on `main` → Publish | Owner: merge, then Publish; no backend files changed |

## Release steps (per site)
1. Review the branch diff; for Vercel sites open the branch **preview** deployment.
2. Merge with a normal merge commit (no force-push).
3. Vercel: confirm the production deployment. Base44: open the app, verify the synced code, click **Publish**.
4. Post-deploy checks: `/robots.txt`, `/sitemap.xml`, `/llms.txt` return the new files; view-source/rendered `<title>`, canonical and JSON-LD on two routes; a 404 route shows `noindex`.
5. Submit sitemaps (see owner actions).

## Rollback
- **Vercel (LSC, Pump):** Deployments → previous production → *Instant Rollback*; or `git revert -m 1 <merge>` on `main`.
- **Base44 (X1 Space, 404X1, Nexus):** revert the merge on `main` (`git revert -m 1 <merge>`), let it sync, Publish; Base44 version history can also restore the prior published version.
- Targeted reverts: LSC `/api/rpc` CORS/allowlist (`api/rpc.js`), Pump globe guard (`softwareRenderer()` in `components/OrbCanvas.tsx`), X1 Space validator indexing (`ValidatorDetail` branch in `metaFor`, and `public/sitemap-validators.xml`).
