import { useMarketStore } from '../stores/marketStore';

const SENTIMENT_COLORS: Record<string, string> = {
    extremely_long: '#ff2d4e',
    long_heavy: '#ff8c1a',
    neutral: '#6b6b80',
    short_heavy: '#00b4ff',
    extremely_short: '#a855f7',
};

const SENTIMENT_LABELS: Record<string, string> = {
    extremely_long: 'EXTREMELY LONG',
    long_heavy: 'LONG HEAVY',
    neutral: 'NEUTRAL',
    short_heavy: 'SHORT HEAVY',
    extremely_short: 'EXTREMELY SHORT',
};

function formatRate(r: number): string {
    return (r * 100).toFixed(4) + '%';
}

function formatUSD(v: number): string {
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
    return '$' + v.toLocaleString();
}

export function VWAFPanel() {
    const vwaf = useMarketStore((s) => s.vwaf);

    if (!vwaf) {
        return (
            <div className="panel">
                <div className="panel-header">
                    <span className="panel-title">VWAF · FUNDING</span>
                    <span className="panel-badge">LOADING</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    Waiting for data...
                </p>
            </div>
        );
    }

    const sentimentColor = SENTIMENT_COLORS[vwaf.sentiment] || '#6b6b80';
    const sentimentLabel = SENTIMENT_LABELS[vwaf.sentiment] || vwaf.sentiment;

    return (
        <div className="panel vwaf-panel">
            <div className="panel-header">
                <span className="panel-title">VWAF · FUNDING</span>
                <span
                    className="panel-badge"
                    style={{ background: sentimentColor + '22', color: sentimentColor, borderColor: sentimentColor + '44' }}
                >
                    {sentimentLabel}
                </span>
            </div>

            {/* Stats Grid */}
            <div className="vwaf-stats">
                <div className="vwaf-stat">
                    <span className="vwaf-stat-label">VWAF (8h)</span>
                    <span className="vwaf-stat-value" style={{ color: vwaf.vwaf >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {formatRate(vwaf.vwaf)}
                    </span>
                </div>
                <div className="vwaf-stat">
                    <span className="vwaf-stat-label">Annualized</span>
                    <span className="vwaf-stat-value" style={{ color: vwaf.vwaf_annualized >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {(vwaf.vwaf_annualized * 100).toFixed(1)}%
                    </span>
                </div>
                <div className="vwaf-stat">
                    <span className="vwaf-stat-label">Total OI</span>
                    <span className="vwaf-stat-value">{formatUSD(vwaf.total_oi_usd)}</span>
                </div>
                <div className="vwaf-stat">
                    <span className="vwaf-stat-label">Divergence</span>
                    <span className="vwaf-stat-value" style={{ color: 'var(--amber)' }}>
                        {formatRate(vwaf.divergence)}
                    </span>
                </div>
            </div>

            {/* Exchange Breakdown */}
            <div className="vwaf-exchanges">
                {vwaf.by_exchange.map((ex: { exchange: string; rate: number; oi_usd: number; weight: number }) => (
                    <div key={ex.exchange} className="vwaf-exchange-row">
                        <span className="vwaf-ex-name">{ex.exchange.toUpperCase()}</span>
                        <div className="vwaf-ex-bar-wrap">
                            <div
                                className="vwaf-ex-bar"
                                style={{
                                    width: `${(ex.weight * 100).toFixed(0)}%`,
                                    background: ex.rate >= 0
                                        ? `linear-gradient(90deg, rgba(0,232,122,0.3), rgba(0,232,122,0.1))`
                                        : `linear-gradient(90deg, rgba(255,45,78,0.3), rgba(255,45,78,0.1))`,
                                }}
                            />
                        </div>
                        <span className="vwaf-ex-rate" style={{ color: ex.rate >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {formatRate(ex.rate)}
                        </span>
                        <span className="vwaf-ex-oi">{formatUSD(ex.oi_usd)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
