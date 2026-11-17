// Shared session helpers — used by all backend functions that need to identify the caller.
// Sessions are issued by authWallet after wallet signature verification.
//
// Stored format: `sha256:<64 hex>`.
// The prefix is what makes a stored value unusable as a credential. Without it, a stored
// digest and a legitimate token are both "64 hex characters", so a database read could be
// replayed verbatim through the legacy comparison below. With it, three things are true:
//   1. every lookup compares a digest we compute, never a value the caller supplies;
//   2. a presented value carrying the prefix is refused outright, because no token we
//      ever issue can start with `sha256:` (tokens are hex only);
//   3. a pre-hashing plaintext session still works once, then becomes a digest.

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const HASH_PREFIX = 'sha256:';
const LEGACY_TOKEN_RE = /^[0-9a-f]{64}$/; // tokens issued before hashing was introduced

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Exactly the string written to Player.session_token for a token.
export async function tokenLookupValue(token: string): Promise<string> {
  return HASH_PREFIX + await hashToken(token);
}

// A presented value that carries the stored-value prefix is a stored digest being
// replayed, not a token. Refusing it here closes the replay path completely.
export function isStoredValuePresented(token: string): boolean {
  return typeof token === 'string' && token.startsWith(HASH_PREFIX);
}

// A plaintext token from before hashing existed: hex only, so it can never collide with
// a stored digest (which always carries the prefix).
export function isLegacyToken(token: string): boolean {
  return typeof token === 'string' && LEGACY_TOKEN_RE.test(token);
}

// Look up the Player owning sessionToken. Returns null if missing/expired/invalid.
//
// Compatibility: sessions issued before tokens were hashed sit in the column as plaintext.
// Those are accepted once, then rewritten as a prefixed digest (lazy upgrade), so nobody is
// logged out by the change and the plaintext column drains over one session lifetime.
// Remove the legacy branch below once every remaining plaintext row has been upgraded.
export async function getSessionPlayer(base44: any, sessionToken: string | undefined | null) {
  if (!sessionToken || typeof sessionToken !== 'string') return null;
  if (isStoredValuePresented(sessionToken)) return null;
  try {
    let player = null;

    const matches = await base44.asServiceRole.entities.Player.filter(
      { session_token: await tokenLookupValue(sessionToken) },
      null,
      1
    );
    if (matches && matches.length > 0) player = matches[0];

    if (!player && isLegacyToken(sessionToken)) {
      const legacy = await base44.asServiceRole.entities.Player.filter(
        { session_token: sessionToken },
        null,
        1
      );
      if (legacy && legacy.length > 0) {
        player = legacy[0];
        // Upgrade in place so the token stops existing in plaintext.
        try {
          await base44.asServiceRole.entities.Player.update(player.id, {
            session_token: await tokenLookupValue(sessionToken)
          });
        } catch { /* upgrade is best effort; the session still validates */ }
      }
    }

    if (!player) return null;
    if (player.session_expires_at && new Date(player.session_expires_at) < new Date()) {
      return null;
    }
    return player;
  } catch (e) {
    return null;
  }
}

// Banned players keep a valid token until it expires, so every write path asks this
// before acting. The ban flag is set by staff tooling, never by the player.
export function isBanned(player: any): boolean {
  return player?.is_banned === true;
}

// Drop the session token entirely: logout and any ban take effect immediately.
export async function revokeSession(base44: any, playerId: string) {
  if (!playerId) return;
  await base44.asServiceRole.entities.Player.update(playerId, {
    session_token: null,
    session_expires_at: null
  });
}

// Constant-time string compare, so a guessed cron secret cannot be timed byte by byte.
function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

// Issue (or refresh) a session token for a player. Returns { token, expiresAt }.
export async function issueSession(base44: any, playerId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  await base44.asServiceRole.entities.Player.update(playerId, {
    session_token: await tokenLookupValue(token),
    session_expires_at: expiresAt
  });
  return { token, expiresAt };
}

// Check whether a caller is authorised as cron (automated workflow) or admin.
// Cron calls pass cron_secret matching the dedicated CRON_SECRET secret.
// Admin calls pass a session_token owned by an admin/superuser player.
export async function authorizeCronOrAdmin(base44: any, body: any) {
  // A dedicated CRON_SECRET only: reusing the Telegram bot token here would make the
  // messaging credential double as a backend authorisation key.
  const cronSecret = Deno.env.get('CRON_SECRET');
  const providedSecret = body?.cron_secret;
  if (typeof providedSecret === 'string' && providedSecret && cronSecret && safeEqual(providedSecret, cronSecret)) {
    return { ok: true, mode: 'cron' as const, caller: null };
  }
  const caller = await getSessionPlayer(base44, body?.session_token);
  if (caller && ['admin', 'superuser'].includes(caller.user_role)) {
    return { ok: true, mode: 'admin' as const, caller };
  }
  // Platform-identity admins reach these runners from the dashboard and from the
  // scheduled workflow runner, which supplies its own admin credential.
  const platformUser = await base44.auth.me().catch(() => null);
  if (platformUser?.role === 'admin') {
    return { ok: true, mode: 'platform' as const, caller: null };
  }
  return { ok: false, mode: 'none' as const, caller: null };
}