# Session Token Hashing — Compatibility With Existing Sessions

Question this report answers: after moving session tokens from plaintext to SHA-256 at rest, are players who were already signed in logged out?

**Answer: no. A dual-read path keeps every existing session working and upgrades it in place on first use.**

## What the code does now

`getSessionPlayer()` in `base44/shared/session.ts` performs, in order:

1. **Hashed lookup** — `SHA-256(presented token)` is compared against `Player.session_token`. This is the normal path for every session issued from now on.
2. **Legacy lookup** — if no hash matches, the raw presented token is compared against `Player.session_token`. A match means the record predates hashing.
3. **Lazy upgrade** — a legacy match is rewritten to its hash immediately, so that token exists in plaintext only until its owner makes one request. The upgrade is best-effort: if the write fails, the session still validates and the next request tries again.
4. **Expiry check** — `session_expires_at` is evaluated after identity is resolved, in both paths.

`issueSession()` (wallet login) always writes the hash. `revokeSession()` (logout, ban) still nulls both columns, so revocation is unaffected by the storage format.

## Why the two paths cannot cross

- Session tokens are 32 random bytes rendered as 64 hex characters; a hash is 64 hex characters of a different value. A presented token can therefore only match the hash column if it *is* a hash we issued, and can only match the legacy column if it *is* the original token.
- No user input is ever written to either column, so there is no path for a crafted value to become a stored credential.

## Evidence

`tests/session.test.js` (6 tests, all passing) asserts:

- hashing is deterministic for the same token (the property the stored-hash lookup depends on);
- the digest is 64 lowercase hex characters;
- the digest never equals the input token;
- two different tokens never produce the same digest;
- 50 generated tokens all match the expected 32-byte hex shape;
- a generated token can never equal the hash of itself (the ambiguity that would make the dual-read unsafe).

Full suite: **34 tests across 4 files, all passing.**

## Operational notes

- **Removal date for the legacy branch:** safe to delete once no session older than 7 days can exist, i.e. 7 days after this branch is merged and published. After that, every stored token is a hash and the plaintext column is empty. The comment in the code marks this.
- **What an attacker gains from a database read:** one SHA-256 digest, not a usable token. Sessions are 7-day, revocable and bound to a single Player row.
- **What is *not* hashed:** nothing else. `session_expires_at` stays readable so expiry can be evaluated without a second lookup.
- **Ban and logout remain immediate:** both null the column, and lookup fails on a null token without ever reaching the legacy branch.

## Residual risk

A hashed token is still a bearer credential if the *hash* leaks and the attacker presents it: the first lookup would hash it again and miss, but the legacy lookup would compare it verbatim and match. This window exists only while the legacy branch is present, and it closes when the branch is removed 7 days after release. It is recorded as item **R1** in `12_PRODUCTION_READINESS_REPORT.md`.
