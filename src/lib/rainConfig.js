// Tuning for the decorative Matrix rain.
// Values mirror the approved 404X1_Matrix_Rain.html reference: 17px cells, 15px
// numerals, 15-40 px/s fall speed, 17-36 glyph trails, a pale glowing head and a
// per-glyph alpha fade down the tail.
export const RAIN = {
  cellSize: 17,
  font: '15px monospace',
  spawnPadX: 2,
  fallMin: 15, // px per second
  fallMax: 40,
  spawnAbove: 150, // first spawn starts this far above the top edge
  spawnSpread: 400, // plus a random offset across the viewport height
  respawnAbove: 250, // recycled columns restart within this distance above the top
  extraDigits: 80, // random digits held per column beyond one screen height
  trailMin: 17, // glyphs per stream
  trailExtra: 20,
  headColor: '#d4ffe0',
  headGlow: 10,
  bodyColor: '0,255,65', // rgb components, alpha is applied per glyph
  bodyGlow: 3,
  glowColor: '#00ff41',
  fadeExponent: 1.6,
  bodyAlpha: 0.85,
  maxDt: 0.05, // seconds; keeps a stalled frame from teleporting the rain
  phoneWidth: 640,
  phoneFrameMs: 33, // phones draw at ~30 fps; motion stays time-based, so speed is identical
  backdrop: '#030504',
};