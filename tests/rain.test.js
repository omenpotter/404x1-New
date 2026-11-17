import { describe, it, expect } from 'vitest';
import { RAIN_GLYPHS, randomGlyph } from '../src/lib/rainGlyphs.js';
describe('matrix rain glyphs', () => {
  it('contains exactly the English numerals 0-9', () => expect(RAIN_GLYPHS).toBe('0123456789'));
  it('every random glyph is a single digit, and all digits occur', () => {
    const seen = new Set();
    for (let i = 0; i < 5000; i++) { const g = randomGlyph(); expect(g).toMatch(/^[0-9]$/); seen.add(g); }
    expect(seen.size).toBe(10);
  });
  it('rain source contains no non-ASCII glyph literals', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(new URL('../src/components/MatrixRain.jsx', import.meta.url), 'utf8')).not.toMatch(/[^\x00-\x7F]/);
  });
});
