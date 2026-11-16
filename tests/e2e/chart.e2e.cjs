// Browser test with MOCKED X1 RPC (the sandbox cannot reach the real RPC). Run: node tests/e2e/chart.e2e.cjs
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const OUT = 'docs/upgrade/screenshots/';
const TOKEN = '4o4UheANLdqF4gSV4zWTbCTCercQNSaTm6nVcDetzPb2', WX = 'So11111111111111111111111111111111111111112', POOL = 'DY9uWCwiue23mmq14G2YVYWyXHSYn8ZjSvYJ36CAvmq1';
const bal = (i, m, a, d) => ({ accountIndex: i, mint: m, owner: POOL, uiTokenAmount: { amount: String(a), decimals: d } });
const now = Math.floor(Date.now() / 1000);
const swaps = Array.from({ length: 40 }, (_, i) => { // deterministic: price 0.1 + 0.001*i, alternating side
  const buy = i % 2 === 0, tokAmt = 1e6 * (1 + (i % 5)), price = 0.1 + 0.001 * i, xAmt = Math.round(tokAmt / 1e6 * price * 1e9);
  const t0 = 1e8, x0 = 5e10;
  return { sig: 'sig' + i, price, tokAmt: tokAmt / 1e6, buy, tx: { blockTime: now - (40 - i) * 600, meta: { err: null,
    preTokenBalances: [bal(1, TOKEN, t0, 6), bal(2, WX, x0, 9)],
    postTokenBalances: [bal(1, TOKEN, buy ? t0 - tokAmt : t0 + tokAmt, 6), bal(2, WX, buy ? x0 + xAmt : x0 - xAmt, 9)], preBalances: [], postBalances: [] },
    transaction: { message: { accountKeys: ['trader'] } } } };
});
let mode = 'ok';
async function mock(page) {
  await page.route('https://rpc.mainnet.x1.xyz/**', async route => {
    if (mode === 'fail') return route.fulfill({ status: 503, body: 'down' });
    const b = JSON.parse(route.request().postData());
    const one = r => {
      if (r.method === 'getTokenAccountsByOwner') return { result: { value: r.params[1].programId.startsWith('Tokenkeg') ? [{ account: { data: { parsed: { info: { mint: TOKEN } } } } }, { account: { data: { parsed: { info: { mint: WX } } } } }] : [] } };
      if (r.method === 'getSignaturesForAddress') return { result: mode === 'empty' ? [] : swaps.map(s => ({ signature: s.sig, err: null })).reverse() };
      if (r.method === 'getTransaction') return { result: swaps.find(s => s.sig === r.params[0])?.tx ?? null };
      return { result: [] };
    };
    const out = Array.isArray(b) ? b.map(r => ({ id: r.id, ...one(r) })) : { id: b.id, ...one(b) };
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(out) });
  });
  await page.route(/api\.xdex|\/api\/apps|functions/, r => r.abort());
}
(async () => {
  const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 3000));
  const browser = await chromium.launch();
  const errors = []; let fails = 0;
  const check = (n, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + n); if (!ok) fails++; };
  for (const [name, vp] of [['desktop', { width: 1280, height: 900 }], ['tablet', { width: 820, height: 1100 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp }); const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    mode = 'ok'; await mock(page);
    await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="price-chart"] canvas', { timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.locator('.chart-wrap404').screenshot({ path: `${OUT}after-chart-${name}.png` });
    check(`${name}: chart canvas rendered`, true);
    check(`${name}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    if (name === 'desktop') {
      await page.click('.tf-btns404 >> text=Vol'); await page.click('.tf-btns404 >> text=5m'); await page.waitForTimeout(300);
      await page.locator('.chart-wrap404').screenshot({ path: `${OUT}after-chart-desktop-5m-vol.png` }); check('timeframe+volume toggle no crash', true);
      const box = await page.locator('[data-testid="price-chart"]').boundingBox();
      let hit = false;
      for (let x = 0.1; x < 0.95 && !hit; x += 0.02) { await page.mouse.move(box.x + box.width * x, box.y + box.height * 0.5); await page.waitForTimeout(60); hit = (await page.locator('.ohlcv404').innerText()).includes('Volume'); }
      check('crosshair shows OHLCV on hover', hit);
      await page.setViewportSize({ width: 700, height: 800 }); await page.waitForTimeout(300);
      check('resize keeps chart', await page.locator('[data-testid="price-chart"] canvas').count() > 0);
      const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('xchart_trades_v3')));
      check('cache stores 40 verified swaps', cache.trades.length === 40);
      check('buy/sell parsed from pool deltas', cache.trades[0].side === 'BUY' && cache.trades[1].side === 'SELL' && Math.abs(cache.trades[0].price - 0.1) < 1e-9);
    }
    await ctx.close();
  }
  for (const m of ['fail', 'empty']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
    mode = m; await mock(page); await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
    const want = m === 'fail' ? 'Could not load chart data' : 'No 404/XNT swaps';
    await page.waitForSelector(`text=${want}`, { timeout: 40000 }); await page.locator('.chart-wrap404').screenshot({ path: `${OUT}after-chart-${m}.png` });
    check(`${m} state shown`, true);
    if (m === 'fail') { mode = 'ok'; await page.click('button:text-is("Retry")'); await page.waitForFunction(() => !document.body.innerText.includes('Could not load chart data'), null, { timeout: 15000 }); check('retry recovers', true); }
    await ctx.close();
  }
  check('no uncaught page errors', errors.length === 0); if (errors.length) console.log(errors);
  await browser.close(); srv.kill(); process.exit(fails ? 1 : 0);
})();
