import { useMarketDataStore, LiqEvent } from '../../stores/marketDataStore';
import { PanelSection, StatCard, Badge } from '../shared/UI';

// ── helpers ─────────────────────────────────────────────────────────────────

const fmtMoney = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
};

const timeAgo = (ts: number) => {
    const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
};

/**
 * Interpolate through a heat gradient based on intensity 0..1
 * cold → deep red → orange → bright yellow
 */
function heatColor(intensity: number): string {
    const stops = [
        { t: 0.0, r: 30, g: 30, b: 60, a: 0.4 },
        { t: 0.4, r: 180, g: 30, b: 30, a: 0.7 },
        { t: 0.7, r: 255, g: 80, b: 0, a: 0.85 },
        { t: 1.0, r: 255, g: 240, b: 30, a: 1.0 },
    ];
    const clamped = Math.max(0, Math.min(1, intensity));
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
        if (clamped >= stops[i].t && clamped <= stops[i + 1].t) {
            lo = stops[i]; hi = stops[i + 1]; break;
        }
    }
    const t = (clamped - lo.t) / (hi.t - lo.t || 1);
    const r = Math.round(lo.r + (hi.r - lo.r) * t);
    const g = Math.round(lo.g + (hi.g - lo.g) * t);
    const b = Math.round(lo.b + (hi.b - lo.b) * t);
    const a = (lo.a + (hi.a - lo.a) * t).toFixed(2);
    return `rgba(${r},${g},${b},${a})`;
}

// ── WhaleFeed sub-component ─────────────────────────────────────────────────

function WhaleFeed() {
    const significantLiqs = useMarketDataStore((s) => s.significantLiquidations);
    const WHALE_THRESHOLD = 500_000;

    if (!significantLiqs || significantLiqs.length === 0) {
        return (
            <div style={{ padding: '8px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '10px' }}>
                AWAITING SIGNIFICANT EVENTS...
            </div>
        );
    }

    return (
        <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {significantLiqs.slice(0, 20).map((event: LiqEvent, i: number) => {
                const isWhale = event.size >= WHALE_THRESHOLD;
                const isLong = event.side === 'long';
                const color = isLong ? 'var(--color-negative)' : 'var(--color-positive)';
                const icon = isLong ? '▼' : '▲';

                return (
                    <div
                        key={`${event.timestamp}-${i}`}
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent('TERMINUS_HIGHLIGHT_PRICE', { detail: { price: event.price } }));
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 6px',
                            fontSize: '10px',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer',
                            borderLeft: `2px solid ${color}`,
                            background: isWhale ? 'rgba(255,235,59,0.06)' : 'transparent',
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = isWhale ? 'rgba(255,235,59,0.06)' : 'transparent'; }}
                    >
                        <span style={{ color, fontWeight: 700, width: '50px' }}>
                            {icon} {event.side.toUpperCase()}
                        </span>
                        <span style={{ color: 'var(--color-text-primary)', flex: 1 }}>
                            ${event.price.toLocaleString()}
                        </span>
                        <span style={{ color, fontWeight: 600 }}>
                            {fmtMoney(event.size)}
                        </span>
                        {isWhale && <span style={{ fontSize: '11px' }}>⚡</span>}
                        <span style={{ color: 'var(--color-text-muted)', width: '48px', textAlign: 'right', fontSize: '9px' }}>
                            {timeAgo(event.timestamp)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ── Main LiquidationPanel ───────────────────────────────────────────────────

export function LiquidationPanel() {
    const liqData = useMarketDataStore((s) => s.liquidations);

    if (!liqData) {
        return (
            <PanelSection title="LIQUIDATION HQ" isCollapsible defaultCollapsed={false}>
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-md)' }}>
                    AWAITING LIQUIDATIONS...
                </div>
            </PanelSection>
        );
    }

    const { heatmap, total_usd, event_count } = liqData;

    // ── Sentiment Gauge (Long vs Short) ─────────────────────────────────────
    const longLiqTotal = heatmap.reduce((s: number, b: any) => s + (b.long_liq_usd ?? b.total * 0.5), 0);
    const shortLiqTotal = heatmap.reduce((s: number, b: any) => s + (b.short_liq_usd ?? b.total * 0.5), 0);
    const sentimentTotal = longLiqTotal + shortLiqTotal || 1;
    const longPct = (longLiqTotal / sentimentTotal) * 100;
    const shortPct = (shortLiqTotal / sentimentTotal) * 100;
    const sentimentLabel = longPct > 70 ? 'LONG FLUSH' : shortPct > 70 ? 'SHORT SQUEEZE' : 'BALANCED';
    const sentimentColor = longPct > 70 ? 'var(--color-negative)' : shortPct > 70 ? 'var(--color-positive)' : 'var(--color-text-muted)';

    // ── Heatmap with Heat Gradient + Top 3 Labels ───────────────────────────
    const maxTotal = Math.max(...heatmap.map((b: { total: number }) => b.total), 1);
    const sortedByTotal = [...heatmap].sort((a: any, b: any) => b.total - a.total);
    const top3Prices = new Set(sortedByTotal.slice(0, 3).map((b: any) => b.price));

    const minPrice = heatmap.length > 0 ? heatmap[0].price : 0;
    const maxPrice = heatmap.length > 0 ? heatmap[heatmap.length - 1].price : 0;

    return (
        <PanelSection title="LIQUIDATION HQ" isCollapsible defaultCollapsed={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

                {/* ── Header ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Badge type="live" label={`${event_count} EVENTS`} />
                    <span className="terminus-label" style={{ color: 'var(--color-negative)' }}>HOT FLOW</span>
                </div>

                <StatCard
                    label="ESTIMATED TOTAL LIQ"
                    value={fmtMoney(total_usd)}
                    valueColor="var(--color-negative)"
                />

                {/* ── Sentiment Gauge ── */}
                <div>
                    <span className="terminus-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>SENTIMENT</span>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'var(--color-bg-overlay)', padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: '50px' }}>
                            <span style={{ fontSize: '8px', color: 'var(--color-negative)', fontWeight: 700 }}>LONGS</span>
                            <span style={{ fontSize: '10px', color: 'var(--color-negative)', fontFamily: 'var(--font-mono)' }}>{fmtMoney(longLiqTotal)}</span>
                        </div>
                        <div style={{ flex: 1, height: '8px', background: 'var(--color-bg-raised)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${longPct}%`, height: '100%', background: 'var(--color-negative)', transition: 'width 0.3s ease' }} />
                            <div style={{ width: `${shortPct}%`, height: '100%', background: 'var(--color-positive)', transition: 'width 0.3s ease' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '50px' }}>
                            <span style={{ fontSize: '8px', color: 'var(--color-positive)', fontWeight: 700 }}>SHORTS</span>
                            <span style={{ fontSize: '10px', color: 'var(--color-positive)', fontFamily: 'var(--font-mono)' }}>{fmtMoney(shortLiqTotal)}</span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '9px', fontWeight: 700, color: sentimentColor, letterSpacing: '1px' }}>
                        {sentimentLabel} · {longPct.toFixed(0)}% / {shortPct.toFixed(0)}%
                    </div>
                </div>

                {/* ── Heatmap bars with Heat Gradient ── */}
                <div>
                    <span className="terminus-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>INTENSITY MAP</span>
                    <div style={{ height: '54px', display: 'flex', alignItems: 'flex-end', gap: '1px', background: 'var(--color-bg-overlay)', padding: '2px', borderRadius: 'var(--radius-sm)', position: 'relative' }}>
                        {heatmap.map((bucket: { price: number; total: number }) => {
                            const intensity = bucket.total / maxTotal;
                            const isTop3 = top3Prices.has(bucket.price);
                            return (
                                <div
                                    key={bucket.price}
                                    style={{
                                        flex: 1,
                                        height: `${Math.max(4, intensity * 50)}px`,
                                        background: heatColor(intensity),
                                        borderRadius: '1px',
                                        position: 'relative',
                                    }}
                                    title={`$${bucket.price.toLocaleString()}: ${fmtMoney(bucket.total)}`}
                                >
                                    {isTop3 && intensity > 0.3 && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '-18px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            fontSize: '7px',
                                            color: '#fff',
                                            fontFamily: 'var(--font-mono)',
                                            whiteSpace: 'nowrap',
                                            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                                            fontWeight: 700,
                                        }}>
                                            {fmtMoney(bucket.total)}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)', fontSize: '9px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        <span>${(minPrice / 1000).toFixed(1)}K</span>
                        <span>CLUSTER RANGE</span>
                        <span>${(maxPrice / 1000).toFixed(1)}K</span>
                    </div>
                </div>

                {/* ── Whale Feed ── */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                        <span className="terminus-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            WHALE FEED <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-positive)', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
                        </span>
                        <span style={{ fontSize: '8px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>&gt; $10K</span>
                    </div>
                    <div style={{ background: 'var(--color-bg-overlay)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                        <WhaleFeed />
                    </div>
                </div>
            </div>
        </PanelSection>
    );
}
