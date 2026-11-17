// Tuning for the decorative Matrix rain.
// Phase 2C: fall speed halved and per-column glyph churn cut, so the columns drift
// instead of racing and the numerals stop flickering. Colours, glyph set, trail
// fade, column density and accessibility behaviour are unchanged.
export const RAIN = {
  cellSize: 16,
  frameMs: 42, // ~24 fps cap
  fallPxPerFrame: 0.275, // was 0.55 per frame
  trailAlpha: 0.14, // per-frame fade: keeps the existing trail length
  glyphRefreshChance: 0.1, // each column re-rolls its glyph about twice a second
  brightChance: 0.06, // a pale head is decided per column, not per frame
  headColor: '#c8ffe2',
  bodyColor: '#00ff41',
  backdrop: '#030504',
  phoneColumnStep: 2, // half the columns on phones
  resetChance: 0.975,
};