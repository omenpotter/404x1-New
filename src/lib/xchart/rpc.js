import { X1_RPC, X1_RPC_FALLBACKS, RPC_CONCURRENCY, BATCH_SIZE } from './config.js';

const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

/** POST JSON with timeout, retry+exponential backoff (network/429/5xx), cancellation. */
/** @param {any} body @param {any} [opts] */
async function postOne(body, { signal, retries = 3, timeoutMs = 12000, url = X1_RPC, fetchImpl = fetch } = /** @type {any} */ ({})) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const ctl = new AbortController();
    const onAbort = () => ctl.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(`RPC HTTP ${res.status}`), { retryable: true });
      if (!res.ok) throw Object.assign(new Error(`RPC HTTP ${res.status}`), { retryable: false });
      return await res.json();
    } catch (e) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      lastErr = e.name === 'AbortError' ? new Error('RPC request timed out') : e;
      if (e.retryable === false || attempt === retries) break;
      await sleep(400 * 2 ** attempt + Math.random() * 200, signal);
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', onAbort);
    }
  }
  throw lastErr;
}

/** @param {string} method @param {any[]} params @param {any} [opts] */
/** Ordered failover across the primary RPC and fallbacks (unless a specific url is requested). */
export async function rpcPost(body, opts = {}) {
  if (opts.url) return postOne(body, opts);
  const urls = [X1_RPC, ...X1_RPC_FALLBACKS];
  let lastErr;
  for (let i = 0; i < urls.length; i++) {
    try { return await postOne(body, { ...opts, url: urls[i], retries: i === urls.length - 1 ? (opts.retries ?? 3) : Math.min(opts.retries ?? 3, 1) }); }
    catch (e) { if (e.name === 'AbortError') throw e; lastErr = e; }
  }
  throw lastErr;
}

/** @param {string} method @param {any[]} params @param {any} [opts] */
export async function rpc(method, params, opts) {
  const d = await rpcPost({ jsonrpc: '2.0', id: 1, method, params }, opts);
  if (d?.error) throw new Error(`RPC ${method}: ${d.error.message || 'error'}`);
  return d?.result;
}

/** Fetch transactions in small batches with bounded concurrency. Falls back to single calls if batching is rejected. */
/** @param {string[]} signatures @param {any} [opts] */
export async function getTransactions(signatures, opts = {}) {
  const chunks = [];
  for (let i = 0; i < signatures.length; i += BATCH_SIZE) chunks.push(signatures.slice(i, i + BATCH_SIZE));
  const results = new Array(chunks.length);
  let next = 0, failed = 0;
  const cfg = { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 };
  async function worker() {
    while (next < chunks.length) {
      const ci = next++;
      const chunk = chunks[ci];
      try {
        const reqs = chunk.map((s, j) => ({ jsonrpc: '2.0', id: j, method: 'getTransaction', params: [s, cfg] }));
        const resp = await rpcPost(reqs, opts);
        if (!Array.isArray(resp)) throw new Error('batch unsupported');
        results[ci] = chunk.map((s, j) => ({ sig: s, tx: resp.find(r => r.id === j)?.result ?? null }));
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        try { // fallback: individual requests
          results[ci] = [];
          for (const s of chunk) results[ci].push({ sig: s, tx: await rpc('getTransaction', [s, cfg], opts) });
        } catch (e2) { if (e2.name === 'AbortError') throw e2; failed += chunk.length; results[ci] = []; }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(RPC_CONCURRENCY, chunks.length) }, worker));
  return { items: results.flat(), failed };
}
