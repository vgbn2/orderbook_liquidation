import { useMemo, useCallback } from 'react';
import { useMarketDataStore } from '../../stores/marketDataStore';

// ── Regime classifier ───────────────────────────────────────────────────────

interface RegimeInfo {
    icon: string;
    label: string;
    color: string;
}

function classifyRegime(drift: number, vol: number): RegimeInfo {
    const absDrift = Math.abs(drift);
    if (vol > 3.0 && absDrift > 1.0) return { icon: '🌪️', label: 'BREAKOUT', color: 'var(--color-warning)' };
    if (vol > 2.0 && absDrift < 0.3) return { icon: '⚡', label: 'CHOP', color: 'var(--color-text-muted)' };
    if (drift > 0.5 && vol < 2.0) return { icon: '🐂', label: 'BULL TREND', color: 'var(--color-positive)' };
    if (drift < -0.5 && vol < 2.0) return { icon: '🐻', label: 'BEAR TREND', color: 'var(--color-negative)' };
    return { icon: '📊', label: 'NEUTRAL', color: 'var(--color-text-muted)' };
}

// ── Directional bias computation ────────────────────────────────────────────

function computeBias(sigmaGrid: { sigma: number; probability: number; pctMove: number }[]) {
    if (!sigmaGrid?.length) return null;
    const totalProb = sigmaGrid.reduce((s, r) => s + r.probability, 0) || 1;
    const expectedMove = sigmaGrid.reduce((s, r) => s + (r.pctMove * r.probability) / totalProb, 0);
    const bullWeight = sigmaGrid.filter(r => r.pctMove >= 0).reduce((s, r) => s + r.probability, 0);
    const bearWeight = sigmaGrid.filter(r => r.pctMove < 0).reduce((s, r) => s + r.probability, 0);
    const total = bullWeight + bearWeight || 1;
    const bullPct = (bullWeight / total) * 100;
    const bearPct = (bearWeight / total) * 100;
    const direction = expectedMove >= 0 ? 'BULLISH' : 'BEARISH';
    const confidence = Math.abs(bullPct - bearPct);
    const strength = confidence > 20 ? 'HIGH' : confidence > 8 ? 'MED' : 'LOW';
    return { direction, expectedMove, bullPct, bearPct, confidence, strength };
}

// ── QuantSummary component ──────────────────────────────────────────────────

export function QuantSummary() {
    const quantSnapshot = useMarketDataStore((s) => s.quantSnapshot);

    const regime = useMemo(() => {
        if (!quantSnapshot?.meta) return null;
        return classifyRegime(quantSnapshot.meta.adjustedDrift, quantSnapshot.meta.stepVolatility);
    }, [quantSnapshot?.meta]);

    const bias = useMemo(() => {
        if (!quantSnapshot?.sigmaGrid) return null;
        return computeBias(quantSnapshot.sigmaGrid);
    }, [quantSnapshot?.sigmaGrid]);

    const openAnalytics = useCallback(() => {
        window.dispatchEvent(new CustomEvent('TERMINUS_OPEN_ANALYTICS'));
    }, []);

    // ── Loading state ───────────────────────────────────────────────────────
    if (!quantSnapshot || !regime || !bias) {
        return (
            <div style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-medium)',
                background: 'var(--bg-surface)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="loading-spinner" style={{
                        width: '14px', height: '14px',
                        border: '2px solid rgba(0,255,200,0.1)',
                        borderTop: '2px solid var(--accent)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                    }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '1.5px' }}>
                        INITIALIZING...
                    </span>
                </div>
            </div>
        );
    }

    const { meta } = quantSnapshot;
    const isBull = bias.direction === 'BULLISH';
    const biasColor = isBull ? 'var(--positive)' : 'var(--negative)';
    const arrowIcon = isBull ? '▲' : '▼';

    return (
        <div style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--border-medium)',
            background: 'var(--bg-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
        }}>
            {/* ── Top row: Regime + Bias pill ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px' }}>{regime.icon}</span>
                    <span style={{
                        fontSize: '11px', fontWeight: 700, color: regime.color,
                        letterSpacing: '0.5px',
                    }}>
                        {regime.label}
                    </span>
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '2px 8px', borderRadius: '10px',
                    background: isBull ? 'rgba(0,232,122,0.1)' : 'rgba(255,45,78,0.1)',
                    border: `1px solid ${biasColor}33`,
                }}>
                    <span style={{ fontSize: '10px', color: biasColor, fontWeight: 700 }}>
                        {arrowIcon} {bias.direction.slice(0, 4)}
                    </span>
                    <span style={{
                        fontSize: '9px', color: 'var(--text-muted)',
                        fontFamily: 'JetBrains Mono, monospace',
                    }}>
                        {bias.strength} · {bias.confidence.toFixed(0)}%
                    </span>
                </div>
            </div>

            {/* ── Stats row: Drift | Vol | Expected Move ── */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1px', background: 'var(--border-subtle)', borderRadius: '4px',
                overflow: 'hidden',
            }}>
                {[
                    { label: 'DRIFT 1D', value: `${meta.adjustedDrift > 0 ? '+' : ''}${meta.adjustedDrift?.toFixed(3)}%`, color: meta.adjustedDrift > 0 ? 'var(--positive)' : meta.adjustedDrift < 0 ? 'var(--negative)' : 'var(--text-primary)' },
                    { label: 'VOL σ', value: `${meta.stepVolatility?.toFixed(3)}%`, color: 'var(--text-primary)' },
                    { label: 'EXP MOVE', value: `${bias.expectedMove >= 0 ? '+' : ''}${bias.expectedMove.toFixed(2)}%`, color: biasColor },
                ].map((stat) => (
                    <div key={stat.label} style={{ background: 'var(--bg-raised)', padding: '6px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '2px' }}>
                            {stat.label}
                        </div>
                        <div style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: stat.color, fontWeight: 600 }}>
                            {stat.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Probability bar ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{
                    flex: 1, height: '6px', background: 'var(--bg-overlay)',
                    borderRadius: '3px', overflow: 'hidden', display: 'flex',
                }}>
                    <div style={{
                        width: `${bias.bullPct}%`, height: '100%',
                        background: 'var(--positive)', borderRadius: '3px 0 0 3px',
                        transition: 'width 0.4s ease',
                    }} />
                    <div style={{
                        width: `${bias.bearPct}%`, height: '100%',
                        background: 'var(--negative)', borderRadius: '0 3px 3px 0',
                        transition: 'width 0.4s ease',
                    }} />
                </div>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', minWidth: '70px', textAlign: 'right' }}>
                    {bias.bullPct.toFixed(0)}% ▲  {bias.bearPct.toFixed(0)}% ▼
                </span>
            </div>

            {/* ── Open Analytics button ── */}
            <button
                onClick={openAnalytics}
                style={{
                    width: '100%',
                    padding: '5px',
                    background: 'transparent',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '4px',
                    color: 'var(--text-muted)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '1.5px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.color = 'var(--accent)';
                    e.currentTarget.style.background = 'rgba(0,255,200,0.04)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-medium)';
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.background = 'transparent';
                }}
            >
                OPEN DETAILED ANALYTICS ↗
            </button>
        </div>
    );
}
