// Shared session helpers — used by all backend functions that need to identify the caller.
// Sessions are issued by authWallet after wallet signature verification.

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Look up the Player owning sessionToken. Returns null if missing/expired/invalid.
export async function getSessionPlayer(base44: any, sessionToken: string | undefined | null) {
  if (!sessionToken || typeof sessionToken !== 'string') return null;
  try {
    const players = await base44.asServiceRole.entities.Player.filter(
      { session_token: sessionToken },
      null,
      1
    );
    if (!players || players.length === 0) return null;
    const player = players[0];
    if (player.session_expires_at && new Date(player.session_expires_at) < new Date()) {
      return null;
    }
    return player;
  } catch (e) {
    return null;
  }
}

// Issue (or refresh) a session token for a player. Returns { token, expiresAt }.
export async function issueSession(base44: any, playerId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  await base44.asServiceRole.entities.Player.update(playerId, {
    session_token: token,
    session_expires_at: expiresAt
  });
  return { token, expiresAt };
}

// Check whether a caller is authorised as cron (automated workflow) or admin.
// Cron calls pass cron_secret matching CRON_SECRET (fallback TELEGRAM_BOT_TOKEN).
// Admin calls pass a session_token owned by an admin/superuser player.
export async function authorizeCronOrAdmin(base44: any, body: any) {
  const cronSecret = Deno.env.get('CRON_SECRET') || Deno.env.get('TELEGRAM_BOT_TOKEN');
  const providedSecret = body?.cron_secret;
  if (providedSecret && cronSecret && providedSecret === cronSecret) {
    return { ok: true, mode: 'cron' as const, caller: null };
  }
  const caller = await getSessionPlayer(base44, body?.session_token);
  if (caller && ['admin', 'superuser'].includes(caller.user_role)) {
    return { ok: true, mode: 'admin' as const, caller };
  }
  return { ok: false, mode: 'none' as const, caller: null };
}