// Runtime performance probe (FCP/LCP/CLS/transfer/long tasks) on the Home page with the real X1 RPC (relayed). Usage: node tests/e2e/perf.cjs <distDir> <port> <label>
const { chromium } = require('playwright'); const { spawn } = require('node:child_process');
const [dir, port, label] = process.argv.slice(2);
(async () => {
  const srv = spawn('npx', ['vite', 'preview', '--outDir', dir, '--port', port, '--strictPort'], { stdio: 'ignore', cwd: dir.replace(/\/dist$/, '') }); await new Promise(r => setTimeout(r, 3000));
  const b = await chromium.launch(); const runs = [];
  for (let i = 0; i < 3; i++) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage(); let bytes = 0;
    await page.route(/rpc\.(mainnet\.x1\.xyz|x1galaxy\.io)/, async route => { const q = route.request(); const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }; if (q.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: H }); try { const r = await fetch(q.url(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: q.postData() }); route.fulfill({ status: r.status, headers: { ...H, 'content-type': 'application/json' }, body: await r.text() }); } catch (e) { route.fulfill({ status: 502, headers: H, body: String(e) }); } });
    await page.route(/api\.xdex|\/api\/apps|functions|base44\.app/, r => r.abort());
    page.on('response', async r => { try { if (r.url().startsWith('http://localhost')) bytes += (await r.body()).length; } catch { /* aborted */ } });
    await page.addInitScript(() => { window.__m = { cls: 0, lcp: 0, lt: 0 }; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.lt += Math.max(0, e.duration - 50); }).observe({ type: 'longtask', buffered: true }); });
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' }); await page.waitForTimeout(9000);
    const m = await page.evaluate(() => ({ ...window.__m, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0, nodes: document.getElementsByTagName('*').length, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }));
    runs.push({ ...m, kb: Math.round(bytes / 1024) }); await ctx.close();
  }
  const med = k => runs.map(r => r[k]).sort((a, b) => a - b)[1];
  console.log(label, JSON.stringify({ FCP_ms: Math.round(med('fcp')), LCP_ms: Math.round(med('lcp')), CLS: +med('cls').toFixed(4), longTaskBlock_ms: Math.round(med('lt')), localKB: med('kb'), domNodes: med('nodes'), heapMB: med('heapMB') }));
  await b.close(); srv.kill();
})();
