import { useMemo } from 'react';
import { useMarketDataStore } from '../../../stores/marketDataStore';
import { useCandleStore } from '../../../stores/candleStore';
import { fmt, safe } from '../../../utils/safe';
import { PanelSkeleton } from '../../shared/PanelSkeleton';

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

export function TerminalSummaryPanel() {
    // ── 1. ALL HOOKS UNCONDITIONALLY ──
    const quantSnapshot = useMarketDataStore((s: any) => s.quantSnapshot);
    const options = useMarketDataStore((s: any) => s.options);
    const confluenceZones = useMarketDataStore((s: any) => s.confluenceZones);
    const lastPrice = useMarketDataStore((s: any) => s.lastPrice);
    const symbol = useCandleStore((s: any) => s.symbol);

    const computed = useMemo(() => {
        // Compute bias from sigma grid
        const sigmaGrid = safe.arr(quantSnapshot?.sigmaGrid);
        let bias = null;
        if (sigmaGrid.length > 0) {
            const totalProb = sigmaGrid.reduce((s, r) => s + safe.num(r.probability), 0) || 1;
            const expectedMove = sigmaGrid.reduce((s, r) => s + (safe.num(r.pctMove) * safe.num(r.probability)) / totalProb, 0);
            const bullWeight = sigmaGrid.filter((r: any) => safe.num(r.pctMove) >= 0).reduce((s, r) => s + safe.num(r.probability), 0);
            const bearWeight = sigmaGrid.filter((r: any) => safe.num(r.pctMove) < 0).reduce((s, r) => s + safe.num(r.probability), 0);
            const total = bullWeight + bearWeight || 1;
            const bullPct = (bullWeight / total) * 100;
            const bearPct = (bearWeight / total) * 100;
            const direction = expectedMove >= 0 ? 'BULLISH' : 'BEARISH';
            const confidence = Math.abs(bullPct - bearPct);
            bias = { direction, expectedMove, bullPct, bearPct, confidence };
        }

        const meta = safe.obj(quantSnapshot?.meta);
        const regime = meta.adjustedDrift != null
            ? classifyRegime(safe.num(meta.adjustedDrift), safe.num(meta.stepVolatility))
            : null;

        // Simple liq ratio proxy
        const liqRatio = 1.0; // TODO: derive from liquidationEngine once wired

        // Options bias
        const totalGex = safe.num(options?.total_gex, NaN);
        const optionsBias = !isNaN(totalGex) ? (totalGex > 0 ? 'CALL' : 'PUT') : null;

        const signal = computeSignalGrade(bias, liqRatio, optionsBias);

        // Important price areas from quantiles + confluence
        const quantiles = safe.obj(quantSnapshot?.quantiles);
        const zones = safe.arr(confluenceZones);
        const areas: { label: string; price: number; type: 'support' | 'resistance' | 'neutral' }[] = [];

        if (quantiles.p5) areas.push({ label: 'P05', price: safe.num(quantiles.p5.price), type: 'support' });
        if (quantiles.p25) areas.push({ label: 'P25', price: safe.num(quantiles.p25.price), type: 'support' });
        if (quantiles.p75) areas.push({ label: 'P75', price: safe.num(quantiles.p75.price), type: 'resistance' });
        if (quantiles.p95) areas.push({ label: 'P95', price: safe.num(quantiles.p95.price), type: 'resistance' });

        zones.slice(0, 4).forEach((z: any) => {
            areas.push({
                label: z.type === 'support' ? 'CONF SUP' : 'CONF RES',
                price: safe.num(z.price),
                type: z.type === 'support' ? 'support' : 'resistance',
            });
        });

        const sortedAreas = areas.sort((a, b) => b.price - a.price);

        return { signal, bias, regime, priceAreas: sortedAreas, horizon: safe.num(meta.horizon, 14) };
    }, [quantSnapshot, options, confluenceZones]);

    // ── 2. EARLY RETURN AFTER HOOKS ──
    if (!quantSnapshot) {
        return <PanelSkeleton label="TERMINAL SUMMARY" />;
    }

    const { signal, bias, regime, priceAreas, horizon } = computed;

    // ── 3. RENDER ──
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* ── SIGNAL GRADE CARD ─────────────────────────── */}
            <div className="panel-section">
                <div className="p-head">
                    <span>SIGNAL GRADE</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{symbol}</span>
                </div>
                <div className="p-body">
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
                                    EXP MOVE: <span style={{ color: signal.color }}>{fmt.pct(bias.expectedMove)}</span>
                                    &nbsp;|&nbsp; CONF: {fmt.num(bias.confidence, 0)}%
                                </div>
                            )}
                        </div>
                    </div>
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
                                <div className={`stat-value ${safe.num(quantSnapshot?.meta?.adjustedDrift) > 0 ? 'pos' : 'neg'}`}>
                                    {fmt.pct(safe.num(quantSnapshot?.meta?.adjustedDrift), '0.00%')}
                                </div>
                            </div>
                            <div className="stat-card" style={{ flex: 1 }}>
                                <div className="stat-label">VOLATILITY</div>
                                <div className="stat-value">{fmt.pct(safe.num(quantSnapshot?.meta?.stepVolatility), '0.00%')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── IMPORTANT PRICE AREAS ──────────────────────── */}
            <div className="panel-section">
                <div className="p-head">
                    <span>KEY PRICE AREAS</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{horizon}D HORIZON</span>
                </div>
                <div className="p-body">
                    {priceAreas.length === 0 ? (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                            Awaiting analysis data…
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {priceAreas.map((area, i) => {
                                const dist = lastPrice > 0 ? ((area.price / lastPrice - 1) * 100) : 0;
                                const isAbove = dist > 0;
                                return (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        background: 'var(--bg-raised)', padding: '4px 8px', borderRadius: '4px',
                                        borderLeft: `3px solid ${area.type === 'support' ? 'var(--positive)' : area.type === 'resistance' ? 'var(--negative)' : 'var(--text-muted)'}`,
                                    }}>
                                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, width: '64px' }}>{area.label}</span>
                                        <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>{fmt.price(area.price)}</span>
                                        <span style={{
                                            fontSize: '9px', fontFamily: 'JetBrains Mono, monospace',
                                            color: isAbove ? 'var(--positive)' : 'var(--negative)',
                                            width: '50px', textAlign: 'right',
                                        }}>
                                            {fmt.pct(dist)}
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
