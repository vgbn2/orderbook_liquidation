import { useMarketStore } from '../stores/marketStore';

export function OptionsPanel() {
    const options = useMarketStore((s) => s.options);
    const trades = useMarketStore((s) => s.optionTrades);

    if (!options) {
        return (
            <div className="panel">
                <div className="panel-header">
                    <span className="panel-title">OPTIONS · GEX</span>
                    <span className="panel-badge">LIVE</span>
                </div>
                <p className="ob-waiting">Waiting for data...</p>
            </div>
        );
    }

    const fmtPrice = (p: number) =>
        '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });

    const fmtGex = (g: number) => {
        const sign = g > 0 ? '+' : '';
        if (Math.abs(g) >= 1e6) return `${sign}${(g / 1e6).toFixed(0)}M`;
        if (Math.abs(g) >= 1e3) return `${sign}${(g / 1e3).toFixed(0)}K`;
        return `${sign}${g.toFixed(0)}`;
    };

    // GEX histogram data
    const gexEntries = Object.entries(options.gex_by_strike)
        .map(([s, v]) => ({ strike: Number(s), gex: v as number }))
        .sort((a, b) => a.strike - b.strike);
    const maxAbsGex = Math.max(...gexEntries.map((e) => Math.abs(e.gex)), 1);

    return (
        <div className="panel opt-panel">
            <div className="panel-header">
                <span className="panel-title">OPTIONS · GEX</span>
                <span className={`panel-badge ${options.regime === 'pinned' ? 'badge-pinned' : 'badge-explosive'}`}>
                    {options.regime === 'pinned' ? '⊡ PINNED' : '⚡ EXPLOSIVE'}
                </span>
            </div>

            {/* Stats Grid */}
            <div className="opt-stats">
                <div className="opt-stat">
                    <div className="opt-stat-label">Max Pain</div>
                    <div className="opt-stat-value">{fmtPrice(options.max_pain)}</div>
                </div>
                <div className="opt-stat">
                    <div className="opt-stat-label">GEX Flip</div>
                    <div className="opt-stat-value">{options.gex_flip ? fmtPrice(options.gex_flip) : '—'}</div>
                </div>
                <div className="opt-stat">
                    <div className="opt-stat-label">Total GEX</div>
                    <div className="opt-stat-value" style={{ color: options.total_gex > 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmtGex(options.total_gex)}
                    </div>
                </div>
                <div className="opt-stat">
                    <div className="opt-stat-label">OI PCR</div>
                    <div className="opt-stat-value" style={{ color: options.pcr > 1 ? 'var(--red)' : 'var(--green)' }}>
                        {options.pcr.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* GEX Histogram */}
            <div className="gex-histogram">
                {gexEntries.map((e) => {
                    const pct = (Math.abs(e.gex) / maxAbsGex) * 100;
                    const isPositive = e.gex >= 0;
                    return (
                        <div key={e.strike} className="gex-bar-wrap">
                            <div
                                className={`gex-bar ${isPositive ? 'gex-positive' : 'gex-negative'}`}
                                style={{ height: `${Math.max(3, pct)}%` }}
                                title={`${(e.strike / 1000).toFixed(0)}K: ${fmtGex(e.gex)}`}
                            />
                            {gexEntries.indexOf(e) % 3 === 0 && (
                                <span className="gex-label">{(e.strike / 1000).toFixed(0)}K</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Large Trades Feed */}
            {trades.length > 0 && (
                <div className="trades-feed">
                    <div className="trades-header">LARGE TRADES</div>
                    {trades.slice(0, 5).map((t, i) => (
                        <div key={i} className="trade-item">
                            <span className={`trade-type ${t.type === 'call' ? 'trade-call' : 'trade-put'}`}>
                                {t.type.toUpperCase()}
                            </span>
                            <span className="trade-strike">{fmtPrice(t.strike)}</span>
                            <span className="trade-info">IV {(t.iv * 100).toFixed(0)}%</span>
                            <span className="trade-premium">
                                ${t.premium_usd >= 1e6 ? `${(t.premium_usd / 1e6).toFixed(2)}M` : `${(t.premium_usd / 1e3).toFixed(0)}K`}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
