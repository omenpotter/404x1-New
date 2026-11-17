import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import MatrixRain from '@/components/MatrixRain';
import BrandMark from '@/components/BrandMark';

export default function PageNotFound({}) {
    const location = useLocation();
    const pageName = location.pathname.substring(1);

    const { data: authData, isFetched } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                const user = await base44.auth.me();
                return { user, isAuthenticated: true };
            } catch (error) {
                return { user: null, isAuthenticated: false };
            }
        }
    });

    return (
        <div className="ds-shell ds-center">
            <div className="ds-atmos" aria-hidden="true"><div className="ds-vignette" /><div className="ds-grid" /><MatrixRain /><div className="ds-scan" /></div>
            <main className="ds-glass ds-panel-narrow ds-rise" role="main">
                <BrandMark className="ds-brand-mark ds-brand-mark-lg" />
                <p className="ds-eyebrow">SYSTEM ERROR</p>
                <h1 className="ds-h1 ds-glitch" data-text="404">404</h1>
                <h2 className="ds-h2" style={{ marginTop: 6 }}>Page Not Found</h2>
                <p className="ds-sub">
                    The page <span className="num" style={{ color: 'var(--green)' }}>"{pageName}"</span> could not be found in this application.
                </p>

                {isFetched && authData.isAuthenticated && authData.user?.role === 'admin' && (
                    <div className="ds-card" style={{ padding: 14, marginTop: 18, textAlign: 'left' }}>
                        <p className="ds-eyebrow" style={{ color: 'var(--amber)' }}>Admin note</p>
                        <p className="ds-sub" style={{ marginTop: 6 }}>
                            This could mean that the AI hasn't implemented this page yet. Ask it to implement it in the chat.
                        </p>
                    </div>
                )}

                <div style={{ marginTop: 22 }}>
                    <button onClick={() => window.location.href = '/'} className="ds-btn solid">Go Home</button>
                </div>
            </main>
        </div>
    )
}
