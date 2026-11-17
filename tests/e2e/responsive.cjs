// Responsive + accessibility + console + reduced-motion suite for every route at the 9 required widths.
// X1 RPC is forwarded read-only to mainnet; Base44 backend is either aborted (logged-out) or replaced by TEST-ONLY fixtures (AUTH=1).
// Usage: NODE_USE_ENV_PROXY=1 node tests/e2e/responsive.cjs [--json out.json]
const { chromium } = require('playwright'); const { spawn } = require('node:child_process'); const fs = require('node:fs');
const AxeBuilder = require('@axe-core/playwright').default; const fx = require('./backend-fixtures.cjs');
const PAGES = ['Home', 'Chat', 'Messages', 'Game', 'Leaderboard', 'Docs', 'Profile', 'ModPanel', 'ModerationLogs', 'DoesNotExist'];
const WIDTHS = [[320, 640], [375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 900], [1920, 1080], [2560, 1440]];
const port = 4173; const out = { overflow: [], offscreen: [], consoleErrors: [], smallTargets: {}, axe: {}, reducedMotion: {}, nav: {} };
let fails = 0; const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? ' — ' + d : ''}`); if (!ok) fails++; };
async function rpcRoute(page) {
  await page.route(/rpc\.(mainnet\.x1\.xyz|x1galaxy\.io)/, async route => { const q = route.request(); const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (q.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: H });
    try { const r = await fetch(q.url(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: q.postData() }); route.fulfill({ status: r.status, headers: { ...H, 'content-type': 'application/json' }, body: await r.text() }); } catch (e) { route.fulfill({ status: 502, headers: H, body: String(e) }); } });
}
(async () => {
  const srv = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 3000));
  const b = await chromium.launch();
  for (const auth of [false, true]) {
    for (const [w, h] of WIDTHS) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768 }); const page = await ctx.newPage();
      const tag = `${auth ? 'auth' : 'anon'}@${w}`;
      page.on('pageerror', e => out.consoleErrors.push(`${tag} pageerror: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|status of (4|5)\d\d|App state check failed|websocket|WebSocket|socket\.io/.test(m.text())) out.consoleErrors.push(`${tag} console: ${m.text().slice(0, 160)}`); });
      await rpcRoute(page); if (auth) await fx.install(page); else await page.route(/api\.xdex|\/api\/apps|functions|base44\.app/, r => r.abort());
      for (const p of PAGES) {
        await page.goto(`http://localhost:${port}/${p === 'Home' ? '' : p}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(p === 'Home' ? 6000 : 1500);
        const r = await page.evaluate(() => {
          const vw = window.innerWidth, over = document.documentElement.scrollWidth - vw;
          const inScroll = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
          const off = [...document.querySelectorAll('body *')].filter(el => { const c = getComputedStyle(el); if (c.position === 'fixed' || c.display === 'none' || c.visibility === 'hidden') return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.right > vw + 2 && !inScroll(el); }).slice(0, 3).map(e => e.tagName + '.' + String(e.className).slice(0, 40));
          const small = [...document.querySelectorAll('a[href],button,input,select,textarea,[role=button]')].filter(el => { const b = el.getBoundingClientRect(), c = getComputedStyle(el); return b.width > 0 && b.height > 0 && c.visibility !== 'hidden' && el.closest('.ds-drawer:not(.open)') == null && (b.width < 24 || b.height < 24) && el.type !== 'hidden'; }).slice(0, 4).map(e => `${e.tagName}.${String(e.className).slice(0, 30)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
          return { over, off, small };
        });
        if (r.over > 1) out.overflow.push(`${tag} ${p}: +${r.over}px`);
        if (r.off.length) out.offscreen.push(`${tag} ${p}: ${r.off.join(', ')}`);
        if (r.small.length) (out.smallTargets[`${tag} ${p}`] = r.small);
      }
      if (w <= 430 || w === 768 || w === 1440) { // nav behaviour
        await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800);
        const burger = page.locator('.ds-burger'); const vis = await burger.isVisible();
        let ok = true; if (vis) { await burger.click(); await page.waitForTimeout(400); ok = await page.locator('.ds-drawer.open a').first().isVisible(); await page.keyboard.press('Escape'); await page.waitForTimeout(300); ok = ok && !(await page.locator('.ds-drawer.open').count()); } else ok = await page.locator('.ds-links').isVisible();
        out.nav[tag] = { burger: vis, ok }; 
      }
      await ctx.close();
    }
  }
  check('no horizontal page overflow (10 routes x 9 widths x logged-out/in)', out.overflow.length === 0, out.overflow.slice(0, 6).join(' | '));
  check('no element positioned off-screen outside a scroll container', out.offscreen.length === 0, out.offscreen.slice(0, 6).join(' | '));
  check('navigation works at every sampled width (burger/drawer/Escape or inline links)', Object.values(out.nav).every(n => n.ok), JSON.stringify(out.nav).slice(0, 200));
  check('no uncaught page errors / app console errors', out.consoleErrors.length === 0, [...new Set(out.consoleErrors)].slice(0, 5).join(' | '));
  const smallKeys = Object.keys(out.smallTargets); console.log(`INFO interactive elements <24px: ${smallKeys.length} page/width combos`, smallKeys.slice(0, 5).map(k => k + ' => ' + out.smallTargets[k].join('; ')));

  // accessibility (axe) — desktop + mobile, logged-out + logged-in fixtures
  for (const [auth, w, h] of [[false, 1440, 900], [false, 390, 844], [true, 1440, 900], [true, 390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage(); await rpcRoute(page); if (auth) await fx.install(page); else await page.route(/api\.xdex|\/api\/apps|functions|base44\.app/, r => r.abort());
    for (const p of PAGES.slice(0, 9)) {
      await page.goto(`http://localhost:${port}/${p === 'Home' ? '' : p}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(p === 'Home' ? 6000 : 1500);
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      for (const v of res.violations) { const k = `${v.impact}:${v.id}`; (out.axe[k] = out.axe[k] || { help: v.help, where: new Set(), nodes: 0 }); out.axe[k].where.add(`${auth ? 'auth' : 'anon'}@${w} ${p}`); out.axe[k].nodes += v.nodes.length; }
    }
    await ctx.close();
  }
  const axeSummary = Object.entries(out.axe).map(([k, v]) => ({ rule: k, help: v.help, nodes: v.nodes, pages: [...v.where].slice(0, 6) })); out.axe = axeSummary;
  const serious = axeSummary.filter(a => /^(critical|serious)/.test(a.rule));
  console.log('AXE (wcag2a/2aa/21aa) violations:'); for (const a of axeSummary) console.log(`  ${a.rule} x${a.nodes} — ${a.help} [${a.pages.slice(0, 3).join('; ')}]`);
  check('axe: no critical/serious violations', serious.length === 0, serious.map(s => s.rule).join(', '));

  // reduced motion
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); await rpcRoute(page); await page.route(/api\.xdex|\/api\/apps|functions|base44\.app/, r => r.abort());
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  const rm = await page.evaluate(() => ({ canvasHidden: getComputedStyle(document.querySelector('.ds-atmos canvas')).display === 'none', infinite: document.getAnimations().filter(a => a.playState === 'running' && (a.effect?.getTiming().iterations === Infinity) && a.effect.getTiming().duration > 5).length }));
  out.reducedMotion = rm; check('prefers-reduced-motion: rain hidden and no running infinite animations', rm.canvasHidden && rm.infinite === 0, JSON.stringify(rm)); await ctx.close();

  // keyboard: skip link + tab order reaches nav
  const c2 = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p2 = await c2.newPage(); await rpcRoute(p2); await p2.route(/api\.xdex|\/api\/apps|functions|base44\.app/, r => r.abort());
  await p2.goto(`http://localhost:${port}/Docs`, { waitUntil: 'domcontentloaded' }); await p2.waitForTimeout(1200); await p2.keyboard.press('Tab');
  const first = await p2.evaluate(() => document.activeElement?.className || ''); check('keyboard: first Tab stop is the skip link', /skip-link/.test(first), first);
  await p2.keyboard.press('Enter'); await p2.waitForTimeout(200); await c2.close();
  const jf = process.argv.indexOf('--json'); if (jf > 0) fs.writeFileSync(process.argv[jf + 1], JSON.stringify(out, null, 1));
  await b.close(); srv.kill(); process.exit(fails ? 1 : 0);
})();
