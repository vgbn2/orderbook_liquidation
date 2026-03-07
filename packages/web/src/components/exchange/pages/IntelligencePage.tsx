import React from 'react';
import { useMarketDataStore } from '../../../stores/marketDataStore';

// ── Components ────────────────────────────────────────────────

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle }) => (
    <div style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-medium)', paddingBottom: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', letterSpacing: '1px' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>}
    </div>
);

interface StatCardProps {
    label: string;
    value: string | number;
    color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => (
    <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: '8px',
        padding: '16px',
        textAlign: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    }}>
        <div style={{ fontSize: '24px', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', marginTop: '4px', textTransform: 'uppercase' }}>{label}</div>
    </div>
);

interface SurpriseMeterBarProps {
    score: number | null;
    label?: string;
    large?: boolean;
}

const SurpriseMeterBar: React.FC<SurpriseMeterBarProps> = ({ score, label, large }) => {
    if (score === null || score === undefined) return (
        <div style={{ position: 'relative', height: large ? '12px' : '6px', background: 'var(--bg-deep)', borderRadius: '3px', opacity: 0.5 }}>
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '100%', fontSize: '8px', color: 'var(--text-muted)' }}>--</div>
        </div>
    );

    const isPos = score >= 0;
    const pct = Math.min(Math.abs(score) / 10 * 50, 50); // 0-50% range
    const color = isPos ? 'var(--positive)' : 'var(--negative)';

    return (
        <div style={{ marginBottom: label ? '12px' : '0' }}>
            <div style={{ position: 'relative', height: large ? '12px' : '6px', background: 'var(--bg-deep)', borderRadius: '3px' }}>
                <div style={{ position: 'absolute', left: '50%', width: '1px', height: '100%', background: 'var(--border-medium)', zIndex: 1 }} />
                <div style={{
                    position: 'absolute',
                    height: '100%',
                    width: `${pct}%`,
                    background: color,
                    borderRadius: '3px',
                    left: isPos ? '50%' : `${50 - pct}%`,
                    boxShadow: `0 0 10px ${color}44`,
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }} />
            </div>
            {label && <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>{label}</div>}
        </div>
    );
};

// ── Main Page ────────────────────────────────────────────────

export const IntelligencePage: React.FC = () => {
    const intel = useMarketDataStore(s => s.intelligenceSnapshot);

    const score = intel?.overallScore ?? 0;
    const bias = intel?.overallBias ?? 'neutral';

    const biasStyles: Record<string, { label: string, color: string }> = {
        strong_buy: { label: 'STRONG BUY', color: 'var(--positive)' },
        buy: { label: 'BUY', color: 'var(--positive-muted)' },
        neutral: { label: 'NEUTRAL', color: 'var(--text-muted)' },
        sell: { label: 'SELL', color: 'var(--negative-muted)' },
        strong_sell: { label: 'STRONG SELL', color: 'var(--negative)' },
    };

    const currentBias = biasStyles[bias] || biasStyles.neutral;

    return (
        <div style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            padding: '32px',
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            fontFamily: 'Inter, var(--font-sans)',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                    <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px', color: 'var(--accent-muted)' }}>◈</span>
                        EDGEFINDER
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '2px' }}>
                        SIGNAL INTELLIGENCE ENGINE · PHASE 6.5 & 6.6
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>OVERALL BIAS</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: currentBias.color }}>{currentBias.label}</div>
                    </div>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface)',
                        border: `2px solid ${currentBias.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        fontWeight: 900,
                        color: currentBias.color,
                        boxShadow: `0 0 20px ${currentBias.color}22`
                    }}>
                        {score.toFixed(1)}
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>

                {/* Global Surprise Meter */}
                <div style={{ gridColumn: 'span 12', background: 'var(--bg-surface)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-medium)' }}>
                    <SectionHeader title="AGGREGATE MACRO SURPRISE" subtitle="Weighted deviation from consensus across global indicators" />
                    <SurpriseMeterBar score={intel?.macroSurpriseScore ?? null} large label="Systemic deviation from market expectations" />
                </div>

                {/* Macro Details */}
                <div style={{ gridColumn: 'span 8', background: 'var(--bg-surface)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-medium)' }}>
                    <SectionHeader title="MACROECONOMIC REGIME" subtitle="Indicators vs Forecasts" />
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                            <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-medium)' }}>
                                <th style={{ padding: '8px 4px' }}>INDICATOR</th>
                                <th style={{ padding: '8px 4px' }}>ACTUAL</th>
                                <th style={{ padding: '8px 4px' }}>FORECAST</th>
                                <th style={{ padding: '8px 4px' }}>SURPRISE</th>
                                <th style={{ padding: '8px 4px', textAlign: 'right' }}>BIAS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {intel?.fred?.indicators?.map((ind: any) => (
                                <tr key={ind.seriesId} style={{ borderBottom: '1px solid var(--border-low)' }}>
                                    <td style={{ padding: '8px 4px', fontWeight: 600 }}>{ind.label}</td>
                                    <td style={{ padding: '8px 4px' }}>{ind.value}</td>
                                    <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>{ind.forecast ?? '--'}</td>
                                    <td style={{ padding: '8px 4px' }}>
                                        {ind.surpriseScore !== null ? (
                                            <span style={{ color: ind.surpriseScore > 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                                {ind.surpriseGrade}
                                            </span>
                                        ) : '--'}
                                    </td>
                                    <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                                        <span style={{
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '9px',
                                            fontWeight: 700,
                                            background: ind.bias === 'bullish' ? 'var(--bg-positive)' : ind.bias === 'bearish' ? 'var(--bg-negative)' : 'var(--bg-deep)',
                                            color: ind.bias === 'bullish' ? 'var(--positive)' : ind.bias === 'bearish' ? 'var(--negative)' : 'var(--text-muted)'
                                        }}>
                                            {ind.bias?.toUpperCase() || '--'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Sentiment & Geopolitical */}
                <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-medium)' }}>
                        <SectionHeader title="SENTIMENT & FLOWS" />
                        <div style={{ textAlign: 'center', padding: '10px 0' }}>
                            <div style={{ fontSize: '48px', fontWeight: 800, color: 'var(--accent)' }}>{intel?.fearGreed?.value ?? '--'}</div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{intel?.fearGreed?.classification || 'NEUTRAL'}</div>
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-surface)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-medium)', flex: 1 }}>
                        <SectionHeader title="GEOPOLITICAL RISK" subtitle="AI-driven GDELT analysis" />
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>RISK SCORE (0-10)</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ fontSize: '32px', fontWeight: 800, color: (intel?.geopolitics?.riskScore ?? 0) > 6 ? 'var(--negative)' : 'var(--positive)' }}>
                                    {intel?.geopolitics?.riskScore ?? '--'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                                    {intel?.geopolitics?.summary || 'No recent analysis available.'}
                                </div>
                            </div>
                        </div>
                        {intel?.geopolitics?.hotZones && (
                            <div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>HOT ZONES</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {intel.geopolitics.hotZones.map((zone: string) => (
                                        <span key={zone} style={{ padding: '2px 8px', background: 'var(--bg-deep)', border: '1px solid var(--border-medium)', borderRadius: '4px', fontSize: '9px' }}>
                                            {zone}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Technical Analysis */}
                <div style={{ gridColumn: 'span 12' }}>
                    <SectionHeader title="TECHNICAL INTELLIGENCE" />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px' }}>
                        <StatCard label="RSI (14)" value={intel?.ta?.rsi?.toFixed(1) ?? '--'} />
                        <StatCard label="Trend" value={intel?.ta?.smaAlignment?.trend || '--'} />
                        <StatCard label="AD Trend" value={intel?.ta?.adTrend || '--'} />
                        <StatCard label="Structure" value={intel?.ta?.marketStructure || '--'} />
                        <StatCard label="Divergence" value={intel?.ta?.divergence?.type || 'NONE'} />
                        <StatCard label="TA Score" value={intel?.categories?.find((c: any) => c.name === 'Technical')?.score !== undefined ? intel.categories.find((c: any) => c.name === 'Technical').score.toFixed(1) : '0.0'} />
                    </div>
                </div>

            </div>

            <div style={{ marginTop: '48px', textAlign: 'center', opacity: 0.5, fontSize: '10px', color: 'var(--text-muted)' }}>
                PREMIUM INTELLIGENCE · TERMINUS SIGNAL ENGINE v6.6 · {new Date().toLocaleDateString()}
            </div>
        </div>
    );
};
