import { useMarketStore } from '../stores/marketStore';

export function LiquidationPanel() {
    const liqData = useMarketStore((s) => s.liquidations);

    if (!liqData) {
        return (
            <div className="panel">
                <div className="panel-header">
                    <span className="panel-title">LIQUIDATION CLUSTERS</span>
                    <span className="panel-badge">LIVE</span>
                </div>
                <p className="ob-waiting">Waiting for data...</p>
            </div>
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
        <div className="panel liq-panel">
            <div className="panel-header">
                <span className="panel-title">LIQUIDATION CLUSTERS</span>
                <span className="panel-badge">{event_count} events</span>
            </div>

            {/* Heatmap bars */}
            <div className="liq-bars">
                {heatmap.map((bucket: { price: number; long_liq_usd: number; short_liq_usd: number; total: number }) => {
                    const h = Math.max(3, (bucket.total / maxTotal) * 28);
                    const intensity = bucket.total / maxTotal;
                    // Color gradient: warm yellow → hot red
                    const r = Math.round(254 + (220 - 254) * intensity);
                    const g = Math.round(240 + (38 - 240) * intensity);
                    const b = Math.round(138 + (38 - 138) * intensity);
                    return (
                        <div
                            key={bucket.price}
                            className="liq-bar"
                            style={{
                                height: `${h}px`,
                                background: `rgb(${r},${g},${b})`,
                            }}
                            title={`${bucket.price.toLocaleString()}: Long ${fmtMoney(bucket.long_liq_usd)} | Short ${fmtMoney(bucket.short_liq_usd)}`}
                        />
                    );
                })}
            </div>

            {/* Labels */}
            <div className="liq-labels">
                <span>${minPrice.toLocaleString()}</span>
                <span className="liq-total">{fmtMoney(total_usd)} est. liq</span>
                <span>${maxPrice.toLocaleString()}</span>
            </div>
        </div>
    );
}
