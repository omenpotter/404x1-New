// Username policy — one place that decides whether a name may be claimed.
//
// Two names that differ only by case are the same name to a reader, so uniqueness is
// always decided on `usernameKey`. The database holds that key in Player.username_key
// with a unique constraint, which is what makes the claim race-free: two wallets that
// submit the same name at the same instant cannot both succeed, because the second
// insert violates the constraint rather than passing a check that ran a moment earlier.

export function usernameKey(username: unknown): string {
  return String(username ?? '').trim().toLowerCase();
}

const RESERVED = new Set([
  'admin', 'administrator', 'mod', 'moderator', 'mods', 'superuser', 'system', 'bot', 'bots',
  'staff', 'team', '404x1', 'x1', 'four04', 'owner', 'root', 'support', 'help', 'official',
  'security', 'null', 'undefined', 'anonymous', 'guest', 'satoshi', 'treasury', 'core'
]);

// A name that begins with one of these reads as staff at a glance.
const RESERVED_PREFIXES = ['admin', 'moder', 'superuser', 'support', 'official', 'staff', '404x1'];

// Digits that stand in for letters, so "4dm1n" and "adm1n" collapse onto "admin".
const LOOKALIKE_DIGITS: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g'
};

// How a name reads once case, digits used as letters, and separators are removed.
export function usernameSquash(username: unknown): string {
  return usernameKey(username)
    .replace(/[0-9]/g, (d) => LOOKALIKE_DIGITS[d] ?? '')
    .replace(/[^a-z]/g, '');
}

export function isReservedUsername(username: unknown): boolean {
  const key = usernameKey(username);
  if (RESERVED.has(key)) return true;

  const flat = usernameSquash(username);
  if (!flat) return true;
  if (RESERVED.has(flat)) return true;
  if (flat.includes('404x1')) return true;

  return RESERVED_PREFIXES.some((p) => key.startsWith(p) || flat.startsWith(p));
}

// Returns an error message, or null when the name may be claimed.
export function validateUsername(username: unknown): string | null {
  if (typeof username !== 'string' || !username) return 'Username is required';
  if (username.length < 3 || username.length > 16) return 'Username must be 3-16 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username can only contain letters, numbers, and underscores';
  }
  if (isReservedUsername(username)) return 'This username is reserved. Please choose another.';
  return null;
}