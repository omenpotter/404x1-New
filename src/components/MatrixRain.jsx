import React, { useEffect, useRef } from 'react';

const GLYPHS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ404X1';

/**
 * Lightweight procedural Matrix code rain on one <canvas>.
 * - ~24 fps cap, column count scales with viewport, DPR capped at 1.5
 * - paused when the tab is hidden; a single static frame when prefers-reduced-motion
 * - purely decorative (aria-hidden), pointer-events none
 */
export default function MatrixRain() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let w = 0, h = 0, cols = 0, drops = [], raf = 0, last = 0, running = false;
    const size = 16;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const step = w < 640 ? 2 : 1; // half the columns on phones
      cols = Math.ceil(w / size / step);
      drops = Array.from({ length: cols }, () => Math.random() * -h / size);
      canvas.dataset.step = String(step);
      ctx.fillStyle = '#030504'; ctx.fillRect(0, 0, w, h);
    };
    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 42) return; last = t;
      const step = Number(canvas.dataset.step || 1);
      ctx.fillStyle = 'rgba(3,5,4,0.14)'; ctx.fillRect(0, 0, w, h);
      ctx.font = `${size}px "JetBrains Mono Variable", monospace`;
      for (let i = 0; i < cols; i++) {
        const x = i * size * step, y = drops[i] * size;
        ctx.fillStyle = Math.random() > 0.97 ? '#c8ffe2' : '#00ff41';
        ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], x, y);
        if (y > h && Math.random() > 0.975) drops[i] = 0; else drops[i] += 0.55;
      }
    };
    const start = () => { if (!running && !reduce?.matches && !document.hidden) { running = true; raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const vis = () => (document.hidden ? stop() : start());
    resize();
    if (reduce?.matches) { for (let i = 0; i < 40; i++) frame(i * 50); stop(); } else start();
    window.addEventListener('resize', resize); document.addEventListener('visibilitychange', vis);
    const mq = () => (reduce.matches ? stop() : start()); reduce?.addEventListener?.('change', mq);
    return () => { stop(); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', vis); reduce?.removeEventListener?.('change', mq); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}
