import React from 'react';
import MatrixRain from '@/components/MatrixRain';

const UserNotRegisteredError = () => {
  return (
    <div className="ds-shell ds-center">
      <div className="ds-atmos" aria-hidden="true"><div className="ds-vignette" /><div className="ds-grid" /><MatrixRain /><div className="ds-scan" /></div>
      <main className="ds-glass ds-panel-narrow ds-rise" role="alert">
        <p className="ds-eyebrow" style={{ color: 'var(--amber)' }}>ACCESS RESTRICTED</p>
        <h1 className="ds-h1" style={{ marginTop: 10 }}>Access Restricted</h1>
        <p className="ds-sub">
          You are not registered to use this application. Please contact the app administrator to request access.
        </p>
        <div className="ds-card" style={{ padding: 16, marginTop: 18, textAlign: 'left', fontSize: 14, color: 'var(--text-dim)' }}>
          <p style={{ margin: 0 }}>If you believe this is an error, you can:</p>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Verify you are logged in with the correct account</li>
            <li>Contact the app administrator for access</li>
            <li>Try logging out and back in again</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default UserNotRegisteredError;
