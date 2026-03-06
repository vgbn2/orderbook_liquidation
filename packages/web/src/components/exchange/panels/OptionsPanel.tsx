import { useMemo } from 'react';
import { useMarketDataStore } from '../../../stores/marketDataStore';
import { fmt, safe } from '../../../utils/safe';
import { PanelSkeleton } from '../../shared/PanelSkeleton';

export function OptionsPanel() {
    // ── 1. ALL HOOKS UNCONDITIONALLY ──
    const options = useMarketDataStore((s) => s.options);
    const tradesRaw = useMarketDataStore((s) => s.optionTrades);
    const lastPrice = useMarketDataStore((s) => s.lastPrice);

    const data = useMemo(() => {
        if (!options) return null;

        const gexByStrike = safe.obj(options.gex_by_strike);
        const gexEntries = Object.entries(gexByStrike)
            .map(([s, v]) => ({ strike: safe.num(s), gex: safe.num(v) }))
            .sort((a, b) => a.strike - b.strike);

        const maxAbsGex = Math.max(...gexEntries.map((e) => Math.abs(e.gex)), 1);
        const trades = safe.arr(tradesRaw);

        return {
            gexEntries,
            maxAbsGex,
            trades,
            totalGex: safe.num(options.total_gex),
            maxPain: safe.num(options.max_pain),
            gexFlip: safe.num(options.gex_flip),
            pcr: safe.num(options.pcr),
            regime: safe.str(options.regime, 'UNKNOWN').toUpperCase()
        };
    }, [options, tradesRaw]);

    // ── 2. EARLY RETURN AFTER HOOKS ──
    if (!options || !data) {
        return <PanelSkeleton label="OPTIONS GEX SUMMARY" />;
    }

    const { gexEntries, maxAbsGex, trades, totalGex, maxPain, gexFlip, pcr, regime } = data;

    // ── 3. RENDER ──
    return (
        <>
            {/* OVERVIEW STATS */}
            <div className="panel-section">
                <div className="p-head">
                    <span>OPTIONS · GEX</span>
                    <span className={`badge-${regime === 'PINNED' ? 'pinned' : 'live'}`} style={{
                        display: 'inline-flex', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                        background: regime === 'PINNED' ? 'var(--text-secondary)' : 'rgba(0,200,122,0.2)',
                        color: regime === 'PINNED' ? '#000' : 'var(--positive)',
                        border: `1px solid ${regime === 'PINNED' ? 'var(--text-secondary)' : 'rgba(0,200,122,0.3)'}`
                    }}>
                        {regime}
                    </span>
                </div>
                <div className="p-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div className="stat-card">
                            <div className="stat-label">MAX PAIN</div>
                            <div className="stat-value">{fmt.price(maxPain)}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">VOL FLIP</div>
                            <div className="stat-value">{fmt.price(gexFlip)}</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">NET GEX</div>
                            <div className={`stat-value ${totalGex > 0 ? 'pos' : 'neg'}`}>
                                {fmt.money(totalGex)}
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-label">PCR (OI)</div>
                            <div className={`stat-value ${pcr > 1 ? 'neg' : 'pos'}`}>
                                {fmt.num(pcr, 2)}
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
                            const HALF = 56; // max bar height each direction
                            const barH = Math.max(2, (Math.abs(e.gex) / maxAbsGex) * HALF);
                            const isPositive = e.gex >= 0;
                            const isNearSpot = lastPrice ? Math.abs(e.strike - lastPrice) / lastPrice < 0.005 : false;

                            return (
                                <div
                                    key={e.strike}
                                    title={`${fmt.price(e.strike)}: ${fmt.money(e.gex)}`}
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
                                    <div style={{ height: '50%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 0 }}>
                                        {!isPositive && (
                                            <div style={{ height: barH, background: 'var(--negative)', opacity: 0.8, borderRadius: '2px 2px 0 0' }} />
                                        )}
                                    </div>

                                    <div style={{ height: '50%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: 0 }}>
                                        {isPositive && (
                                            <div style={{ height: barH, background: 'var(--positive)', opacity: 0.8, borderRadius: '0 0 2px 2px' }} />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* Strike labels */}
                    <div style={{ display: 'flex', gap: 2, padding: '2px 2px 0', marginTop: 2 }}>
                        {gexEntries.map((e, i) => (
                            <div key={e.strike} style={{
                                flex: 1, textAlign: 'center', fontSize: 8, color: 'var(--text-muted)',
                                overflow: 'hidden', opacity: i % 3 === 1 ? 1 : 0,
                            }}>
                                {fmt.num(e.strike / 1000, 0)}k
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
                            {trades.slice(0, 4).map((t: any, i: number) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', background: 'var(--bg-raised)', padding: '4px 8px', borderRadius: '4px' }}>
                                    <span style={{ color: safe.str(t.type) === 'call' ? 'var(--positive)' : 'var(--negative)', fontWeight: 'bold' }}>{safe.str(t.type).toUpperCase()}</span>
                                    <span style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{fmt.price(t.strike)}</span>
                                    <span style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}>{fmt.money(safe.num(t.premium_usd))}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
