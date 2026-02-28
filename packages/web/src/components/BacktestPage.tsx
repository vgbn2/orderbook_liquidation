import { BacktestPanel } from './BacktestPanel';

export function BacktestPage() {
    return (
        <div style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            background: 'var(--bg-base)',
        }}>

            {/* LEFT — strategy config (existing BacktestPanel component) */}
            <div style={{
                width: 320,
                borderRight: '1px solid var(--border-medium)',
                flexShrink: 0,
                overflowY: 'auto',
                background: 'var(--bg-surface)'
            }}>
                <BacktestPanel />
            </div>

            {/* RIGHT — results */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                <div style={{
                    maxWidth: 1000,
                    margin: '0 auto',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 8,
                    padding: 24,
                    minHeight: 400
                }}>
                    <div className="label" style={{ marginBottom: 16, fontSize: 14 }}>ADVANCED RESULTS & TRADE LOGS</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Detailed performance metrics, equity curve, and trade breakdown will be displayed here.</p>
                </div>
            </div>
        </div>
    );
}
