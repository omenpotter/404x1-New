# Rollback

Nothing in this milestone touches `main`, Base44 production, its database or `404x1.xyz`. Rollback is therefore only about the development branch.

- Production source preserved at `main` = `f00d17cefa1fec84fe0d10599981bc28128b7680` (tag it: `git tag pre-upgrade-f00d17c f00d17c && git push origin pre-upgrade-f00d17c` — not done here).
- Discard this work: delete branch `claude/404x1-upgrade` and the Vercel project `404x1-preview`.
- Revert only the chart: `git revert <chart commit>` restores `public/chart.html` and the iframe flow (known-defective; see root cause).
- Browser caches: the new cache key is `xchart_trades_v3`; the legacy `chart_trades_cache_v2` is left untouched and harmless. Users can clear either.
- When eventually promoting to Base44, redeploy the previous `main` commit via Base44 to roll back; backend function `xdexProxy` changes are independent and revertable by file.
