import { describe, it, expect } from 'vitest';
import {
  usernameKey,
  usernameSquash,
  isReservedUsername,
  validateUsername,
} from '../base44/shared/usernames.ts';

describe('case-insensitive username uniqueness key', () => {
  it('collapses case, surrounding space and inner spacing differences', () => {
    const key = usernameKey('  Alpha  ');
    expect(key).toBe('alpha');
    expect(usernameKey('ALPHA')).toBe(key);
    expect(usernameKey('aLpHa')).toBe(key);
  });

  it('treats two claimants of the same name as the same key', () => {
    // This is what makes the write-then-recheck comparison sound: both contenders derive
    // the identical key, so exactly one of them can hold the name.
    const contenderA = usernameKey('CryptoKing');
    const contenderB = usernameKey('cryptoking');
    expect(contenderA).toBe(contenderB);
  });

  it('keeps genuinely different names apart', () => {
    expect(usernameKey('alpha')).not.toBe(usernameKey('alphax'));
    expect(usernameKey('alpha_1')).not.toBe(usernameKey('alpha1'));
  });
});

describe('reserved and staff-lookalike names', () => {
  it('refuses reserved names in any case', () => {
    expect(isReservedUsername('Admin')).toBe(true);
    expect(isReservedUsername('SUPERUSER')).toBe(true);
    expect(isReservedUsername('404x1')).toBe(true);
  });

  it('refuses digit-for-letter and separator disguises', () => {
    expect(isReservedUsername('4dm1n')).toBe(true);
    expect(isReservedUsername('m0d')).toBe(true);
    expect(isReservedUsername('mod_era')).toBe(true);
    expect(isReservedUsername('adm1n_team')).toBe(true);
  });

  it('refuses names that squash to nothing meaningful', () => {
    expect(usernameSquash('___')).toBe('');
    expect(isReservedUsername('___')).toBe(true);
  });

  it('allows ordinary community names', () => {
    expect(isReservedUsername('satoshi_nakamoto')).toBe(false);
    expect(isReservedUsername('wallet_watcher')).toBe(false);
    expect(validateUsername('wallet_watcher')).toBeNull();
  });

  it('enforces length and character rules', () => {
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('a'.repeat(17))).not.toBeNull();
    expect(validateUsername('bad name')).not.toBeNull();
    expect(validateUsername('bad-name')).not.toBeNull();
    expect(validateUsername('')).not.toBeNull();
  });
});