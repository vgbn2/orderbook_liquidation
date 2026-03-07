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

// ── Helpers ──────────────────────────────────────────────────

const geoRiskColor = (riskScore: number): string => {
    if (riskScore > 7) return 'var(--negative)';
    if (riskScore > 4) return '#f59e0b';
    if (riskScore > 2) return 'var(--positive-muted)';
    return 'var(--positive)';
};

const formatDate = (dateStr: string): string => {
    try {
        const d = new Date(dateStr.replace(/(\d{4})(\d{2})(\d{2})T.*/, '$1-$2-$3'));
        const diffH = (Date.now() - d.getTime()) / 3600000;
        if (diffH < 1) return `${Math.floor(diffH * 60)}m ago`;
        if (diffH < 24) return `${Math.floor(diffH)}h ago`;
        return `${Math.floor(diffH / 24)}d ago`;
    } catch {
        return dateStr.slice(0, 8);
    }
};

// ── Components ────────────────────────────────────────────────

const SectionLoader: React.FC<{ label: string }> = ({ label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 0' }}>
        <style>{`.pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 1.5s ease-in-out infinite; } @keyframes pulse { 0%,100% { opacity: 0.3 } 50% { opacity: 1 } }`}</style>
        <div className="pulse-dot" />
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{label}</span>
    </div>
);

const DataAgeTag: React.FC<{ updatedAt: number | null }> = ({ updatedAt }) => {
    if (updatedAt === null) {
        return <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>LOADING...</span>;
    }
    const ageMinutes = (Date.now() - updatedAt) / 60000;
    const label = ageMinutes < 2 ? 'LIVE'
        : ageMinutes < 60 ? `${Math.floor(ageMinutes)}m ago`
            : `${Math.floor(ageMinutes / 60)}h ago`;
    const color = ageMinutes < 30 ? 'var(--positive)' : 'var(--text-muted)';
    return <span style={{ color, fontSize: '9px', letterSpacing: '0.5px' }}>{label}</span>;
};

const GeopoliticalEventCard: React.FC<{ event: any }> = ({ event }) => {
    const themeColor: Record<string, string> = {
        CONFLICT: 'var(--negative)',
        NUCLEAR: 'var(--negative)',
        SANCTIONS: '#f59e0b',
        ELECTION: 'var(--accent)',
        TERRORISM: 'var(--negative)',
        COUP: 'var(--negative)',
        MILITARY: '#f59e0b',
        PROTEST: 'var(--accent)',
        GEOPOLITICAL: 'var(--text-muted)'
    };
    const color = themeColor[event.riskTheme] || 'var(--text-muted)';

    return (
        <a href={event.url} target="_blank" rel="noopener noreferrer" style={{
            textDecoration: 'none', display: 'block', padding: '10px 12px', borderRadius: '6px',
            background: 'var(--bg-deep)', border: `1px solid var(--border-low)`, marginBottom: '8px', transition: 'border-color 0.15s'
        }} onMouseEnter={(e) => e.currentTarget.style.borderColor = color} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-low)'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ padding: '1px 6px', borderRadius: '3px', fontSize: '8px', fontWeight: 700, background: `${color}22`, color: color, flexShrink: 0 }}>
                    {event.riskTheme}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {event.source} · {formatDate(event.date)}
                </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-primary)', marginTop: '6px', lineHeight: 1.4 }}>
                {event.title.length > 100 ? event.title.substring(0, 100) + '...' : event.title}
            </div>
        </a>
    );
};

// ── Main Page ────────────────────────────────────────────────

export const IntelligencePage: React.FC = () => {
    const intel = useMarketDataStore(s => s.intelligenceSnapshot);

    const hasData = intel !== null;
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
                        SIGNAL INTELLIGENCE ENGINE · PHASE 10
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>OVERALL BIAS</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: hasData ? currentBias.color : 'var(--text-muted)' }}>
                            {hasData ? currentBias.label : 'AWAITING DATA'}
                        </div>
                    </div>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '12px',
                        background: 'var(--bg-surface)',
                        border: `2px solid ${hasData ? currentBias.color : 'var(--border-medium)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        fontWeight: 900,
                        color: hasData ? currentBias.color : 'var(--text-muted)',
                        boxShadow: hasData ? `0 0 20px ${currentBias.color}22` : 'none'
                    }}>
                        {hasData ? score.toFixed(1) : '--'}
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>

                {/* Global Surprise Meter */}
                <div style={{ gridColumn: 'span 12', background: 'var(--bg-surface)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-medium)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <SectionHeader title="AGGREGATE MACRO SURPRISE" subtitle="Weighted deviation from consensus across global indicators" />
                        <DataAgeTag updatedAt={intel?.dataAge?.macroUpdatedAt ?? null} />
                    </div>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-medium)', paddingBottom: '8px' }}>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', letterSpacing: '1px' }}>GEOPOLITICAL RISK</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>AI-driven GDELT analysis</div>
                            </div>
                            <DataAgeTag updatedAt={intel?.dataAge?.geoUpdatedAt ?? null} />
                        </div>

                        {intel === null || intel?.dataAge?.geoUpdatedAt == null ? (
                            <SectionLoader label="Fetching geopolitical data..." />
                        ) : (
                            <div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div style={{ fontSize: '40px', fontWeight: 800, lineHeight: 1, color: geoRiskColor(intel.geopolitics.riskScore), flexShrink: 0 }}>
                                        {intel.geopolitics.riskScore.toFixed(1)}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '8px' }}>
                                            {intel.geopolitics.summary}
                                        </div>
                                        {intel.geopolitics.hotZones && intel.geopolitics.hotZones.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {intel.geopolitics.hotZones.map((zone: string) => (
                                                    <span key={zone} style={{ padding: '2px 8px', background: 'var(--bg-deep)', border: '1px solid var(--border-medium)', borderRadius: '4px', fontSize: '9px' }}>
                                                        {zone}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {intel.geopolitics.events && intel.geopolitics.events.length > 0 ? (
                                    <div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.5px' }}>RECENT EVENTS</div>
                                        {intel.geopolitics.events.slice(0, 5).map((event: any, i: number) => (
                                            <GeopoliticalEventCard key={i} event={event} />
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '8px 0' }}>
                                        No significant geopolitical events in GDELT feed.
                                    </div>
                                )}
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
