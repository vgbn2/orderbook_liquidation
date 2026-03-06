import { useMemo, useEffect, useCallback } from 'react';
import { useMarketDataStore } from '../../../stores/marketDataStore';
import { useCandleStore } from '../../../stores/candleStore';
import { fmt, safe } from '../../../utils/safe';
import { PanelSkeleton } from '../../shared/PanelSkeleton';
import { computeDirectionalBias } from '../../../utils/quantUtils';
import { BellCurveChart } from './BellCurveChart';

// ── Main QuantPanel ──────────────────────────────────────────────────────────
export function QuantPanel() {
    // ── 1. ALL HOOKS UNCONDITIONALLY ──
    const quantSnapshot = useMarketDataStore((s) => s.quantSnapshot);
    const setQuantSnapshot = useMarketDataStore((s) => s.setQuantSnapshot);
    const lockedQuantSymbol = useMarketDataStore((s) => s.lockedQuantSymbol);
    const setLockedQuantSymbol = useMarketDataStore((s) => s.setLockedQuantSymbol);
    const currentSymbol = useCandleStore((s) => s.symbol);

    useEffect(() => {
        if (quantSnapshot && quantSnapshot.symbol !== currentSymbol) {
            setQuantSnapshot(null);
        }
    }, [currentSymbol, quantSnapshot?.symbol, setQuantSnapshot]);

    const toggleLock = useCallback(() => {
        if (lockedQuantSymbol) {
            setLockedQuantSymbol(null);
        } else {
            setLockedQuantSymbol(currentSymbol);
        }
    }, [lockedQuantSymbol, currentSymbol, setLockedQuantSymbol]);

    const isLocked = !!lockedQuantSymbol;

    const data = useMemo(() => {
        if (!quantSnapshot) return null;
        const meta = safe.obj(quantSnapshot.meta);
        const sigmaGrid = safe.arr(quantSnapshot.sigmaGrid);
        const quantiles = safe.obj(quantSnapshot.quantiles);
        const macroBreakdown = safe.arr(quantSnapshot.macroBreakdown);
        const bias = computeDirectionalBias(sigmaGrid);

        // Ensure we have minimal data to render
        if (sigmaGrid.length === 0 || Object.keys(quantiles).length === 0) return null;

        return { meta, sigmaGrid, quantiles, macroBreakdown, bias };
    }, [quantSnapshot]);

    // ── 2. EARLY RETURN AFTER HOOKS ──
    if (!quantSnapshot || !data) {
        return <PanelSkeleton label="MACRO QUANT ENGINE" />;
    }

    const { meta, sigmaGrid, quantiles, macroBreakdown, bias } = data;
    const isBull = bias?.direction === 'BULLISH';
    const biasColor = isBull ? 'var(--positive)' : 'var(--negative)';
    const arrowIcon = isBull ? '▲' : '▼';

    // ── 3. RENDER ──
    return (
        <>
            <div className="panel-section">
                <div className="p-head">
                    <span>MARKET REGIME</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isLocked && (
                            <span style={{
                                fontSize: '9px', color: 'var(--accent)', fontWeight: 700,
                                background: 'rgba(0,255,200,0.08)', padding: '2px 6px',
                                borderRadius: '3px', border: '1px solid rgba(0,255,200,0.15)',
                                letterSpacing: '0.5px'
                            }}>
                                🔒 {lockedQuantSymbol}
                            </span>
                        )}
                        <button
                            onClick={toggleLock}
                            className="lock-btn"
                            style={{
                                background: isLocked ? 'rgba(0,255,200,0.12)' : 'transparent',
                                border: `1px solid ${isLocked ? 'var(--accent)' : 'var(--border-medium)'}`,
                                borderRadius: '4px', color: isLocked ? 'var(--accent)' : 'var(--text-muted)',
                                cursor: 'pointer', padding: '2px 6px', fontSize: '10px', fontWeight: 700,
                            }}
                        >
                            {isLocked ? '🔓' : '🔒'}
                        </button>
                        <span style={{ color: 'var(--accent)' }}>VOLATILE</span>
                    </div>
                </div>
                <div className="p-body">
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div className="stat-card" style={{ flex: 1 }}>
                            <div className="stat-label">DRIFT (1D)</div>
                            <div className={`stat-value ${safe.num(meta.adjustedDrift) > 0 ? 'pos' : safe.num(meta.adjustedDrift) < 0 ? 'neg' : ''}`}>
                                {fmt.pct(safe.num(meta.adjustedDrift), '0.00%')}
                            </div>
                        </div>
                        <div className="stat-card" style={{ flex: 1 }}>
                            <div className="stat-label">VOLATILITY</div>
                            <div className="stat-value">{fmt.pct(safe.num(meta.stepVolatility), '0.00%')}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CORRELATIONS */}
            <div className="panel-section">
                <div className="p-head"><span>CORRELATIONS</span></div>
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
                            {macroBreakdown.map((m: any) => (
                                <tr key={m.ticker} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: '4px 8px', fontWeight: 'bold' }}>{m.ticker}</td>
                                    <td style={{ textAlign: 'right', padding: '4px 8px', color: safe.num(m.correlation) > 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                        {fmt.num(m.correlation, 2)}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '4px 8px', color: safe.num(m.zScore) > 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                        {fmt.num(m.zScore, 2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* QUANTILES */}
            <div className="panel-section">
                <div className="p-head"><span>QUANTILES ({safe.num(meta.horizon, 14)}D)</span></div>
                <div className="p-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {Object.entries(quantiles).map(([key, val]: [string, any]) => {
                            const label = key === 'p5' ? 'P05' : key === 'p25' ? 'P25' : key === 'p50' ? 'MED' : key === 'p75' ? 'P75' : 'P95';
                            return (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-raised)', padding: '4px 8px', borderRadius: '4px' }}>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>{label}</span>
                                    <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>{fmt.price(val.price)}</span>
                                    <span style={{ fontSize: '10px', color: safe.num(val.pctMove) >= 0 ? 'var(--positive)' : 'var(--negative)', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {fmt.pct(val.pctMove)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* SIGMA DISTRIBUTION */}
            <div className="panel-section">
                <div className="p-head">
                    <span>SIGMA DISTRIBUTION</span>
                    {bias && (
                        <span style={{ color: biasColor, fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>
                            {arrowIcon} {bias.strength}
                        </span>
                    )}
                </div>
                <div className="p-body" style={{ paddingBottom: '4px' }}>
                    <BellCurveChart sigmaGrid={sigmaGrid} />

                    {bias && (
                        <div style={{
                            marginTop: '8px', background: 'var(--bg-overlay)', borderRadius: '6px',
                            padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '10px',
                            borderLeft: `3px solid ${biasColor}`,
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '44px' }}>
                                <span style={{ fontSize: '22px', color: biasColor, lineHeight: 1 }}>{arrowIcon}</span>
                                <span style={{ fontSize: '9px', color: biasColor, fontWeight: 700, letterSpacing: '1px', marginTop: '2px' }}>
                                    {bias.direction}
                                </span>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    <span>NEXT DAY</span>
                                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: biasColor }}>
                                        {fmt.pct(bias.expectedMove)} EXP
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                                    <span style={{ width: '28px', fontSize: '9px', color: 'var(--positive)', textAlign: 'right' }}>{fmt.num(bias.bullPct, 0)}%</span>
                                    <div style={{ flex: 1, height: '5px', background: 'var(--bg-raised)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ width: `${bias.bullPct}%`, height: '100%', background: 'var(--positive)', borderRadius: '2px' }} />
                                    </div>
                                    <span style={{ width: '14px', fontSize: '9px', color: 'var(--text-muted)' }}>▲</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: '28px', fontSize: '9px', color: 'var(--negative)', textAlign: 'right' }}>{fmt.num(bias.bearPct, 0)}%</span>
                                    <div style={{ flex: 1, height: '5px', background: 'var(--bg-raised)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ width: `${bias.bearPct}%`, height: '100%', background: 'var(--negative)', borderRadius: '2px' }} />
                                    </div>
                                    <span style={{ width: '14px', fontSize: '9px', color: 'var(--text-muted)' }}>▼</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '8px' }}>
                        {sigmaGrid.map((row: any) => (
                            <div key={row.sigma} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '28px', fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                                    {safe.num(row.sigma) > 0 ? '+' : ''}{row.sigma}σ
                                </span>
                                <div style={{ flex: 1, height: '3px', background: 'var(--bg-overlay)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${Math.min(safe.num(row.probability), 100)}%`, height: '100%',
                                        background: safe.num(row.pctMove) >= 0 ? 'var(--positive)' : 'var(--negative)',
                                        opacity: 0.35, borderRadius: '2px',
                                    }} />
                                </div>
                                <span style={{ width: '56px', textAlign: 'right', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)' }}>
                                    {fmt.price(row.price)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
