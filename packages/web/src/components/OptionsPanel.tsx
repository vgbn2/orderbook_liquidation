import { useMarketStore } from '../stores/marketStore';

export function OptionsPanel() {
    const options = useMarketStore((s) => s.options);
    const trades = useMarketStore((s) => s.optionTrades);

    if (!options) {
        return (
            <div className="panel-section">
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    AWAITING GEX...
                </div>
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
        <>
            {/* OVERVIEW STATS */}
            <div className="panel-section">
                <div className="p-head">
                    <span>OPTIONS · GEX</span>
                    <span className={`badge-${options.regime === 'pinned' ? 'pinned' : 'live'}`} style={{
                        display: 'inline-flex', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                        background: options.regime === 'pinned' ? 'var(--text-secondary)' : 'rgba(0,200,122,0.2)',
                        color: options.regime === 'pinned' ? '#000' : 'var(--positive)',
                        border: `1px solid ${options.regime === 'pinned' ? 'var(--text-secondary)' : 'rgba(0,200,122,0.3)'}`
                    }}>
                        {options.regime.toUpperCase()}
                    </span>
                </div>
                <div className="p-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div className="stat-card">
                            <div className="stat-label">MAX PAIN</div>
                            <div className="stat-value">{fmtPrice(options.max_pain)}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">VOL FLIP</div>
                            <div className="stat-value">{options.gex_flip ? fmtPrice(options.gex_flip) : '—'}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">NET GEX</div>
                            <div className={`stat-value ${options.total_gex > 0 ? 'pos' : 'neg'}`}>
                                {fmtGex(options.total_gex)}
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">PCR (OI)</div>
                            <div className={`stat-value ${options.pcr > 1 ? 'neg' : 'pos'}`}>
                                {options.pcr.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* GEX BY STRIKE */}
            <div className="panel-section">
                <div className="p-head">
                    <span>GEX BY STRIKE</span>
                </div>
                <div className="p-body">
                    <div style={{ height: '80px', display: 'flex', alignItems: 'flex-end', gap: '2px', borderBottom: '1px solid var(--border-medium)', paddingBottom: '2px' }}>
                        {gexEntries.map((e) => {
                            const pct = (Math.abs(e.gex) / maxAbsGex) * 80;
                            const isPositive = e.gex >= 0;
                            return (
                                <div key={e.strike} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                                    <div
                                        style={{
                                            height: `${Math.max(2, pct)}px`,
                                            background: isPositive ? 'var(--positive)' : 'var(--negative)',
                                            opacity: 0.7,
                                            borderRadius: '1px'
                                        }}
                                        title={`${(e.strike / 1000).toFixed(1)}K: ${fmtGex(e.gex)}`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* WHALE FLOW */}
            {trades.length > 0 && (
                <div className="panel-section">
                    <div className="p-head">
                        <span>WHALE FLOW</span>
                    </div>
                    <div className="p-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {trades.slice(0, 4).map((t, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', background: 'var(--bg-raised)', padding: '4px 8px', borderRadius: '4px' }}>
                                    <span style={{ color: t.type === 'call' ? 'var(--positive)' : 'var(--negative)', fontWeight: 'bold' }}>{t.type.toUpperCase()}</span>
                                    <span style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>${(t.strike / 1000).toFixed(1)}K</span>
                                    <span style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}>${t.premium_usd >= 1e6 ? `${(t.premium_usd / 1e6).toFixed(1)}M` : `${(t.premium_usd / 1e3).toFixed(0)}K`}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
