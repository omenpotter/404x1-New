import { describe, it, expect } from 'vitest';
import {
  generateToken,
  hashToken,
  tokenLookupValue,
  isStoredValuePresented,
  isLegacyToken,
  issueSession,
  getSessionPlayer,
} from '../base44/shared/session.ts';

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

// Regression cover for the stored-hash replay: a database read used to yield a value that
// the legacy comparison would accept verbatim as a session token.
describe('stored session values are never accepted as credentials', () => {
  it('stores a prefixed digest', async () => {
    expect(await tokenLookupValue(generateToken())).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('flags a stored value presented as a token', async () => {
    const stored = await tokenLookupValue(generateToken());
    expect(isStoredValuePresented(stored)).toBe(true);
  });

  it('never flags a real token as a stored value', () => {
    for (let i = 0; i < 50; i++) expect(isStoredValuePresented(generateToken())).toBe(false);
  });

  it('still recognises a pre-hashing plaintext token, so nobody is logged out', () => {
    expect(isLegacyToken(generateToken())).toBe(true);
  });

  it('never treats a stored digest as a legacy token', async () => {
    expect(isLegacyToken(await tokenLookupValue(generateToken()))).toBe(false);
  });
});

// Behaviour of the lookup itself, against an in-memory stand-in for the Player table.
function fakeBase44(rows) {
  const state = rows.map(r => ({ ...r }));
  return {
    state,
    asServiceRole: {
      entities: {
        Player: {
          filter: async (query) => state.filter(r => r.session_token === query.session_token),
          update: async (id, data) => {
            const row = state.find(r => r.id === id);
            Object.assign(row, data);
            return row;
          },
        },
      },
    },
  };
}

const future = () => new Date(Date.now() + 86400000).toISOString();

describe('getSessionPlayer', () => {
  it('accepts a legacy plaintext session and upgrades it in place', async () => {
    const legacyToken = generateToken();
    const db = fakeBase44([{ id: 'p1', session_token: legacyToken, session_expires_at: future() }]);

    const player = await getSessionPlayer(db, legacyToken);
    expect(player?.id).toBe('p1');
    expect(db.state[0].session_token).toBe(await tokenLookupValue(legacyToken));
  });

  it('rejects the upgraded stored value replayed as a token', async () => {
    const legacyToken = generateToken();
    const db = fakeBase44([{ id: 'p1', session_token: legacyToken, session_expires_at: future() }]);

    await getSessionPlayer(db, legacyToken);
    const storedValue = db.state[0].session_token;

    expect(await getSessionPlayer(db, storedValue)).toBeNull();
  });

  it('accepts a freshly issued session and rejects its stored form', async () => {
    const db = fakeBase44([{ id: 'p2', session_token: null, session_expires_at: null }]);
    const { token } = await issueSession(db, 'p2');

    expect((await getSessionPlayer(db, token))?.id).toBe('p2');
    expect(await getSessionPlayer(db, db.state[0].session_token)).toBeNull();
  });

  it('rejects expired and unknown tokens', async () => {
    const db = fakeBase44([{ id: 'p3', session_token: await tokenLookupValue('known'), session_expires_at: '2020-01-01T00:00:00.000Z' }]);
    expect(await getSessionPlayer(db, 'known')).toBeNull();
    expect(await getSessionPlayer(db, generateToken())).toBeNull();
  });
});