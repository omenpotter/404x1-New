import { POOL_ADDRESS, TOKEN_MINT, WXNT_MINT } from './config.js';
import { rpc } from './rpc.js';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = '';
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b === 0) s = '1' + s; else break; }
  return s;
}
export function b64decode(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Decode the AMM pool state account (Raydium-CP-style layout used by the XDEX AMM, verified on X1 mainnet):
 *  8 discriminator | 32 ammConfig | 32 creator | 32 token0Vault | 32 token1Vault | 32 lpMint |
 *  32 token0Mint | 32 token1Mint | 32 token0Program | 32 token1Program | 32 observation |
 *  u8 authBump, u8 status, u8 lpDecimals, u8 mint0Decimals, u8 mint1Decimals |
 *  u64 lpSupply, protocolFees0, protocolFees1, fundFees0, fundFees1, openTime, recentEpoch
 */
export function decodePoolState(bytes) {
  if (!bytes || bytes.length < 389) throw new Error('Pool account too small to be an AMM pool state');
  const pk = (o) => b58encode(bytes.slice(o, o + 32));
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u64 = (o) => dv.getBigUint64(o, true);
  return {
    ammConfig: pk(8), creator: pk(40), token0Vault: pk(72), token1Vault: pk(104), lpMint: pk(136),
    token0Mint: pk(168), token1Mint: pk(200), token0Program: pk(232), token1Program: pk(264), observation: pk(296),
    authBump: bytes[328], status: bytes[329], lpDecimals: bytes[330], mint0Decimals: bytes[331], mint1Decimals: bytes[332],
    lpSupply: u64(333), protocolFees0: u64(341), protocolFees1: u64(349), fundFees0: u64(357), fundFees1: u64(365),
    openTime: Number(u64(373)),
  };
}

const ui = (raw, dec) => Number(raw) / 10 ** dec;

/**
 * Discover and VERIFY the 404/XNT pool from chain state. Throws with a precise reason if anything differs.
 * Returns vault addresses, decimals, net reserves (vault balance minus accrued protocol/fund fees)
 * and the spot price in XNT per 1 404.
 */
export async function loadPool(opts, pool = POOL_ADDRESS) {
  const acct = await rpc('getAccountInfo', [pool, { encoding: 'base64' }], opts);
  const v = acct?.value;
  if (!v) throw new Error(`Pool validation failed: account ${pool} does not exist`);
  const state = decodePoolState(b64decode(v.data[0]));
  const mints = [state.token0Mint, state.token1Mint];
  if (!mints.includes(TOKEN_MINT)) throw new Error('Pool validation failed: pool does not trade the 404 mint');
  if (!mints.includes(WXNT_MINT)) throw new Error('Pool validation failed: pool is not quoted in wrapped XNT');
  const tokenIs0 = state.token0Mint === TOKEN_MINT;
  const tokenVault = tokenIs0 ? state.token0Vault : state.token1Vault;
  const quoteVault = tokenIs0 ? state.token1Vault : state.token0Vault;
  const tokenDecimals = tokenIs0 ? state.mint0Decimals : state.mint1Decimals;
  const quoteDecimals = tokenIs0 ? state.mint1Decimals : state.mint0Decimals;
  const tokenFees = tokenIs0 ? state.protocolFees0 + state.fundFees0 : state.protocolFees1 + state.fundFees1;
  const quoteFees = tokenIs0 ? state.protocolFees1 + state.fundFees1 : state.protocolFees0 + state.fundFees0;

  const vaults = await rpc('getMultipleAccounts', [[tokenVault, quoteVault], { encoding: 'jsonParsed' }], opts);
  const [tv, qv] = (vaults?.value || []).map(a => a?.data?.parsed?.info);
  if (!tv || tv.mint !== TOKEN_MINT) throw new Error('Pool validation failed: token vault does not hold the 404 mint');
  if (!qv || qv.mint !== WXNT_MINT) throw new Error('Pool validation failed: quote vault does not hold wrapped XNT');
  if (tv.owner !== qv.owner) throw new Error('Pool validation failed: vaults have different authorities');
  if (Number(tv.tokenAmount.decimals) !== tokenDecimals || Number(qv.tokenAmount.decimals) !== quoteDecimals)
    throw new Error('Pool validation failed: vault decimals disagree with pool state');

  const tokenReserve = ui(BigInt(tv.tokenAmount.amount) - tokenFees, tokenDecimals);
  const quoteReserve = ui(BigInt(qv.tokenAmount.amount) - quoteFees, quoteDecimals);
  if (!(tokenReserve > 0) || !(quoteReserve > 0)) throw new Error('Pool has no liquidity');
  return {
    pool, program: v.owner, authority: tv.owner, lpMint: state.lpMint, status: state.status,
    tokenVault, quoteVault, tokenDecimals, quoteDecimals, tokenReserve, quoteReserve,
    spot: quoteReserve / tokenReserve, // XNT per 1 404, net of accrued fees (matches XDEX oracle)
    spotGross: ui(BigInt(qv.tokenAmount.amount), quoteDecimals) / ui(BigInt(tv.tokenAmount.amount), tokenDecimals),
  };
}
