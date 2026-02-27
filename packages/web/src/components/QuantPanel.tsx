import { useMarketStore } from '../stores/marketStore';

export function QuantPanel() {
    const quantSnapshot = useMarketStore((s) => s.quantSnapshot);

    if (!quantSnapshot) {
        return (
            <div className="panel-section">
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    AWAITING ANALYSIS...
                </div>
            </div>
        );
    }

    const { meta, sigmaGrid, quantiles, macroBreakdown } = quantSnapshot;

    return (
        <>
            {/* MARKET REGIME */}
            <div className="panel-section">
                <div className="p-head">
                    <span>MARKET REGIME</span>
                    <span style={{ color: 'var(--accent)' }}>VOLATILE</span>
                </div>
                <div className="p-body">
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div className="stat-card" style={{ flex: 1 }}>
                            <div className="stat-label">DRIFT (1D)</div>
                            <div className={`stat-value ${meta?.adjustedDrift > 0 ? 'pos' : meta?.adjustedDrift < 0 ? 'neg' : ''}`}>
                                {meta?.adjustedDrift > 0 ? '+' : ''}{meta?.adjustedDrift?.toFixed(3)}%
                            </div>
                        </div>
                        <div className="stat-card" style={{ flex: 1 }}>
                            <div className="stat-label">VOLATILITY</div>
                            <div className="stat-value">{meta?.stepVolatility?.toFixed(3)}%</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MACRO BREAKDOWN (CORRELATIONS) */}
            <div className="panel-section">
                <div className="p-head">
                    <span>CORRELATIONS</span>
                </div>
                <div className="p-body">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-overlay)' }}>
                                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)' }}>TICKER</th>
                                <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)' }}>CORR</th>
                                <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-muted)' }}>Z</th>
                            </tr>
                        </thead>
                        <tbody>
                            {macroBreakdown?.map((m: any) => (
                                <tr key={m.ticker} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: '4px 8px', fontWeight: 'bold' }}>{m.ticker}</td>
                                    <td style={{ textAlign: 'right', padding: '4px 8px', color: m.correlation > 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                        {m.correlation > 0 ? '+' : ''}{m.correlation.toFixed(2)}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '4px 8px', color: m.zScore > 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                        {m.zScore > 0 ? '+' : ''}{m.zScore.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* QUANTILES */}
            <div className="panel-section">
                <div className="p-head">
                    <span>QUANTILES ({meta?.horizon}D)</span>
                </div>
                <div className="p-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {quantiles && Object.entries(quantiles).map(([key, val]: [string, any]) => {
                            const label = key === 'p5' ? 'P05' : key === 'p25' ? 'P25' : key === 'p50' ? 'MED' : key === 'p75' ? 'P75' : 'P95';
                            return (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-raised)', padding: '4px 8px', borderRadius: '4px' }}>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>{label}</span>
                                    <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>${val.price?.toLocaleString()}</span>
                                    <span style={{ fontSize: '10px', color: val.pctMove >= 0 ? 'var(--positive)' : 'var(--negative)', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {val.pctMove >= 0 ? '+' : ''}{val.pctMove?.toFixed(1)}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* DISTRIBUTION */}
            <div className="panel-section">
                <div className="p-head">
                    <span>SIGMA DISTRIBUTION</span>
                </div>
                <div className="p-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {sigmaGrid?.map((row: any) => (
                            <div key={row.sigma} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '24px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
                                    {row.sigma > 0 ? '+' : ''}{row.sigma}σ
                                </span>
                                <div style={{ flex: 1, height: '6px', background: 'var(--bg-overlay)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            width: `${Math.min(row.probability, 100)}%`,
                                            height: '100%',
                                            background: row.pctMove >= 0 ? 'var(--positive)' : 'var(--negative)',
                                            opacity: 0.6
                                        }}
                                    />
                                </div>
                                <span style={{ width: '60px', textAlign: 'right', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                                    ${(row.price / 1000).toFixed(1)}K
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
