import { useMemo, useRef, useEffect, useCallback } from 'react';
import { useMarketDataStore } from '../../stores/marketDataStore';
import { useCandleStore } from '../../stores/candleStore';
import { fmt, safe } from '../../utils/safe';
import { PanelSkeleton } from '../shared/PanelSkeleton';

// ── Gaussian bell curve helper ──────────────────────────────────────────────
function gaussian(x: number, mean: number, std: number): number {
    return Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
}

// ── Next-day directional bias from sigma skew ───────────────────────────────
function computeDirectionalBias(sigmaGrid: any[]) {
    const sg = safe.arr(sigmaGrid);
    if (sg.length === 0) return null;

    const totalProb = sg.reduce((s, r) => s + safe.num(r.probability), 0) || 1;
    const expectedMove = sg.reduce((s, r) => s + (safe.num(r.pctMove) * safe.num(r.probability)) / totalProb, 0);
    const bullWeight = sg.filter(r => safe.num(r.pctMove) >= 0).reduce((s, r) => s + safe.num(r.probability), 0);
    const bearWeight = sg.filter(r => safe.num(r.pctMove) < 0).reduce((s, r) => s + safe.num(r.probability), 0);
    const total = bullWeight + bearWeight || 1;
    const bullPct = (bullWeight / total) * 100;
    const bearPct = (bearWeight / total) * 100;
    const direction = expectedMove >= 0 ? 'BULLISH' : 'BEARISH';
    const confidence = Math.abs(bullPct - bearPct);
    const strength = confidence > 20 ? 'STRONG' : confidence > 8 ? 'MODERATE' : 'WEAK';

    return { direction, expectedMove, bullPct, bearPct, confidence, strength };
}

// ── Bell Curve Canvas ───────────────────────────────────────────────────────
function BellCurveChart({ sigmaGrid }: { sigmaGrid: any[] }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const sg = safe.arr(sigmaGrid);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || sg.length < 2) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);

        const sigmas = sg.map(r => safe.num(r.sigma));
        const minS = Math.min(...sigmas);
        const maxS = Math.max(...sigmas);
        const range = maxS - minS || 1;

        const totalProb = sg.reduce((s, r) => s + safe.num(r.probability), 0) || 1;
        const meanSigma = sg.reduce((s, r) => s + safe.num(r.sigma) * safe.num(r.probability), 0) / totalProb;
        const stdSigma = Math.sqrt(
            sg.reduce((s, r) => s + safe.num(r.probability) * Math.pow(safe.num(r.sigma) - meanSigma, 2), 0) / totalProb
        ) || 1;

        const pad = { l: 4, r: 4, t: 8, b: 14 };
        const cw = W - pad.l - pad.r;
        const ch = H - pad.t - pad.b;
        const toX = (s: number) => pad.l + ((s - minS) / range) * cw;
        const toY = (v: number) => pad.t + (1 - v) * ch;

        const steps = 150;
        const pts: [number, number][] = [];
        let maxV = 0;
        for (let i = 0; i <= steps; i++) {
            const s = minS + (i / steps) * range;
            const v = gaussian(s, meanSigma, stdSigma);
            if (v > maxV) maxV = v;
            pts.push([s, v]);
        }

        const drawSide = (filterFn: (s: number) => boolean, r: string, g: string, b: string) => {
            const filtered = pts.filter(([s]) => filterFn(s));
            if (filtered.length < 2) return;
            const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
            grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0.04)`);
            ctx.beginPath();
            ctx.moveTo(toX(filtered[0][0]), toY(0));
            filtered.forEach(([s, v]) => ctx.lineTo(toX(s), toY(v / maxV)));
            ctx.lineTo(toX(filtered[filtered.length - 1][0]), toY(0));
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.beginPath();
            filtered.forEach(([s, v], i) => {
                const x = toX(s); const y = toY(v / maxV);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        };

        drawSide(s => s <= 0, '255', '45', '78');
        drawSide(s => s >= 0, '0', '232', '122');

        // Zero line
        ctx.beginPath();
        ctx.moveTo(toX(0), pad.t);
        ctx.lineTo(toX(0), pad.t + ch);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Peak marker
        ctx.beginPath();
        ctx.moveTo(toX(meanSigma), pad.t + 2);
        ctx.lineTo(toX(meanSigma), pad.t + ch);
        ctx.strokeStyle = 'rgba(255,235,59,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Labels
        ctx.font = '8px JetBrains Mono, monospace';
        ctx.fillStyle = 'rgba(100,100,130,0.85)';
        ctx.textAlign = 'center';

        sg.forEach((row: any) => {
            const x = toX(safe.num(row.sigma));
            ctx.fillText(fmt.price(row.price), x, H - 2);
            ctx.beginPath();
            ctx.moveTo(x, pad.t + ch);
            ctx.lineTo(x, pad.t + ch + 3);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.stroke();
        });

    }, [sg]);

    if (sg.length < 2) return <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 10 }}>Insufficient distribution data</div>;
    return <canvas ref={canvasRef} style={{ width: '100%', height: '110px', display: 'block' }} />;
}

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
