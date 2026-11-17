// Characters allowed in the Matrix rain: English numerals only.
export const RAIN_GLYPHS = '0123456789';
export const randomGlyph = (rnd = Math.random) => RAIN_GLYPHS[Math.floor(rnd() * RAIN_GLYPHS.length)];
