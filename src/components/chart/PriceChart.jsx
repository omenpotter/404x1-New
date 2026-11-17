import React, { useEffect, useMemo, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { tradesToCandles, fmtPrice } from '@/lib/xchart/candles.js';

const G = '#00ff88', R = '#ff4560'; // design-system BUY / SELL

export default function PriceChart({ trades, tf, showVol, onHover }) {
  const el = useRef(null), chartRef = useRef(null), candleRef = useRef(null), volRef = useRef(null);
  const candles = useMemo(() => tradesToCandles(trades, tf), [trades, tf]);

  useEffect(() => {
    const chart = createChart(el.current, {
      width: el.current.clientWidth, height: el.current.clientHeight,
      layout: { background: { color: 'rgba(0,0,0,0)' }, textColor: '#82998b', fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace", fontSize: 11 },
      grid: { vertLines: { color: 'rgba(0,255,136,0.05)' }, horzLines: { color: 'rgba(0,255,136,0.07)' } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(0,255,136,0.55)', width: 1, style: 3, labelBackgroundColor: '#0d1510' },
        horzLine: { color: 'rgba(0,255,136,0.55)', width: 1, style: 3, labelBackgroundColor: '#0d1510' },
      },
      timeScale: { borderColor: '#1d2b22', timeVisible: true, secondsVisible: false, rightOffset: 4 },
      rightPriceScale: { borderColor: '#1d2b22', scaleMargins: { top: 0.12, bottom: 0.18 } },
      handleScale: { axisPressedMouseMove: true }, kineticScroll: { touch: true, mouse: false },
    });
    const series = chart.addCandlestickSeries({
      upColor: G, downColor: R, borderUpColor: G, borderDownColor: R, wickUpColor: G, wickDownColor: R,
      lastValueVisible: false, priceLineVisible: false,
      priceFormat: { type: 'custom', formatter: fmtPrice, minMove: 1e-10 },
    });
    chartRef.current = chart; candleRef.current = series;
    chart.subscribeCrosshairMove(p => {
      const d = /** @type {any} */ (p.seriesData?.get(series));
      if (d && d.open !== undefined) {
        const c = candleMap.current.get(d.time);
        onHoverRef.current?.({ o: d.open, h: d.high, l: d.low, c: d.close, v: c?.volume ?? 0, trades: c?.trades ?? 0 });
      } else onHoverRef.current?.(null);
    });
    const ro = new ResizeObserver(() => { const node = el.current; if (node) chart.applyOptions({ width: node.clientWidth, height: node.clientHeight }); }); // guard: may fire after unmount
    ro.observe(el.current);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = candleRef.current = volRef.current = null; };
  }, []);

  const onHoverRef = useRef(onHover); onHoverRef.current = onHover;
  const candleMap = useRef(new Map());

  useEffect(() => {
    candleMap.current = new Map(candles.map(c => [c.time, c]));
    candleRef.current?.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    if (candles.length) chartRef.current?.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    const chart = chartRef.current; if (!chart) return;
    if (showVol && !volRef.current) {
      volRef.current = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    } else if (!showVol && volRef.current) { chart.removeSeries(volRef.current); volRef.current = null; }
    volRef.current?.setData(candles.map(x => ({ time: x.time, value: x.volume, color: x.close >= x.open ? 'rgba(0,255,136,0.32)' : 'rgba(255,69,96,0.32)' })));
  }, [showVol, candles]);

  return <div ref={el} style={{ position: 'absolute', inset: 0 }} data-testid="price-chart" />;
}
