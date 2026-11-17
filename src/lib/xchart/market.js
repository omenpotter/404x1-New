import { TOKEN_MINT } from './config.js';
import { rpc } from './rpc.js';
import { b58encode, b64decode } from './pool.js';

const T22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', LEGACY = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

/** Mint supply straight from the mint account (404 has no mint authority, so supply is fixed). */
export async function loadSupply(opts) {
  const r = await rpc('getAccountInfo', [TOKEN_MINT, { encoding: 'jsonParsed' }], opts);
  const info = r?.value?.data?.parsed?.info;
  if (!info || r.value.data.parsed.type !== 'mint') throw new Error('404 mint account not found');
  const decimals = Number(info.decimals);
  return { supply: Number(BigInt(info.supply)) / 10 ** decimals, decimals, mintAuthority: info.mintAuthority ?? null };
}

/** Aggregate raw token accounts into unique owner wallets (balance > 0), largest first. */
export function aggregateHolders(accounts, decimals = 9) {
  const by = new Map();
  for (const a of accounts) by.set(a.owner, (by.get(a.owner) || 0n) + a.amount);
  return [...by.entries()].filter(([, v]) => v > 0n)
    .map(([wallet, v]) => ({ wallet, balance: Number(v) / 10 ** decimals }))
    .sort((a, b) => b.balance - a.balance);
}

async function accountsFor(programId, opts, withSize) {
  /** @type {any[]} */
  const filters = [{ memcmp: { offset: 0, bytes: TOKEN_MINT } }];
  if (withSize) filters.unshift({ dataSize: 165 });
  const res = await rpc('getProgramAccounts', [programId, { encoding: 'base64', dataSlice: { offset: 32, length: 40 }, filters }], opts);
  return (res || []).map(x => {
    const b = b64decode(x.account.data[0]);
    return { owner: b58encode(b.slice(0, 32)), amount: new DataView(b.buffer, b.byteOffset).getBigUint64(32, true) };
  });
}

/** Unique holder WALLETS (not token accounts). `exclude` = addresses to leave out (e.g. AMM pool authority). */
export async function loadHolders(opts, { decimals = 9, exclude = [] } = {}) {
  const [a, b] = await Promise.all([accountsFor(T22, opts, false), accountsFor(LEGACY, opts, true)]);
  const all = aggregateHolders([...a, ...b], decimals);
  const ex = new Set(exclude);
  return { holders: all.filter(h => !ex.has(h.wallet)), excluded: all.filter(h => ex.has(h.wallet)), tokenAccounts: a.length + b.length };
}
