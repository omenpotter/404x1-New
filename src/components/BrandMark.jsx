import React from 'react';

/** 404X1 mark: a 4-0-4 "signal lost" glyph inside a hex frame. Pure SVG, no assets. */
export default function BrandMark({ className = 'ds-brand-mark', title = '404X1' }) {
  return (
    <svg className={className} viewBox="0 0 32 32" role="img" aria-label={title} focusable="false">
      <path d="M16 1.5 29 9v14L16 30.5 3 23V9z" fill="rgba(0,255,136,.06)" stroke="#00ff88" strokeWidth="1.4" />
      {/* 4 0 4 */}
      <g fill="none" stroke="#00ff88" strokeWidth="1.9" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M10 11.5 6.2 18.2h5.6M10 11.5v10.5" />
        <rect x="13.4" y="11.5" width="5.2" height="10.5" rx="2.4" stroke="#00c96b" />
        <path d="M26 11.5l-3.8 6.7h5.6M26 11.5V22" />
      </g>
    </svg>
  );
}
