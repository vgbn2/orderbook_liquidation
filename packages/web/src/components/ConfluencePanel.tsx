import { useMarketStore } from '../stores/marketStore';

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

const STRENGTH_COLORS: Record<string, string> = {
    high: '#00e87a',
    medium: '#ff8c1a',
    low: '#6b6b80',
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
    const zones = useMarketStore((s) => s.confluenceZones);

    if (!zones || zones.length === 0) {
        return (
            <div className="panel">
                <div className="panel-header">
                    <span className="panel-title">CONFLUENCE ZONES</span>
                    <span className="panel-badge">LOADING</span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    Waiting for data...
                </p>
            </div>
        );
    }

    return (
        <div className="panel confluence-panel">
            <div className="panel-header">
                <span className="panel-title">CONFLUENCE ZONES</span>
                <span className="panel-badge" style={{ color: '#00e87a' }}>
                    {zones.length} ZONES
                </span>
            </div>

            <div className="conf-zones">
                {zones.map((zone: ConfluenceZoneData, i: number) => {
                    const color = STRENGTH_COLORS[zone.strength] || '#6b6b80';
                    return (
                        <div key={i} className="conf-zone" style={{ borderLeftColor: color }}>
                            <div className="conf-zone-header">
                                <span className="conf-zone-price">
                                    ${zone.center.toLocaleString()}
                                </span>
                                <span className="conf-zone-score" style={{ color }}>
                                    {zone.score.toFixed(0)}pts
                                </span>
                                <span
                                    className="conf-zone-strength"
                                    style={{ background: color + '22', color, borderColor: color + '44' }}
                                >
                                    {zone.strength.toUpperCase()}
                                </span>
                            </div>
                            <div className="conf-zone-signals">
                                {zone.reasons.map((r, j) => (
                                    <span key={j} className="conf-signal" title={r.detail || r.signal}>
                                        {SIGNAL_ICONS[r.signal] || '●'}{' '}
                                        {r.signal.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
