import React from 'react';

/** Presentation-only gate card ("login required" / "access denied"). Does not decide access. */
export default function GateScreen({ tone = 'login', title = '', message = '', href = undefined, linkLabel = '' }) {
  const bad = tone === 'denied';
  return (
    <div className="ds-center" style={{ minHeight: 'calc(100vh - var(--nav-h))' }}>
      <section className="ds-glass ds-panel-narrow ds-rise" role={bad ? 'alert' : 'status'}>
        <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" style={{ color: bad ? 'var(--red)' : 'var(--green)', filter: 'drop-shadow(0 0 10px currentColor)' }}>
          <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="15.5" r="1.3" fill="currentColor" />
        </svg>
        <p className="ds-eyebrow" style={{ justifyContent: 'center', marginTop: 12, color: bad ? 'var(--red)' : 'var(--green)' }}>{bad ? 'ACCESS DENIED' : 'LOGIN REQUIRED'}</p>
        <h1 className="ds-h2" style={{ marginTop: 10 }}>{title}</h1>
        {message && <p className="ds-sub">{message}</p>}
        <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!bad && <button className="ds-btn solid" onClick={() => window.dispatchEvent(new CustomEvent('open_wallet_modal'))}>Connect wallet</button>}
          {href && <a className="ds-btn ghost" href={href}>← {linkLabel}</a>}
        </div>
      </section>
    </div>
  );
}
