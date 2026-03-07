import { useState } from 'react';
import { useMarketDataStore } from '../../../stores/marketDataStore';
import { useCandleStore } from '../../../stores/candleStore';
import { fmt, safe } from '../../../utils/safe';

// ─── SUB-COMPONENTS ───────────────────────────────────────────

/**
 * ScoreBar — A center-anchored progress bar for -10 to +10 scores.
 */
function ScoreBar({ score }: { score: number }) {
    const magnitude = Math.abs(score);
    const capped = Math.min(magnitude, 10);
    const width = (capped / 10) * 50; // Max 50% from center
    const isPos = score > 0;
    const color = isPos ? 'var(--positive)' : 'var(--negative)';

    return (
        <div style={{
            width: '100%', height: 4, background: 'rgba(255,255,255,0.03)',
            borderRadius: 2, position: 'relative', overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.05)'
        }}>
            {/* Scale markers */}
            <div style={{ position: 'absolute', left: '25%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.02)' }} />
            <div style={{ position: 'absolute', left: '75%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.02)' }} />

            {/* Center line */}
            <div style={{
                position: 'absolute', left: '50%', top: 0, bottom: 0,
                width: 1, background: 'rgba(255,255,255,0.2)', zIndex: 1
            }} />

            {/* Value bar */}
            <div style={{
                position: 'absolute',
                left: isPos ? '50%' : `${50 - width}%`,
                width: `${width}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${color}aa, ${color})`,
                boxShadow: `0 0 10px ${isPos ? 'rgba(0,200,122,0.3)' : 'rgba(255,59,92,0.3)'}`,
                transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                borderRadius: 1
            }} />
        </div>
    );
}

function SubHeader({ label }: { label: string }) {
    return (
        <div style={{
            fontSize: 8, color: 'var(--text-muted)', fontWeight: 700,
            letterSpacing: '1.2px', borderTop: '1px solid rgba(255,255,255,0.05)',
            padding: '5px 0 2px', marginTop: 6, textTransform: 'uppercase'
        }}>
            {label}
        </div>
    );
}

function DetailRow({ label, value, color, date }: { label: string, value: string, color?: string, date?: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }} title={date ? `Last Print: ${date}` : undefined}>
            <div className="label" style={{ fontSize: 10, opacity: 0.8 }}>{label}</div>
            <div style={{ fontSize: 11, fontWeight: 'bold', color: color || 'var(--text-primary)' }}>{value}</div>
        </div>
    );
}

/**
 * CategoryDetails — Detailed Breakdown for each intelligence category.
 */
function CategoryDetails({ name, details }: { name: string, details: any }) {
    const d = safe.obj(details);

    if (name === 'Sentiment') {
        return (
            <div style={{ padding: '4px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <div className="label">Fear & Greed</div>
                        <div style={{ fontSize: 13, fontWeight: 'bold' }}>
                            {safe.num(d.fearGreedValue)} (
                            <span className={d.fearGreedHeading?.includes('Greed') ? 'pos' : 'neg'}>
                                {safe.str(d.fearGreedHeading)}
                            </span>)
                        </div>
                    </div>
                    <div>
                        <div className="label">Altcoin Season</div>
                        <div style={{ fontSize: 13, fontWeight: 'bold' }}>
                            {safe.num(d.altcoinSeasonIndex)} (
                            <span className={safe.num(d.altcoinSeasonIndex) > 50 ? 'pos' : 'neg'}>
                                {safe.num(d.altcoinSeasonIndex) > 75 ? 'Alt Season' : safe.num(d.altcoinSeasonIndex) < 25 ? 'BTC Season' : 'Neutral'}
                            </span>)
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (name === 'Macro') {
        const indicators = safe.arr(d.indicators);
        const labor = indicators.filter(i => i.category === 'jobs');
        const inflation = indicators.filter(i => i.category === 'inflation');
        const growth = indicators.filter(i => i.category === 'growth');
        const yields = indicators.filter(i => i.category === 'yields');
        const credit = indicators.filter(i => i.category === 'credit');

        const biasColor = (b: string) => b === 'bullish' ? 'var(--positive)' : b === 'bearish' ? 'var(--negative)' : 'var(--text-muted)';

        return (
            <div style={{ padding: '4px 0' }}>
                {/* Growth Section */}
                <SubHeader label="Growth & Activity" />
                {growth.map(i => {
                    let val = i.label.includes('PMI')
                        ? `${i.value.toFixed(1)} (${i.value > 50 ? 'EXPANN' : 'CONTR'})`
                        : i.label.includes('GDP') || i.label.includes('Retail') ? fmt.pct(i.change) : i.value.toFixed(1);
                    return <DetailRow key={i.seriesId} label={i.label} value={val} color={biasColor(i.bias)} date={i.date} />;
                })}

                {/* Inflation Section */}
                <SubHeader label="Inflation & TIPS" />
                {inflation.map(i => (
                    <DetailRow key={i.seriesId} label={i.label} value={fmt.pct(i.change)} color={biasColor(i.bias)} date={i.date} />
                ))}
                <DetailRow label="Real Yield (10Y TIPS)" value={`${safe.num(d.realYield).toFixed(2)}%`} color={safe.num(d.realYield) > 1.5 ? 'var(--negative)' : 'var(--positive)'} />

                {/* Labor Section */}
                <SubHeader label="Labor Market" />
                {labor.map(i => (
                    <DetailRow
                        key={i.seriesId}
                        label={i.label + (i.seriesId === 'ICSA' ? ' (Wkl)' : '')}
                        value={i.label.includes('Rate') ? `${i.value.toFixed(1)}%` : fmt.num(i.value)}
                        color={biasColor(i.bias)}
                        date={i.date}
                    />
                ))}

                {/* Monetary Section */}
                <SubHeader label="Fixed Income & Credit" />
                <DetailRow
                    label="10Y-2Y Spread"
                    value={`${safe.num(d.yieldSpread).toFixed(2)}% ${safe.num(d.yieldSpread) < 0 ? '⚠ INV' : ''}`}
                    color={safe.num(d.yieldSpread) < 0 ? 'var(--negative)' : 'var(--text-primary)'}
                />
                <DetailRow
                    label="IG Credit Spread"
                    value={`${safe.num(d.creditSpread).toFixed(0)} bps`}
                    color={safe.num(d.creditSpread) > 120 ? 'var(--negative)' : 'var(--positive)'}
                />
                {credit.filter(c => c.seriesId !== 'BAMLC0A0CM').map(i => (
                    <DetailRow key={i.seriesId} label={i.label} value={`${i.value.toFixed(2)}`} color={biasColor(i.bias)} date={i.date} />
                ))}
                {yields.filter(y => y.seriesId !== 'DFII10').map(i => (
                    <DetailRow key={i.seriesId} label={i.label} value={`${i.value.toFixed(2)}%`} color={biasColor(i.bias)} date={i.date} />
                ))}
            </div>
        );
    }

    if (name === 'Market Structure') {
        return (
            <div style={{ padding: '8px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <div className="label">BTC Dominance</div>
                        <div style={{ fontSize: 13, fontWeight: 'bold' }}>{fmt.pct(d.btcDominance)}</div>
                    </div>
                    <div>
                        <div className="label">Stablecoin Div</div>
                        <div style={{ fontSize: 13, fontWeight: 'bold' }} className={safe.num(d.stablecoinDivergence) > 0 ? 'pos' : 'neg'}>
                            {safe.num(d.stablecoinDivergence).toFixed(2)}x
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (name === 'Technical') {
        return (
            <div style={{ padding: '8px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <div className="label">RSI (14) / HTF</div>
                        <div style={{ fontSize: 13, fontWeight: 'bold' }}>
                            {safe.num(d.rsi).toFixed(1)} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>/</span> {safe.num(d.htfRsi).toFixed(1)}
                        </div>
                    </div>
                    <div>
                        <div className="label">Trend Alignment</div>
                        <div style={{ fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }} className={d.smaAlignment === 'bullish' ? 'pos' : 'neg'}>
                            {safe.str(d.smaAlignment, 'Neutral')}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────

export function IntelligencePanel() {
    const symbol = useCandleStore(s => s.symbol);
    const intel = useMarketDataStore(s => s.intelligenceSnapshot);
    const [expanded, setExpanded] = useState<string | null>(null);

    // Initial loading or error state
    if (!intel) {
        return (
            <div className="panel" style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ animation: 'pulse 1.5s infinite', color: 'var(--accent)', fontWeight: 'bold', letterSpacing: 2 }}>
                    COMPUTING EDGE SCORE...
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
                    COLLECTING MACO/SENTIMENT/TECH SIGNALS
                </div>
            </div>
        );
    }

    const { overallScore, overallBias, categories } = intel;
    const ageMins = Math.floor((Date.now() - intel.timestamp) / 60000);

    return (
        <div className="panel intelligence-panel" style={{ borderTop: '1px solid var(--border-medium)', padding: 12 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="panel-title" style={{ color: 'var(--accent)', fontSize: 12 }}>EDGE FINDER</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {symbol} · {ageMins < 1 ? 'LIVE' : `${ageMins}m Ago`}
                </div>
            </div>

            {/* Overall Score Card */}
            <div style={{
                background: 'var(--bg-raised)', border: '1px solid var(--border-medium)',
                borderRadius: 'var(--r-md)', padding: 12, marginBottom: 16,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    {/* Circle Score */}
                    <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        border: '2px solid',
                        borderColor: overallScore >= 2 ? 'var(--positive)' : overallScore <= -2 ? 'var(--negative)' : 'var(--border-strong)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column',
                        background: overallScore >= 2 ? 'var(--pos-dim)' : overallScore <= -2 ? 'var(--neg-dim)' : 'transparent'
                    }}>
                        <div style={{ fontSize: 16, fontWeight: 'bold' }}>{(overallScore > 0 ? '+' : '')}{overallScore.toFixed(1)}</div>
                        <div style={{ fontSize: 8, opacity: 0.6 }}>/ 10</div>
                    </div>

                    {/* Bias & Label */}
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 }}
                            className={overallScore >= 2 ? 'pos' : overallScore <= -2 ? 'neg' : ''}>
                            {overallBias.replace('_', ' ')}
                        </div>
                        <ScoreBar score={overallScore} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            {categories.map((c: any) => (
                                <div key={c.name} className="badge" style={{ fontSize: 8, opacity: 0.8, background: 'var(--bg-overlay)' }}>
                                    {c.name.charAt(0)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {categories.map((cat: any) => {
                    const isExpanded = expanded === cat.name;
                    return (
                        <div key={cat.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <button
                                onClick={() => setExpanded(isExpanded ? null : cat.name)}
                                style={{
                                    width: '100%', padding: '10px 4px', background: 'transparent',
                                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12
                                }}
                            >
                                <div style={{ width: 80, textAlign: 'left' }}>
                                    <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-primary)' }}>{cat.name}</div>
                                    <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>WT: {cat.weight}%</div>
                                </div>

                                <div style={{ flex: 1 }}>
                                    <ScoreBar score={cat.score} />
                                </div>

                                <div style={{ width: 40, textAlign: 'right', fontSize: 11, fontWeight: 'bold' }} className={cat.score > 0 ? 'pos' : cat.score < 0 ? 'neg' : ''}>
                                    {(cat.score > 0 ? '+' : '')}{cat.score.toFixed(1)}
                                </div>

                                <div className={`badge ${cat.bias === 'bullish' || cat.bias === 'strong_bullish' ? 'badge-live' : cat.bias === 'bearish' || cat.bias === 'strong_bearish' ? 'badge-hot' : 'badge-pin'}`}
                                    style={{ width: 60, fontSize: 8 }}>
                                    {cat.bias.replace('_', ' ')}
                                </div>

                                <div style={{ fontSize: 10, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(0)' : 'rotate(-90deg)' }}>
                                    ▼
                                </div>
                            </button>

                            {isExpanded && (
                                <div style={{ padding: '0 8px 12px 8px', background: 'var(--bg-overlay)', borderRadius: 'var(--r-sm)', marginBottom: 8 }}>
                                    <CategoryDetails name={cat.name} details={cat.details} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)' }}>
                <div>◈ WEIGHTED AGGREGATE MODEL v2.4</div>
                <div>REFRESH: 60S</div>
            </div>
        </div>
    );
}
