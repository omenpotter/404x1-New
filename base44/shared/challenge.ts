// Human-verification challenges.
//
// A challenge is generated on the server at the moment it is requested and stored with a
// hashed answer, so nothing a client can replay or share is ever reusable:
//   - the question is new each time, so a screenshot of one carries no value;
//   - the answer is stored only as a SHA-256 digest of its normalized form;
//   - a challenge belongs to one player, expires, and can be answered once.

export const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_ATTEMPTS = 2;

const WORDS: Record<string, string[]> = {
  fruit: ['apple', 'banana', 'cherry', 'mango'],
  animal: ['dog', 'cat', 'horse', 'otter'],
  color: ['blue', 'green', 'orange', 'violet'],
  planet: ['mars', 'venus', 'saturn', 'jupiter'],
  vehicle: ['car', 'train', 'bicycle', 'boat'],
  country: ['france', 'japan', 'brazil', 'kenya'],
};

const DISTRACTORS = ['table', 'rock', 'chair', 'cloud', 'idea', 'peace', 'mountain', 'tree', 'fast', 'happy'];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Returns a freshly generated question and its expected answer (already normalized).
export function generateChallenge(): { question: string; answer: string } {
  const kind = rand(0, 5);

  if (kind === 0) {
    const a = rand(11, 49);
    const b = rand(3, 39);
    return { question: `What is ${a} + ${b}?`, answer: String(a + b) };
  }
  if (kind === 1) {
    const a = rand(30, 99);
    const b = rand(2, 29);
    return { question: `What is ${a} - ${b}?`, answer: String(a - b) };
  }
  if (kind === 2) {
    const a = rand(3, 12);
    const b = rand(3, 9);
    return { question: `What is ${a} x ${b}?`, answer: String(a * b) };
  }
  if (kind === 3) {
    const start = rand(2, 20);
    const step = rand(2, 11);
    return {
      question: `What comes next: ${start}, ${start + step}, ${start + step * 2}, ___?`,
      answer: String(start + step * 3),
    };
  }
  if (kind === 4) {
    // Built from a whole-number quotient, so the answer is never a fraction.
    const quotient = rand(2, 12);
    const b = rand(2, 9);
    return { question: `What is ${quotient * b} / ${b}?`, answer: String(quotient) };
  }

  // Word question: one real category member among unrelated nouns.
  const category = pick(Object.keys(WORDS));
  const correct = pick(WORDS[category]);
  const others: string[] = [];
  while (others.length < 2) {
    const candidate = pick(DISTRACTORS);
    if (candidate !== correct && !others.includes(candidate)) others.push(candidate);
  }
  const options = [correct, ...others].sort(() => Math.random() - 0.5);
  return {
    question: `Which is a ${category}: ${options.join(', ')}?`,
    answer: correct,
  };
}

// Answer form used for comparison and for storage: case and surrounding space never matter.
export function normalizeAnswer(answer: unknown): string {
  return String(answer ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export async function hashAnswer(answer: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeAnswer(answer));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function answerMatches(answer: unknown, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;
  const candidate = await hashAnswer(answer);
  if (candidate.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ storedHash.charCodeAt(i);
  return diff === 0;
}

export function isExpired(expiresAt: unknown, now: number = Date.now()): boolean {
  const ts = expiresAt ? new Date(String(expiresAt)).getTime() : NaN;
  if (!Number.isFinite(ts)) return true;
  return ts <= now;
}

export function expiryFrom(now: number = Date.now()): string {
  return new Date(now + CHALLENGE_TTL_MS).toISOString();
}