import { useMarketStore } from '../stores/marketStore';
import { PanelSection, StatCard, Badge } from './UI';

export function LiquidationPanel() {
    const liqData = useMarketStore((s) => s.liquidations);

    if (!liqData) {
        return (
            <PanelSection title="LIQUIDATION CLUSTERS" isCollapsible defaultCollapsed={false}>
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-md)' }}>
                    AWAITING LIQUIDATIONS...
                </div>
            </PanelSection>
        );
    }

    const { heatmap, total_usd, event_count } = liqData;

    const maxTotal = Math.max(...heatmap.map((b: { total: number }) => b.total), 1);
    const fmtMoney = (v: number) => {
        if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
        if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
        if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
        return `$${v.toFixed(0)}`;
    };

    const minPrice = heatmap.length > 0 ? heatmap[0].price : 0;
    const maxPrice = heatmap.length > 0 ? heatmap[heatmap.length - 1].price : 0;

    return (
        <PanelSection
            title="LIQUIDATION CLUSTERS"
            isCollapsible
            defaultCollapsed={false}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Badge type="live" label={`${event_count} EVENTS`} />
                    <span className="terminus-label" style={{ color: 'var(--color-negative)' }}>HOT FLOW</span>
                </div>

                <StatCard
                    label="ESTIMATED TOTAL LIQ"
                    value={fmtMoney(total_usd)}
                    valueColor="var(--color-negative)"
                />

                {/* Heatmap bars */}
                <div>
                    <span className="terminus-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>INTENSITY MAP</span>
                    <div style={{ height: '40px', display: 'flex', alignItems: 'flex-end', gap: '1px', background: 'var(--color-bg-overlay)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
                        {heatmap.map((bucket: { price: number; total: number }) => {
                            const intensity = bucket.total / maxTotal;
                            return (
                                <div
                                    key={bucket.price}
                                    style={{
                                        flex: 1,
                                        height: `${Math.max(4, intensity * 36)}px`,
                                        background: intensity > 0.8 ? 'var(--color-negative)' : intensity > 0.4 ? 'var(--color-warning)' : 'var(--color-accent)',
                                        opacity: 0.8,
                                        borderRadius: '1px'
                                    }}
                                    title={`$${bucket.price.toLocaleString()}: ${fmtMoney(bucket.total)}`}
                                />
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)', fontSize: '9px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        <span>${(minPrice / 1000).toFixed(1)}K</span>
                        <span>CLUSTER RANGE</span>
                        <span>${(maxPrice / 1000).toFixed(1)}K</span>
                    </div>
                </div>
            </div>
        </PanelSection>
    );
}
