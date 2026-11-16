import { useCallback, useEffect, useRef, useState } from 'react';
import { REFRESH_MS, STALE_AFTER_MS } from './config.js';
import { loadCache, saveCache, validatePool, syncTrades } from './store.js';

/** status: loading | ready | empty | stale | error */
export function useTrades() {
  const initial = loadCache();
  const [state, setState] = useState({
    trades: initial?.trades || [], status: initial?.trades?.length ? 'stale' : 'loading',
    error: null, updatedAt: initial?.updatedAt || null,
  });
  const cacheRef = useRef(initial);
  const validated = useRef(false);
  const ctl = useRef(null);

  const refresh = useCallback(async () => {
    ctl.current?.abort();
    const c = new AbortController(); ctl.current = c;
    try {
      if (!validated.current) { await validatePool({ signal: c.signal }); validated.current = true; }
      const r = await syncTrades({ cache: cacheRef.current, signal: c.signal });
      const next = { trades: r.trades, newestSig: r.newestSig, updatedAt: Date.now() };
      cacheRef.current = next; saveCache(next);
      setState({ trades: r.trades, status: r.trades.length ? 'ready' : 'empty', error: r.failed ? `${r.failed} transactions could not be loaded` : null, updatedAt: next.updatedAt });
    } catch (e) {
      if (e.name === 'AbortError') return;
      setState(s => ({ ...s, status: s.trades.length ? 'stale' : 'error', error: e.message }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
    return () => { clearInterval(id); ctl.current?.abort(); };
  }, [refresh]);

  const isOld = state.updatedAt && Date.now() - state.updatedAt > STALE_AFTER_MS;
  return { ...state, status: state.status === 'ready' && isOld ? 'stale' : state.status, retry: refresh };
}
