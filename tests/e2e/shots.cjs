// Screenshot every route at desktop/tablet/mobile. Usage: node tests/e2e/shots.cjs <prefix> [port]
// X1 RPC requests are forwarded read-only to the real network (relayed via Node); Base44 backend calls are aborted (no writes possible).
const { chromium } = require('playwright'); const fx = require('./backend-fixtures.cjs'); const AUTH = !!process.env.AUTH; const { spawn } = require('node:child_process');
const prefix = process.argv[2] || 'after', port = process.argv[3] || '4173';
const PAGES = ['Home', 'Chat', 'Messages', 'Game', 'Leaderboard', 'Docs', 'Profile', 'ModPanel', 'ModerationLogs'];
const VPS = { desktop: { width: 1440, height: 900 }, tablet: { width: 768, height: 1024 }, mobile: { width: 390, height: 844 } };
(async () => {
  const srv = process.env.NOSERVE ? null : spawn('npx', ['vite', 'preview', '--port', port, '--strictPort'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 3000));
  const b = await chromium.launch(); const errs = [];
  for (const [vn, vp] of Object.entries(VPS)) {
    const ctx = await b.newContext({ viewport: vp }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(`${vn}: ${e.message}`));
    await page.route(/rpc\.(mainnet\.x1\.xyz|x1galaxy\.io)/, async route => { const q = route.request(); const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
      if (q.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: H });
      try { const r = await fetch(q.url(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: q.postData() }); route.fulfill({ status: r.status, headers: { ...H, 'content-type': 'application/json' }, body: await r.text() }); } catch (e) { route.fulfill({ status: 502, headers: H, body: String(e) }); } });
    if (AUTH) await fx.install(page); else await page.route(/api\.xdex|\/api\/apps|functions|base44\.app/, r => r.abort());
    for (const p of PAGES) {
      await page.goto(`http://localhost:${port}/${p === 'Home' ? '' : p}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(p === 'Home' ? 9000 : 1800);
      await page.screenshot({ path: `docs/upgrade/screenshots/phase2/${prefix}-${p}-${vn}.png`, fullPage: p === 'Home' });
      console.log('shot', prefix, p, vn);
    }
    await ctx.close();
  }
  console.log('page errors:', errs.length, errs.slice(0, 5)); await b.close(); srv && srv.kill();
})();
