import { useMarketDataStore } from '../../stores/marketDataStore';
import { PanelSection, Badge } from '../shared/UI.tsx';

const SIGNAL_ICONS: Record<string, string> = {
    OB_BID_WALL: '🟢',
    OB_ASK_WALL: '🔴',
    OPTIONS_MAX_PAIN: '💀',
    GEX_FLIP: '⚡',
    LIQ_LONG_CLUSTER: '🔻',
    LIQ_SHORT_CLUSTER: '🔺',
    VWAF_LONG_BIAS: '📈',
    VWAF_SHORT_BIAS: '📉',
};

const STRENGTH_TYPES: Record<string, any> = {
    high: 'hot',
    medium: 'live',
    low: 'pinned',
};

interface ConfluenceZoneData {
    price_low: number;
    price_high: number;
    center: number;
    score: number;
    strength: 'high' | 'medium' | 'low';
    reasons: { signal: string; detail?: string; contribution: number }[];
}

export function ConfluencePanel() {
    const zones = useMarketDataStore((s) => s.confluenceZones);

    if (!zones || zones.length === 0) {
        return (
            <PanelSection title="CONFLUENCE ZONES" isCollapsible defaultCollapsed={false}>
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-md)' }}>
                    AWAITING ZONES...
                </div>
            </PanelSection>
        );
    }

    return (
        <PanelSection
            title="CONFLUENCE ZONES"
            isCollapsible
            defaultCollapsed={false}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Badge type="live" label={`${zones.length} ZONES`} />
                    <span className="terminus-label" style={{ color: 'var(--color-accent)' }}>CLUSTERED DATA</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {zones.map((zone: ConfluenceZoneData, i: number) => (
                        <div key={i} style={{
                            background: 'var(--color-bg-raised)',
                            padding: 'var(--space-2)',
                            borderRadius: 'var(--radius-sm)',
                            borderLeft: `3px solid var(--color-${STRENGTH_TYPES[zone.strength] === 'hot' ? 'negative' : STRENGTH_TYPES[zone.strength] === 'live' ? 'positive' : 'border-medium'})`
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                                <span className="terminus-value" style={{ fontSize: 'var(--text-md)' }}>
                                    ${zone.center.toLocaleString()}
                                </span>
                                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{zone.score.toFixed(0)} PTS</span>
                                    <Badge type={STRENGTH_TYPES[zone.strength]} label={zone.strength.toUpperCase()} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                                {zone.reasons.map((r, j) => (
                                    <span key={j} style={{
                                        fontSize: '9px',
                                        color: 'var(--text-primary)',
                                        background: 'var(--color-bg-overlay)',
                                        padding: '2px 6px',
                                        borderRadius: '2px',
                                        fontFamily: 'var(--font-mono)'
                                    }} title={r.detail || r.signal}>
                                        {SIGNAL_ICONS[r.signal] || '●'} {r.signal.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </PanelSection>
    );
}
