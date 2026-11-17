import React, { useEffect, useRef } from 'react';
import { randomGlyph } from '@/lib/rainGlyphs';
import { RAIN } from '@/lib/rainConfig';

/**
 * Lightweight procedural Matrix code rain on one <canvas>.
 * - ~24 fps cap, column count scales with viewport, DPR capped at 1.5
 * - each column keeps its glyph until it re-rolls (about twice a second) instead of
 *   changing every frame, so the numerals read as rain rather than flicker
 * - paused when the tab is hidden; a single static frame when prefers-reduced-motion
 * - purely decorative (aria-hidden), pointer-events none
 */
export default function MatrixRain() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let w = 0, h = 0, cols = 0, raf = 0, last = 0, running = false;
    let drops = [], glyphs = [], bright = [];
    const size = RAIN.cellSize;

    const roll = (i) => {
      glyphs[i] = randomGlyph();
      bright[i] = Math.random() < RAIN.brightChance;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const step = w < 640 ? RAIN.phoneColumnStep : 1;
      cols = Math.ceil(w / size / step);
      drops = Array.from({ length: cols }, () => Math.random() * -h / size);
      glyphs = [];
      bright = [];
      for (let i = 0; i < cols; i++) roll(i);
      canvas.dataset.step = String(step);
      ctx.fillStyle = RAIN.backdrop; ctx.fillRect(0, 0, w, h);
    };

    const paint = (advance) => {
      const step = Number(canvas.dataset.step || 1);
      ctx.fillStyle = `rgba(3,5,4,${RAIN.trailAlpha})`; ctx.fillRect(0, 0, w, h);
      ctx.font = `${size}px "JetBrains Mono Variable", monospace`;
      for (let i = 0; i < cols; i++) {
        if (advance) {
          if (Math.random() < RAIN.glyphRefreshChance) roll(i);
        }
        const x = i * size * step, y = drops[i] * size;
        ctx.fillStyle = bright[i] ? RAIN.headColor : RAIN.bodyColor;
        ctx.fillText(glyphs[i], x, y);
        if (!advance) continue;
        if (y > h && Math.random() > RAIN.resetChance) { drops[i] = 0; roll(i); } else drops[i] += RAIN.fallPxPerFrame;
      }
    };

    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      if (t - last < RAIN.frameMs) return; last = t;
      paint(true);
    };
    const start = () => { if (!running && !reduce?.matches && !document.hidden) { running = true; raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const vis = () => (document.hidden ? stop() : start());
    resize();
    if (reduce?.matches) {
      // One still frame: same colours and density, nothing keeps moving.
      for (let i = 0; i < cols; i++) drops[i] = Math.random() * h / size;
      for (let k = 0; k < 120; k++) paint(true);
      stop();
    } else start();
    window.addEventListener('resize', resize); document.addEventListener('visibilitychange', vis);
    const mq = () => (reduce.matches ? stop() : start()); reduce?.addEventListener?.('change', mq);
    return () => { stop(); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', vis); reduce?.removeEventListener?.('change', mq); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}