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

describe('reference rain tuning', () => {
  it('uses the 17px grid and 15px numeral font', () => {
    expect(RAIN.cellSize).toBe(17);
    expect(RAIN.font).toBe('15px monospace');
  });
  it('falls at 15-40 px per second', () => {
    expect(RAIN.fallMin).toBe(15);
    expect(RAIN.fallMax).toBe(40);
  });
  it('streams 17-36 digits per column', () => {
    expect(RAIN.trailMin).toBe(17);
    expect(RAIN.trailExtra).toBe(20);
    expect(RAIN.extraDigits).toBe(80);
  });
  it('keeps the pale glowing head and the green fading tail', () => {
    expect(RAIN.headColor).toBe('#d4ffe0');
    expect(RAIN.headGlow).toBe(10);
    expect(RAIN.bodyColor).toBe('0,255,65');
    expect(RAIN.bodyGlow).toBe(3);
    expect(RAIN.glowColor).toBe('#00ff41');
    expect(RAIN.fadeExponent).toBe(1.6);
    expect(RAIN.bodyAlpha).toBe(0.85);
  });
  it('keeps the backdrop and the stalled-frame clamp', () => {
    expect(RAIN.backdrop).toBe('#030504');
    expect(RAIN.maxDt).toBe(0.05);
  });
});