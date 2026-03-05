import { useMemo } from 'react';
import { useMarketDataStore } from '../../stores/marketDataStore';
import { useCandleStore } from '../../stores/candleStore';

// ── Regime classifier ─────────────────────────────────────────
function classifyRegime(drift: number, vol: number) {
    if (vol > 3) return { icon: '⚡', label: 'VOLATILE', color: '#ffeb3b' };
    if (drift > 0.3) return { icon: '📈', label: 'TRENDING UP', color: 'var(--positive)' };
    if (drift < -0.3) return { icon: '📉', label: 'TRENDING DOWN', color: 'var(--negative)' };
    return { icon: '◎', label: 'RANGE', color: 'var(--text-muted)' };
}

// ── Signal grade from aggregate data ──────────────────────────
function computeSignalGrade(bias: any, liqRatio: number, optionsBias: string | null) {
    let score = 0;
    if (bias) {
        if (bias.direction === 'BULLISH') score += bias.confidence > 15 ? 2 : 1;
        else score -= bias.confidence > 15 ? 2 : 1;
    }
    if (liqRatio > 1.4) score += 1;   // More shorts liquidated = bullish
    else if (liqRatio < 0.7) score -= 1; // More longs liquidated = bearish
    if (optionsBias === 'CALL') score += 1;
    else if (optionsBias === 'PUT') score -= 1;

    if (score >= 3) return { grade: 'A', label: 'STRONG BUY', color: 'var(--positive)', bg: 'rgba(0,232,122,0.12)' };
    if (score >= 1) return { grade: 'B', label: 'BUY', color: 'var(--positive)', bg: 'rgba(0,232,122,0.06)' };
    if (score <= -3) return { grade: 'A', label: 'STRONG SELL', color: 'var(--negative)', bg: 'rgba(255,59,92,0.12)' };
    if (score <= -1) return { grade: 'B', label: 'SELL', color: 'var(--negative)', bg: 'rgba(255,59,92,0.06)' };
    return { grade: 'C', label: 'NEUTRAL', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)' };
}

function formatPrice(p: number): string {
    if (typeof p !== 'number' || isNaN(p)) return '$0';
    if (p < 0.01) return '$' + p.toPrecision(3);
    if (p < 1) return '$' + p.toFixed(4);
    if (p < 1000) return '$' + p.toFixed(2);
    return '$' + p.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function TerminalSummaryPanel() {
    const quantSnapshot = useMarketDataStore(s => s.quantSnapshot);
    const options = useMarketDataStore(s => s.options);
    const confluenceZones = useMarketDataStore(s => s.confluenceZones);
    const lastPrice = useMarketDataStore(s => s.lastPrice);
    const symbol = useCandleStore(s => s.symbol);

    // Compute bias from sigma grid
    const bias = useMemo(() => {
        if (!quantSnapshot?.sigmaGrid?.length) return null;
        const sg = quantSnapshot.sigmaGrid;
        const totalProb = sg.reduce((s: number, r: any) => s + r.probability, 0) || 1;
        const expectedMove = sg.reduce((s: number, r: any) => s + (r.pctMove * r.probability) / totalProb, 0);
        const bullWeight = sg.filter((r: any) => r.pctMove >= 0).reduce((s: number, r: any) => s + r.probability, 0);
        const bearWeight = sg.filter((r: any) => r.pctMove < 0).reduce((s: number, r: any) => s + r.probability, 0);
        const total = bullWeight + bearWeight || 1;
        const bullPct = (bullWeight / total) * 100;
        const bearPct = (bearWeight / total) * 100;
        const direction = expectedMove >= 0 ? 'BULLISH' : 'BEARISH';
        const confidence = Math.abs(bullPct - bearPct);
        return { direction, expectedMove, bullPct, bearPct, confidence };
    }, [quantSnapshot?.sigmaGrid]);

    const regime = quantSnapshot?.meta
        ? classifyRegime(quantSnapshot.meta.adjustedDrift, quantSnapshot.meta.stepVolatility)
        : null;

    // Simple liq ratio proxy
    const liqRatio = 1.0; // TODO: derive from liquidationEngine once wired

    // Options bias
    const optionsBias = options?.total_gex != null ? (options.total_gex > 0 ? 'CALL' : 'PUT') : null;

    const signal = computeSignalGrade(bias, liqRatio, optionsBias);

    // Important price areas from quantiles + confluence
    const priceAreas = useMemo(() => {
        const areas: { label: string; price: number; type: 'support' | 'resistance' | 'neutral' }[] = [];
        if (quantSnapshot?.quantiles) {
            const q = quantSnapshot.quantiles;
            if (q.p5) areas.push({ label: 'P05', price: q.p5.price, type: 'support' });
            if (q.p25) areas.push({ label: 'P25', price: q.p25.price, type: 'support' });
            if (q.p75) areas.push({ label: 'P75', price: q.p75.price, type: 'resistance' });
            if (q.p95) areas.push({ label: 'P95', price: q.p95.price, type: 'resistance' });
        }
        if (confluenceZones && Array.isArray(confluenceZones)) {
            confluenceZones.slice(0, 4).forEach((z: any) => {
                areas.push({
                    label: z.type === 'support' ? 'CONF SUP' : 'CONF RES',
                    price: z.price,
                    type: z.type === 'support' ? 'support' : 'resistance',
                });
            });
        }
        return areas.sort((a, b) => b.price - a.price);
    }, [quantSnapshot?.quantiles, confluenceZones]);

    const isLoading = !quantSnapshot;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* ── SIGNAL GRADE CARD ─────────────────────────── */}
            <div className="panel-section">
                <div className="p-head">
                    <span>SIGNAL GRADE</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{symbol}</span>
                </div>
                <div className="p-body">
                    {isLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
                            <div style={{ width: 18, height: 18, border: '2px solid var(--border-medium)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px' }}>AWAITING ENGINE...</span>
                            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '10px',
                                background: signal.bg, border: `2px solid ${signal.color}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '22px', fontWeight: 900, color: signal.color,
                            }}>
                                {signal.grade}
                            </div>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: signal.color, letterSpacing: '1px' }}>
                                    {signal.label}
                                </div>
                                {bias && (
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        EXP MOVE: <span style={{ color: signal.color }}>{bias.expectedMove >= 0 ? '+' : ''}{bias.expectedMove.toFixed(2)}%</span>
                                        &nbsp;|&nbsp; CONF: {bias.confidence.toFixed(0)}%
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── REGIME ────────────────────────────────────── */}
            {regime && (
                <div className="panel-section">
                    <div className="p-head">
                        <span>MARKET REGIME</span>
                        <span style={{ color: regime.color, fontSize: '10px', fontWeight: 700 }}>
                            {regime.icon} {regime.label}
                        </span>
                    </div>
                    <div className="p-body">
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div className="stat-card" style={{ flex: 1 }}>
                                <div className="stat-label">DRIFT (1D)</div>
                                <div className={`stat-value ${(quantSnapshot?.meta?.adjustedDrift ?? 0) > 0 ? 'pos' : 'neg'}`}>
                                    {(quantSnapshot?.meta?.adjustedDrift ?? 0) > 0 ? '+' : ''}{(quantSnapshot?.meta?.adjustedDrift ?? 0).toFixed(3)}%
                                </div>
                            </div>
                            <div className="stat-card" style={{ flex: 1 }}>
                                <div className="stat-label">VOLATILITY</div>
                                <div className="stat-value">{(quantSnapshot?.meta?.stepVolatility ?? 0).toFixed(3)}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── IMPORTANT PRICE AREAS ──────────────────────── */}
            <div className="panel-section">
                <div className="p-head">
                    <span>KEY PRICE AREAS</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{quantSnapshot?.meta?.horizon ?? 14}D HORIZON</span>
                </div>
                <div className="p-body">
                    {priceAreas.length === 0 ? (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                            Awaiting analysis data…
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {priceAreas.map((area, i) => {
                                const isAbove = lastPrice > 0 && area.price > lastPrice;
                                const dist = lastPrice > 0 ? ((area.price / lastPrice - 1) * 100) : 0;
                                return (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        background: 'var(--bg-raised)', padding: '4px 8px', borderRadius: '4px',
                                        borderLeft: `3px solid ${area.type === 'support' ? 'var(--positive)' : area.type === 'resistance' ? 'var(--negative)' : 'var(--text-muted)'}`,
                                    }}>
                                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, width: '64px' }}>{area.label}</span>
                                        <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>{formatPrice(area.price)}</span>
                                        <span style={{
                                            fontSize: '9px', fontFamily: 'JetBrains Mono, monospace',
                                            color: isAbove ? 'var(--positive)' : 'var(--negative)',
                                            width: '50px', textAlign: 'right',
                                        }}>
                                            {dist >= 0 ? '+' : ''}{dist.toFixed(1)}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── QUICK OPEN BUTTONS ────────────────────────── */}
            <div className="panel-section">
                <div className="p-body" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <QuickBtn label="◈ Macro Quant" event="TERMINUS_SHOW_QUANT" color="var(--accent)" />
                    <QuickBtn label="◈ Liquidation" event="TERMINUS_SHOW_LIQUIDATION" color="#ff3b5c" />
                    <QuickBtn label="◈ Options" event="TERMINUS_SHOW_OPTIONS" color="#ffeb3b" />
                </div>
            </div>
        </div>
    );
}

function QuickBtn({ label, event, color }: { label: string; event: string; color: string }) {
    return (
        <button
            onClick={() => window.dispatchEvent(new CustomEvent(event))}
            style={{
                flex: 1, padding: '8px 6px', fontSize: '9px', fontWeight: 700,
                letterSpacing: '0.5px', background: 'var(--bg-raised)',
                border: `1px solid ${color}22`, borderRadius: '6px',
                color, cursor: 'pointer', transition: 'all 0.15s',
                minWidth: '90px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${color}15`; e.currentTarget.style.borderColor = `${color}44`; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.borderColor = `${color}22`; }}
        >
            {label}
        </button>
    );
}
