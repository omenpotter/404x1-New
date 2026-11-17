import { describe, it, expect } from 'vitest';
import { RAIN_GLYPHS, randomGlyph } from '../src/lib/rainGlyphs.js';
import { RAIN } from '../src/lib/rainConfig.js';
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

describe('phase 2C rain tuning', () => {
  it('falls at half the previous 0.55 cells per frame', () => expect(RAIN.fallPxPerFrame).toBeCloseTo(0.55 / 2, 5));
  it('re-rolls a column glyph far less often than once per frame', () => {
    expect(RAIN.glyphRefreshChance).toBeGreaterThan(0);
    expect(RAIN.glyphRefreshChance).toBeLessThanOrEqual(0.15);
  });
  it('keeps the approved trail fade, colours, density and frame cap', () => {
    expect(RAIN.trailAlpha).toBe(0.14);
    expect(RAIN.bodyColor).toBe('#00ff41');
    expect(RAIN.headColor).toBe('#c8ffe2');
    expect(RAIN.backdrop).toBe('#030504');
    expect(RAIN.phoneColumnStep).toBe(2);
    expect(RAIN.frameMs).toBe(42);
  });
});