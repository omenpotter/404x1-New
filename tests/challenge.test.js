import { describe, it, expect } from 'vitest';
import {
  generateChallenge,
  normalizeAnswer,
  hashAnswer,
  answerMatches,
  isExpired,
  expiryFrom,
  CHALLENGE_TTL_MS,
  MAX_ATTEMPTS,
} from '../base44/shared/challenge.ts';

describe('server-generated verification challenges', () => {
  it('produces a question and an answer for every draw', () => {
    for (let i = 0; i < 200; i++) {
      const c = generateChallenge();
      expect(typeof c.question).toBe('string');
      expect(c.question.length).toBeGreaterThan(5);
      expect(c.answer.length).toBeGreaterThan(0);
    }
  });

  it('does not repeat one fixed question (the old shareable list is gone)', () => {
    const seen = new Set();
    for (let i = 0; i < 60; i++) seen.add(generateChallenge().question);
    expect(seen.size).toBeGreaterThan(10);
  });

  it('states a word category whose answer is one of the offered options', () => {
    for (let i = 0; i < 120; i++) {
      const { question, answer } = generateChallenge();
      const m = question.match(/^Which is a (\w+): (.+)\?$/);
      if (!m) continue;
      const options = m[2].split(',').map((s) => s.trim().toLowerCase());
      expect(options).toContain(answer);
      expect(options).toHaveLength(3);
    }
  });

  it('arithmetic and sequence questions are internally consistent', () => {
    let numeric = 0;
    for (let i = 0; i < 200; i++) {
      const { question, answer } = generateChallenge();
      const add = question.match(/^What is (\d+) \+ (\d+)\?$/);
      const sub = question.match(/^What is (\d+) - (\d+)\?$/);
      const mul = question.match(/^What is (\d+) x (\d+)\?$/);
      const div = question.match(/^What is (\d+) \/ (\d+)\?$/);
      const seq = question.match(/^What comes next: (\d+), (\d+), (\d+), ___\?$/);
      if (add) { numeric++; expect(Number(answer)).toBe(Number(add[1]) + Number(add[2])); }
      else if (sub) { numeric++; expect(Number(answer)).toBe(Number(sub[1]) - Number(sub[2])); }
      else if (mul) { numeric++; expect(Number(answer)).toBe(Number(mul[1]) * Number(mul[2])); }
      else if (div) {
        numeric++;
        expect(Number(answer)).toBe(Number(div[1]) / Number(div[2]));
        expect(Number.isInteger(Number(answer))).toBe(true);
      } else if (seq) {
        numeric++;
        const step = Number(seq[2]) - Number(seq[1]);
        expect(Number(seq[3]) - Number(seq[2])).toBe(step);
        expect(Number(answer)).toBe(Number(seq[3]) + step);
      } else {
        // Word question: the answer is a word, checked by the category test above.
        expect(Number.isNaN(Number(answer))).toBe(true);
      }
    }
    expect(numeric).toBeGreaterThan(20);
  });
});

describe('answer handling', () => {
  it('normalizes case and whitespace before comparing', async () => {
    expect(normalizeAnswer('  APPLE ')).toBe('apple');
    expect(normalizeAnswer('Mar\t s')).toBe('mar s');
    expect(normalizeAnswer(null)).toBe('');
  });

  it('stores only a digest, never the answer itself', async () => {
    const hash = await hashAnswer('apple');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('apple');
  });

  it('matches the right answer regardless of case and padding', async () => {
    const hash = await hashAnswer('Apple');
    expect(await answerMatches('  apple  ', hash)).toBe(true);
    expect(await answerMatches('APPLE', hash)).toBe(true);
  });

  it('rejects a wrong answer and an empty stored hash', async () => {
    const hash = await hashAnswer('apple');
    expect(await answerMatches('banana', hash)).toBe(false);
    expect(await answerMatches('apple', '')).toBe(false);
  });
});

describe('challenge lifetime', () => {
  it('is valid before expiry and rejected at or after it', () => {
    const now = Date.now();
    const expires = expiryFrom(now);
    expect(isExpired(expires, now)).toBe(false);
    expect(isExpired(expires, now + CHALLENGE_TTL_MS)).toBe(true);
    expect(isExpired(expires, now + CHALLENGE_TTL_MS + 1)).toBe(true);
  });

  it('treats a missing or unparseable expiry as expired', () => {
    expect(isExpired(null)).toBe(true);
    expect(isExpired('not-a-date')).toBe(true);
  });

  it('gives a short window and only two attempts', () => {
    expect(CHALLENGE_TTL_MS).toBe(5 * 60 * 1000);
    expect(MAX_ATTEMPTS).toBe(2);
  });
});