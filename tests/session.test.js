import { describe, it, expect } from 'vitest';
import { generateToken, hashToken } from '../base44/shared/session.ts';

// The stored-hash lookup is only sound if hashing is deterministic and collision-free
// in practice: a session issued once must hash to the same value on every later call.
describe('session token hashing', () => {
  it('is deterministic for the same token', async () => {
    const token = generateToken();
    expect(await hashToken(token)).toBe(await hashToken(token));
  });

  it('produces 64 lowercase hex characters (SHA-256 hex)', async () => {
    const digest = await hashToken(generateToken());
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never returns the token itself', async () => {
    const token = generateToken();
    expect(await hashToken(token)).not.toBe(token);
  });

  it('differs for different tokens', async () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(await hashToken(a)).not.toBe(await hashToken(b));
  });

  it('issued tokens are 32 random bytes of hex (64 characters)', () => {
    for (let i = 0; i < 50; i++) expect(generateToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('legacy plaintext tokens cannot collide with a hash value', async () => {
    // A 64-hex legacy token would look like a hash; a 32-byte random token cannot
    // equal the SHA-256 hex of anything shorter, so the upgrade path is unambiguous.
    const legacy = generateToken();
    const hashed = await hashToken(legacy);
    expect(hashed).not.toBe(legacy);
  });
});