import React, { useEffect, useRef } from 'react';
import { randomGlyph } from '@/lib/rainGlyphs';
import { RAIN } from '@/lib/rainConfig';

/**
 * Matrix number rain on one <canvas>, matching the 404X1_Matrix_Rain reference:
 * - every column is a stream of 0-9 digits with a pale glowing head and a tail
 *   that fades out glyph by glyph
 * - columns fall at 15-40 px/s on a 17px grid and recycle above the top edge
 * - time-based motion, so a slower frame rate never changes the speed
 * - paused when the tab is hidden; nothing runs when the visitor asks for
 *   reduced motion (the stylesheet also hides the canvas in that case)
 * - purely decorative: aria-hidden, pointer-events none
 */
export default function MatrixRain() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const size = RAIN.cellSize;
    let w = 0, h = 0, cols = [], raf = 0, running = false, prev = 0, drawn = 0;

    const speed = () => RAIN.fallMin + Math.random() * (RAIN.fallMax - RAIN.fallMin);

    const digits = () => {
      const count = Math.ceil(h / size) + RAIN.extraDigits;
      const out = [];
      for (let i = 0; i < count; i++) out.push(randomGlyph());
      return out;
    };

    const column = (i) => ({
      x: i * size + RAIN.spawnPadX,
      y: Math.random() * (h + RAIN.spawnSpread) - RAIN.spawnAbove,
      speed: speed(),
      digits: digits(),
      len: RAIN.trailMin + Math.floor(Math.random() * RAIN.trailExtra),
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth || window.innerWidth;
      h = canvas.clientHeight || window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.ceil(w / size);
      cols = [];
      for (let i = 0; i < count; i++) cols.push(column(i));
      prev = 0; drawn = 0;
    };

    const paint = (dt) => {
      ctx.fillStyle = RAIN.backdrop; ctx.fillRect(0, 0, w, h);
      ctx.font = RAIN.font;
      ctx.shadowColor = RAIN.glowColor;
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        if (dt) {
          col.y += col.speed * dt;
          if (col.y - col.len * size > h) {
            col.y = -Math.random() * RAIN.respawnAbove;
            col.speed = speed();
          }
        }
        const head = Math.floor(col.y / size) * size;
        const n = col.digits.length;
        for (let j = 0; j < col.len; j++) {
          const y = head - j * size;
          if (y < 0 || y > h + size) continue;
          ctx.shadowBlur = j === 0 ? RAIN.headGlow : RAIN.bodyGlow;
          ctx.fillStyle = j === 0
            ? RAIN.headColor
            : `rgba(${RAIN.bodyColor},${Math.pow(1 - j / col.len, RAIN.fadeExponent) * RAIN.bodyAlpha})`;
          ctx.fillText(col.digits[((Math.floor(y / size) % n) + n) % n], col.x, y);
        }
      }
      ctx.shadowBlur = 0;
    };

    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      const minFrame = w < RAIN.phoneWidth ? RAIN.phoneFrameMs : 0;
      if (t - drawn < minFrame) return;
      const dt = Math.min((t - prev) / 1000, RAIN.maxDt);
      prev = t; drawn = t;
      paint(dt);
    };

    const start = () => {
      if (running || reduce?.matches || document.hidden) return;
      running = true; prev = 0; drawn = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const vis = () => (document.hidden ? stop() : start());
    const mq = () => (reduce?.matches ? stop() : start());

    resize();
    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', vis);
    reduce?.addEventListener?.('change', mq);
    return () => {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', vis);
      reduce?.removeEventListener?.('change', mq);
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}