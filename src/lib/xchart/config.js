// Single source of truth for the 404/XNT market identity.
export const TOKEN_MINT = '4o4UheANLdqF4gSV4zWTbCTCercQNSaTm6nVcDetzPb2';
export const WXNT_MINT = 'So11111111111111111111111111111111111111112';
export const POOL_ADDRESS = 'DY9uWCwiue23mmq14G2YVYWyXHSYn8ZjSvYJ36CAvmq1';
export const X1_RPC = 'https://rpc.mainnet.x1.xyz/';
export const TOKEN_PROGRAMS = [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
];
export const NATIVE_DECIMALS = 9;
export const FIRST_LOAD_SIGNATURES = 100; // not 1000: bounded first load
export const INCREMENTAL_SIGNATURES = 50;
export const MAX_CACHED_TRADES = 2000;
export const RPC_CONCURRENCY = 3;
export const BATCH_SIZE = 10;
export const REFRESH_MS = 60_000;
export const STALE_AFTER_MS = 5 * 60_000;
export const CACHE_KEY = 'xchart_trades_v3';
export const TIMEFRAMES = [1, 5, 15, 60, 240, 1440]; // minutes
