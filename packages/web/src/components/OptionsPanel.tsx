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

    const fmtPrice = (p?: number | null) =>
        p != null ? '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';

    const fmtGex = (g?: number | null) => {
        if (!g) return '—';
        const sign = g > 0 ? '+' : '';
        if (Math.abs(g) >= 1e6) return `${sign}${(g / 1e6).toFixed(0)}M`;
        if (Math.abs(g) >= 1e3) return `${sign}${(g / 1e3).toFixed(0)}K`;
        return `${sign}${g.toFixed(0)}`;
    };

    // GEX histogram data
    const gexEntries = Object.entries(options.gex_by_strike || {})
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
                        {options.regime?.toUpperCase() || 'UNKNOWN'}
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
                            <div className="stat-value">{fmtPrice(options.gex_flip)}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">NET GEX</div>
                            <div className={`stat-value ${(options.total_gex || 0) > 0 ? 'pos' : 'neg'}`}>
                                {fmtGex(options.total_gex)}
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">PCR (OI)</div>
                            <div className={`stat-value ${(options.pcr || 0) > 1 ? 'neg' : 'pos'}`}>
                                {options.pcr?.toFixed(2) || '—'}
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
                    <div style={{ height: 120, position: 'relative', display: 'flex', alignItems: 'stretch', gap: 2, padding: '0 2px' }}>
                        {/* Zero baseline */}
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'var(--border-strong)', zIndex: 2, pointerEvents: 'none' }} />

                        {gexEntries.map((e) => {
                            const HALF = 56; // max bar height each direction (leaves space)
                            const barH = Math.max(2, (Math.abs(e.gex) / maxAbsGex) * HALF);
                            const isPositive = e.gex >= 0;

                            const spotPrice = useMarketStore.getState().lastPrice;
                            const isNearSpot = spotPrice ? Math.abs(e.strike - spotPrice) / spotPrice < 0.005 : false;

                            return (
                                <div
                                    key={e.strike}
                                    title={`${(e.strike / 1000).toFixed(1)}K: ${fmtGex(e.gex)}`}
                                    style={{
                                        flex: 1,
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'stretch',
                                        background: isNearSpot ? 'rgba(255,255,255,0.04)' : 'transparent',
                                        borderLeft: isNearSpot ? '1px solid rgba(255,255,255,0.2)' : 'none',
                                    }}
                                >
                                    {/* TOP HALF — negative bars grow downward into this space */}
                                    <div style={{ height: '50%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 0 }}>
                                        {!isPositive && (
                                            <div style={{ height: barH, background: 'var(--negative)', opacity: 0.8, borderRadius: '2px 2px 0 0' }} />
                                        )}
                                    </div>

                                    {/* BOTTOM HALF — positive bars grow upward into this space */}
                                    <div style={{ height: '50%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: 0 }}>
                                        {isPositive && (
                                            <div style={{ height: barH, background: 'var(--positive)', opacity: 0.8, borderRadius: '0 0 2px 2px' }} />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* Strike labels row — sparse, below the histogram div */}
                    <div style={{ display: 'flex', gap: 2, padding: '2px 2px 0', marginTop: 2 }}>
                        {gexEntries.map((e, i) => (
                            <div key={e.strike} style={{
                                flex: 1,
                                textAlign: 'center',
                                fontSize: 8,
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                // Only show every 3rd label to avoid crowding
                                opacity: i % 3 === 1 ? 1 : 0,
                            }}>
                                {(e.strike / 1000).toFixed(0)}k
                            </div>
                        ))}
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
