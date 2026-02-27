import { useMarketStore } from '../stores/marketStore';

const SEVERITY_ICONS: Record<string, string> = {
    info: 'ℹ️',
    warn: '⚠️',
    critical: '🚨',
};

export function AlertsPanel() {
    const { alerts, clearAlerts } = useMarketStore();

    return (
        <div className="panel alerts-panel">
            <div className="panel-header">
                <span className="panel-title">SYSTEM ALERTS</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {alerts.length > 0 && (
                        <button className="clear-btn" onClick={clearAlerts}>CLEAR</button>
                    )}
                    <span className="panel-badge">{alerts.length} NEW</span>
                </div>
            </div>

            <div className="alerts-container">
                {alerts.length === 0 ? (
                    <div className="no-alerts">
                        <p>Market is stable. All systems normal.</p>
                    </div>
                ) : (
                    alerts.map((alert) => (
                        <div
                            key={alert.id}
                            className={`alert-item alert-${alert.severity}`}
                        >
                            <div className="alert-header">
                                <span className="alert-icon">{SEVERITY_ICONS[alert.severity]}</span>
                                <span className="alert-type">{alert.type}</span>
                                <span className="alert-time">
                                    {new Date(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                            </div>
                            <div className="alert-message">{alert.message}</div>
                            {alert.price && (
                                <div className="alert-price">Price level: {alert.price.toLocaleString()}</div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
