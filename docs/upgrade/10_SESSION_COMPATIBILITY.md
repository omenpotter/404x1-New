# Session Token Migration — Compatibility and Replay Safety

Two questions this report answers:

1. After moving session tokens from plaintext to a digest at rest, are players who were already signed in logged out?
2. Can a stored value be replayed as a credential, and what does a production rollback do to migrated sessions?

**Short answers: nobody is logged out, a stored value cannot be replayed, and a rollback costs each active player one wallet reconnection.**

## 1. Storage format

`Player.session_token` holds `sha256:<64 hex>` for every session issued now. The prefix is the whole reason the design is safe, so it is worth being precise about what it buys:

| Property | Why it matters |
| --- | --- |
| Every lookup compares a digest the server computes | No comparison ever uses a caller-supplied value directly |
| A presented value starting with `sha256:` is refused before any lookup | A database read yields a value that is useless as a credential |
| Legacy plaintext tokens are hex only, so they cannot carry the prefix | The compatibility path cannot be reached with a stored value |
| The value is a string in an existing text field | No schema change, no migration, no record rewrite sweep |

## 2. The replay defect that was closed

Before this correction, lookup did two things in order: compare `SHA-256(presented)` to the column, then compare the raw `presented` value to the column. The second comparison is what made a stolen column value usable: given the stored digest `D`, presenting `D` itself missed the digest comparison (because `SHA-256(D) ≠ D`) and then matched verbatim in the legacy comparison. A read of the database therefore still handed out working sessions.

The correction keeps the compatibility path but makes it unreachable for stored values:

1. If the presented value starts with `sha256:`, reject it. No token issued by the app can contain `s` or `:`, since tokens are pure hex.
2. Look up `sha256:` + `SHA-256(presented)`.
3. Only if that misses **and** the presented value is 64 hex characters (the shape of a pre-hashing token), compare the plaintext value. On a hit, rewrite the row as `sha256:<digest>` immediately.

Stored digests can no longer enter step 3 at all, because they carry the prefix and step 1 has already refused them.

## 3. Evidence

`tests/session.test.js` — **15 tests, all passing**, including the four that matter here:

- a stored value presented as a token is flagged as a stored value, and real tokens never are;
- a stored digest is never treated as a legacy token (the replay path is unreachable);
- a legacy plaintext session authenticates and is rewritten in place as a prefixed digest;
- after that upgrade, presenting the stored value returns no player.

The last two run against an in-memory stand-in for the Player table, so they exercise `getSessionPlayer` itself rather than only its helpers. Full suite: **43 tests across 4 files**.

## 4. Existing sessions

- **Plaintext session (the state of every row in production today):** accepted through the legacy comparison, upgraded in place on the same request. The player notices nothing.
- **Digest without prefix:** only produced by development builds of this branch before the prefix existed; such a row no longer matches, and its owner reconnects once. No production row is in this state, because hashing has never been published.
- **Banned or logged-out player:** the token column is nulled, so lookup fails on both paths and the session dies immediately.
- **Expired session:** `session_expires_at` is evaluated after identity resolution, so an expired token is refused whether it was stored hashed or plaintext.

## 5. Production rollback compatibility

This is the one asymmetry in the design, and it cannot be engineered away:

- **Forward (old clients, new server):** seamless. Both formats are understood.
- **Backward (new clients, old server):** the old code reads only plaintext, so a player holding `sha256:...` is not recognised and must reconnect their wallet once. Wallet re-authentication is instant and rewrites a plaintext token under the old code.

So a rollback after publishing produces a bounded wave of "connect wallet" prompts lasting one session lifetime (7 days), not a lockout, and no data repair. The mitigation is to keep any rollback window short. `ROLLBACK.md` carries the staged procedure.

## 6. When to remove the compatibility path — deferred

The legacy branch stays until the owner has confirmed migration progress, i.e. that no meaningful number of rows still holds a plaintext value. Check it in the data view by inspecting `session_token` on Player rows: a value starting with `sha256:` is migrated, a bare 64-hex value is not, and a null value is a signed-out or banned player.

Removal is a deliberate step, not part of this release. It is the point of no return described in `ROLLBACK.md`, because once it is gone a rollback would invalidate every session at once.
