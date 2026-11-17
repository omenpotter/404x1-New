import { useEffect, useState } from 'react';
import { rpc } from './rpc.js';

/**
 * Verified X1 mainnet liveness: one getSlot call every 20 s (paused while the tab is hidden), using the
 * shared RPC client with failover. state: 'checking' | 'ok' | 'down'. Nothing is shown as live unless a real answer arrived.
 */
export function useNetworkStatus(intervalMs = 20000) {
  const [s, setS] = useState({ state: 'checking', slot: null });
  useEffect(() => {
    let stop = false, ctl = null;
    const tick = async () => {
      if (document.hidden) return;
      ctl = new AbortController();
      try { const slot = await rpc('getSlot', [{ commitment: 'confirmed' }], { signal: ctl.signal, retries: 1, timeoutMs: 6000 }); if (!stop && Number.isFinite(slot)) setS({ state: 'ok', slot }); }
      catch (e) { if (!stop && e.name !== 'AbortError') setS(p => ({ state: 'down', slot: p.slot })); }
    };
    tick(); const id = setInterval(tick, intervalMs);
    const vis = () => { if (!document.hidden) tick(); }; document.addEventListener('visibilitychange', vis);
    return () => { stop = true; ctl?.abort(); clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [intervalMs]);
  return s;
}
