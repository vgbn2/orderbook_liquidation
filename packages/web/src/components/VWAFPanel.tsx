import { useMarketStore } from '../stores/marketStore';
import { PanelSection, StatCard, Badge } from './UI';

const SENTIMENT_LABELS: Record<string, { label: string, type: any }> = {
    extremely_long: { label: 'EXTREMELY BULLISH', type: 'hot' },
    long_heavy: { label: 'LONG HEAVY', type: 'live' },
    neutral: { label: 'NEUTRAL', type: 'pinned' },
    short_heavy: { label: 'SHORT HEAVY', type: 'beta' },
    extremely_short: { label: 'EXTREMELY BEARISH', type: 'new' }, // Using available badge types meaningfully
};

function formatRate(r: number): string {
    return (r * 100).toFixed(4) + '%';
}

function formatUSD(v: number): string {
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
    return '$' + v.toLocaleString();
}

export function VWAFPanel() {
    const vwaf = useMarketStore((s) => s.vwaf);

    if (!vwaf) {
        return (
            <PanelSection title="VWAF · FUNDING" isCollapsible defaultCollapsed={false}>
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-md)' }}>
                    AWAITING FUNDING DATA...
                </div>
            </PanelSection>
        );
    }

    const sentiment = SENTIMENT_LABELS[vwaf.sentiment] || { label: vwaf.sentiment.toUpperCase(), type: 'pinned' };

    return (
        <PanelSection
            title="VWAF · FUNDING"
            isCollapsible
            defaultCollapsed={false}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Sentiment Badge */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Badge type={sentiment.type} label={sentiment.label} />
                </div>

                {/* Main Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                    <StatCard
                        label="VWAF (8H)"
                        value={formatRate(vwaf.vwaf)}
                        valueColor={vwaf.vwaf >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}
                    />
                    <StatCard
                        label="ANNUALIZED"
                        value={`${(vwaf.vwaf_annualized * 100).toFixed(1)}%`}
                        valueColor={vwaf.vwaf_annualized >= 0 ? 'var(--color-positive)' : 'var(--color-negative)'}
                    />
                    <StatCard
                        label="TOTAL OI"
                        value={formatUSD(vwaf.total_oi_usd)}
                    />
                    <StatCard
                        label="DIVERGENCE"
                        value={formatRate(vwaf.divergence)}
                        valueColor="var(--color-warning)"
                    />
                </div>

                {/* Exchange Breakdown */}
                <div>
                    <span className="terminus-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>EXCHANGE WEIGHTS</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        {vwaf.by_exchange.map((ex: any) => (
                            <div key={ex.exchange} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', background: 'var(--color-bg-raised)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
                                <span className="terminus-label" style={{ width: '40px', fontSize: '10px' }}>{ex.exchange.substring(0, 3).toUpperCase()}</span>
                                <div style={{ flex: 1, height: '4px', background: 'var(--color-bg-overlay)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            width: `${(ex.weight * 100).toFixed(0)}%`,
                                            height: '100%',
                                            background: ex.rate >= 0 ? 'var(--color-positive)' : 'var(--color-negative)',
                                            opacity: 0.6
                                        }}
                                    />
                                </div>
                                <span style={{ width: '60px', textAlign: 'right', fontSize: '10px', color: ex.rate >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                                    {formatRate(ex.rate)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </PanelSection>
    );
}
