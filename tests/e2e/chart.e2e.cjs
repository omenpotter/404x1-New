// Browser e2e for the Home market-data panel.
//   MODE=mock (default): X1 RPC is MOCKED from fixtures (regression coverage only; proves nothing about the live chain).
//   MODE=live          : the browser's X1 RPC requests are forwarded UNMODIFIED to the real X1 mainnet RPC (read-only)
//                        and the page is checked against the real XDEX API. (Forwarding happens in Node so the sandbox
//                        proxy/CA is honoured; set NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=... if you are behind one.)
// Run: npm run build && node tests/e2e/chart.e2e.cjs   |   MODE=live node tests/e2e/chart.e2e.cjs
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const MODE = process.env.MODE || 'mock';
const OUT = `docs/upgrade/screenshots/${MODE === 'live' ? 'live' : 'mock'}-`;
const TOKEN = '4o4UheANLdqF4gSV4zWTbCTCercQNSaTm6nVcDetzPb2', WX = 'So11111111111111111111111111111111111111112', POOL = 'DY9uWCwiue23mmq14G2YVYWyXHSYn8ZjSvYJ36CAvmq1';
const TV = '6G9EKKX3kF6UUyUtBbo731NGQnr88h9JD4zWzi1tf8DL', QV = '5t5EsuS5kuofpT68j9qHfLuwZRpECJPk1zqRGHeJp922', AUTH = '9Dpjw2pB5kXJr6ZTHiqzEMfJPic3om9jgNacnwpLCoaU';
const poolState = JSON.parse(fs.readFileSync('tests/fixtures/pool_state_DY9u.json'));
const bal = (i, m, a) => ({ accountIndex: i, mint: m, owner: AUTH, uiTokenAmount: { amount: String(a), decimals: 9 } });
const now = Math.floor(Date.now() / 1000);
const swaps = Array.from({ length: 40 }, (_, i) => { const buy = i % 2 === 0, t = 1e12 * (1 + (i % 5)), x = Math.round(t * (0.1 + 0.001 * i)), t0 = 113e12, x0 = 513e9;
  return { sig: 'sig' + i, tx: { blockTime: now - (40 - i) * 600, meta: { err: null,
    preTokenBalances: [bal(1, TOKEN, t0), bal(2, WX, x0)], postTokenBalances: [bal(1, TOKEN, buy ? t0 - t : t0 + t), bal(2, WX, buy ? x0 + x : x0 - x)] },
    transaction: { message: { accountKeys: [{ pubkey: 'Trader' + i }, { pubkey: TV }, { pubkey: QV }] } } } }; });
const acct = (fill, amt) => { const b = Buffer.alloc(40, fill); b.writeBigUInt64LE(BigInt(amt), 32); return { pubkey: 'x', account: { data: [b.toString('base64'), 'base64'] } }; };
const holderAccts = [acct(1, 5e12), acct(1, 3e12), acct(2, 1e12), acct(3, 0)]; // 2 unique wallets with balance (one owns 2 accounts), 1 empty
let mode = 'ok';
const ACAO = { 'access-control-allow-origin': '*' };
const vaultAcct = (mint, amt) => ({ data: { parsed: { info: { mint, owner: AUTH, tokenAmount: { amount: String(amt), decimals: 9 } } } } });
function mockOne(r) {
  switch (r.method) {
    case 'getAccountInfo': return r.params[0] === POOL ? { result: { value: { owner: poolState.owner, data: poolState.data } } }
      : { result: { value: { data: { parsed: { type: 'mint', info: { decimals: 9, supply: '404402625473771', mintAuthority: null } } } } } };
    case 'getMultipleAccounts': return { result: { value: [vaultAcct(TOKEN, 113322429474894n.toString()), vaultAcct(WX, 513799644979n.toString())] } };
    case 'getProgramAccounts': return { result: r.params[0].startsWith('Tokenz') ? holderAccts : [] };
    case 'getSignaturesForAddress': return { result: mode === 'empty' ? [] : swaps.map(s => ({ signature: s.sig, err: null })).reverse() };
    case 'getTransaction': return { result: swaps.find(s => s.sig === r.params[0])?.tx ?? null };
    default: return { result: null };
  }
}
async function routeRpc(page) {
  await page.route(/rpc\.(mainnet\.x1\.xyz|x1galaxy\.io)/, async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...ACAO, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } });
    if (MODE === 'live') { // real network, unmodified request
      try { const r = await fetch(req.url(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: req.postData() });
        return route.fulfill({ status: r.status, headers: { ...ACAO, 'content-type': 'application/json' }, body: await r.text() });
      } catch (e) { return route.fulfill({ status: 502, headers: ACAO, body: String(e) }); }
    }
    if (mode === 'fail') return route.fulfill({ status: 503, headers: ACAO, body: 'down' });
    const b = JSON.parse(req.postData());
    const out = Array.isArray(b) ? b.map(r => ({ id: r.id, ...mockOne(r) })) : { id: b.id, ...mockOne(b) };
    route.fulfill({ status: 200, contentType: 'application/json', headers: ACAO, body: JSON.stringify(out) });
  });
  await page.route(/api\.xdex|\/api\/apps|functions/, r => r.abort());
}
(async () => {
  const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 3000));
  const browser = await chromium.launch();
  const errors = []; let fails = 0;
  const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} [${MODE}] ${n}${d ? ' — ' + d : ''}`); if (!ok) fails++; };
  const home = (page) => page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  let xdexSpot = null;
  if (MODE === 'live') { const p = (await (await fetch(`https://api.xdex.xyz/api/token-price/prices?network=X1%20Mainnet&token_addresses=${TOKEN},${WX}`)).json()).data; xdexSpot = p.find(x => x.token_address === TOKEN).price / p.find(x => x.token_address === WX).price; console.log('XDEX reference spot', xdexSpot); }
  for (const [name, vp] of [['desktop', { width: 1280, height: 900 }], ['tablet', { width: 820, height: 1100 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp }); const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    mode = 'ok'; await routeRpc(page); await home(page);
    await page.waitForSelector('[data-testid="price-chart"] canvas', { timeout: 20000 });
    await page.waitForFunction(() => /\d\.\d{6}/.test(document.querySelector('.hm-metric-value')?.innerText || ''), null, { timeout: 40000 });
    await page.waitForFunction(() => document.querySelectorAll('a.hm-row.txn').length > 0, null, { timeout: 40000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}home-${name}.png`, fullPage: false });
    await page.locator('.hm-chart').screenshot({ path: `${OUT}chart-${name}.png` });
    const stats = await page.locator('.hm-metric-value').allInnerTexts();
    console.log(name, 'stats', JSON.stringify(stats));
    check(`${name}: price/holders/market-cap all resolved (none Loading)`, stats.length >= 7 && stats.every(t => !/^0000\.00$/.test(t) && t !== 'N/A'), stats.join(' | '));
    check(`${name}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    const rows = await page.locator('a.hm-row.txn').count();
    check(`${name}: transactions listed with BUY/SELL`, rows > 0 && (await page.locator('a.hm-row.txn').first().innerText()).match(/BUY|SELL/) !== null, `${rows} rows; first: ${(await page.locator('a.hm-row.txn').first().innerText()).replace(/\s+/g, ' ')}`);
    if (name === 'desktop') {
      if (MODE === 'live') {
        const spot = parseFloat(stats[0]); check('page spot price within 1% of XDEX', Math.abs(spot - xdexSpot) / xdexSpot < 0.01, `page=${spot} xdex=${xdexSpot}`);
        const holders = parseInt(stats[5].replace(/,/g, ''), 10); check('holders is a plausible unique-wallet count (not 66 token-account count)', holders > 0 && holders !== 66, String(holders));
        const mc = stats[2]; check('market cap = spot x supply (404,402.6)', (() => { const v = parseFloat(mc) * (mc.includes('K') ? 1e3 : mc.includes('M') ? 1e6 : 1); return Math.abs(v - spot * 404402.625) / v < 0.01; })(), mc);
      }
      await page.click('.hm-vol');
      for (const tf of ['1m', '5m', '15m', '4h', '1d', '1h']) { await page.click(`.hm-seg button:text-is("${tf}")`); await page.waitForTimeout(200); }
      await page.screenshot({ path: `${OUT}chart-desktop-vol.png`, clip: await page.locator('.hm-chart').boundingBox() });
      check('all six timeframes + volume toggle: no crash', true);
      await page.click('.hm-tabs button:text-is("Holders")'); await page.waitForSelector('a.hm-row.hld', { timeout: 15000 });
      check('holders tab lists wallets', (await page.locator('a.hm-row.hld').count()) > 0 && (MODE === 'live' || stats[5] === '2'), `${await page.locator('a.hm-row.hld').count()} rows`);
      await page.locator('.hm-tabs button').first().click();
      await page.locator('[data-testid="price-chart"]').scrollIntoViewIfNeeded(); const box = await page.locator('[data-testid="price-chart"]').boundingBox(); let hit = false;
      for (let x = 0.1; x < 0.95 && !hit; x += 0.02) { await page.mouse.move(box.x + box.width * x, box.y + box.height * 0.5); await page.waitForTimeout(60); hit = (await page.locator('.hm-ohlcv').innerText()).includes('Volume'); }
      check('crosshair shows OHLCV on hover', hit);
      await page.setViewportSize({ width: 700, height: 800 }); await page.waitForTimeout(300);
      check('resize keeps chart', await page.locator('[data-testid="price-chart"] canvas').count() > 0);
      const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('xchart_trades_v4')));
      check('cache stored swaps with pool vault', cache.trades.length > 0 && cache.tokenVault === TV, `${cache.trades.length} swaps`);
    }
    await ctx.close();
  }
  if (MODE === 'mock') for (const m of ['fail', 'empty']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
    mode = m; await routeRpc(page); await home(page);
    const want = m === 'fail' ? 'Could not load chart data' : 'No 404/XNT swaps';
    await page.waitForSelector(`text=${want}`, { timeout: 60000 }); await page.locator('.hm-chart').screenshot({ path: `${OUT}chart-${m}.png` });
    check(`${m} state shown`, true);
    if (m === 'fail') { mode = 'ok'; await page.click('button:text-is("Retry")'); await page.waitForFunction(() => !document.body.innerText.includes('Could not load chart data'), null, { timeout: 30000 }); check('retry recovers', true); }
    await ctx.close();
  }
  check('no uncaught page errors', errors.length === 0); if (errors.length) console.log(errors);
  await browser.close(); srv.kill(); process.exit(fails ? 1 : 0);
})();
