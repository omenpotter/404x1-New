import { useCallback, useEffect, useRef, useState } from 'react';
import { REFRESH_MS, STALE_AFTER_MS } from './config.js';
import { loadCache, saveCache, syncTrades } from './store.js';
import { loadPool } from './pool.js';
import { loadSupply, loadHolders } from './market.js';

/**
 * One shared market-data service for the Home page:
 *  - pool: verified pool context + live spot price/reserves (XNT per 404)
 *  - trades: verified swaps parsed from the pool vaults
 *  - supply / holders: from the mint and token accounts
 * Each part fails independently so one failing call never blanks the others.
 * status: loading | ready | empty | stale | error
 */
export function useTrades() {
  const initial = loadCache();
  const [state, setState] = useState({
    trades: initial?.trades || [], status: initial?.trades?.length ? 'stale' : 'loading',
    error: null, updatedAt: initial?.updatedAt || null,
    pool: null, poolError: null, supply: null, holders: null, holdersError: null,
  });
  const cacheRef = useRef(initial);
  const poolRef = useRef(null);
  const holdersLoaded = useRef(0);
  const ctl = useRef(null);

  const refresh = useCallback(async () => {
    ctl.current?.abort();
    const c = new AbortController(); ctl.current = c;
    const opts = { signal: c.signal };
    const fail = (e) => e.name === 'AbortError' ? null : e.message;

    let pool = poolRef.current;
    try {
      const fresh = await loadPool(opts);
      pool = poolRef.current = fresh;
      if (cacheRef.current && cacheRef.current.tokenVault !== fresh.tokenVault) cacheRef.current = null; // vaults changed: drop cache
      setState(s => ({ ...s, pool: fresh, poolError: null }));
    } catch (e) {
      const msg = fail(e); if (msg === null) return;
      setState(s => ({ ...s, poolError: msg, status: s.trades.length ? 'stale' : 'error', error: msg }));
      return; // without a verified pool nothing else can be trusted
    }

    loadSupply(opts).then(r => setState(s => ({ ...s, supply: r.supply })), () => {});
    if (Date.now() - holdersLoaded.current > 5 * 60_000) {
      holdersLoaded.current = Date.now();
      loadHolders(opts, { decimals: pool.tokenDecimals, exclude: [pool.authority] })
        .then(h => setState(s => ({ ...s, holders: h, holdersError: null })),
          e => { holdersLoaded.current = 0; const m = fail(e); if (m) setState(s => ({ ...s, holdersError: m })); });
    }

    try {
      const r = await syncTrades({ cache: cacheRef.current, signal: c.signal, pool });
      const next = { trades: r.trades, newestSig: r.newestSig, tokenVault: pool.tokenVault, updatedAt: Date.now() };
      cacheRef.current = next; saveCache(next);
      setState(s => ({ ...s, trades: r.trades, status: r.trades.length ? 'ready' : 'empty', error: r.failed ? `${r.failed} transactions could not be loaded` : null, updatedAt: next.updatedAt }));
    } catch (e) {
      const msg = fail(e); if (msg === null) return;
      setState(s => ({ ...s, status: s.trades.length ? 'stale' : 'error', error: msg }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
    return () => { clearInterval(id); ctl.current?.abort(); };
  }, [refresh]);

  const isOld = state.updatedAt && Date.now() - state.updatedAt > STALE_AFTER_MS;
  return { ...state, status: state.status === 'ready' && isOld ? 'stale' : state.status, retry: () => { holdersLoaded.current = 0; return refresh(); } };
}
