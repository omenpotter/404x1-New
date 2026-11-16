// VERBATIM copy of the pre-upgrade parser from src/pages/Home.jsx @ f00d17c (evidence only; not used by the app).
const TOKEN_CA = '4o4UheANLdqF4gSV4zWTbCTCercQNSaTm6nVcDetzPb2';
const WXNT_ADDRESS = 'So11111111111111111111111111111111111111112';
function getUiAmount(entry) {
  if (!entry?.uiTokenAmount) return 0;
  if (entry.uiTokenAmount.uiAmount != null) return entry.uiTokenAmount.uiAmount;
  const decimals = entry.uiTokenAmount.decimals ?? 9;
  const raw = entry.uiTokenAmount.amount || '0';
  return parseFloat(raw) / Math.pow(10, decimals);
}

function parseTrade(tx, signature = '') {
  try {
    const pre = tx.meta?.preTokenBalances || [];
    const post = tx.meta?.postTokenBalances || [];
    let xntChange = 0, tokChange = 0;
    for (const p of post) {
      const pr = pre.find(x => x.accountIndex === p.accountIndex);
      if (!pr) continue;
      const mint = p.mint;
      const diff = getUiAmount(p) - getUiAmount(pr);
      if (mint === WXNT_ADDRESS) xntChange = diff;
      if (mint === TOKEN_CA) tokChange = diff;
    }
    // Fallback to native SOL balance diff if no WXNT change found
    if (Math.abs(xntChange) < 0.000001) {
      const preB = tx.meta?.preBalances || [];
      const postB = tx.meta?.postBalances || [];
      let maxSol = 0;
      for (let i = 0; i < Math.min(preB.length, postB.length); i++) {
        const diff = (postB[i] - preB[i]) / 1e9;
        if (Math.abs(diff) > Math.abs(maxSol)) maxSol = diff;
      }
      xntChange = maxSol;
    }
    if (Math.abs(xntChange) < 0.000001 || Math.abs(tokChange) < 0.000001) return null;
    if (Math.abs(tokChange) < 0.01) return null;
    const price = Math.abs(xntChange / tokChange);
    if (price <= 0 || !isFinite(price)) return null;
    return {
      time: tx.blockTime,
      xnt: Math.abs(xntChange),
      tok: Math.abs(tokChange),
      price,
      side: xntChange < 0 ? 'SELL' : 'BUY',
      maker: tx.transaction?.message?.accountKeys?.[0]?.pubkey || tx.transaction?.message?.accountKeys?.[0] || '',
      sig: signature
    };
  } catch { return null; }
}
export { parseTrade as legacyParseTrade };
