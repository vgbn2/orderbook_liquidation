import { useState, useEffect, useMemo } from "react";
import { useMarketStore } from '../stores/marketStore';

export function AlertManager({ onClose }: { onClose: () => void }) {
    const storeAlerts = useMarketStore(s => s.activeAlerts);
    const [localAlerts, setLocalAlerts] = useState<any[]>([]);

    useEffect(() => {
        const handleAlert = (e: any) => {
            setLocalAlerts(prev => [e.detail, ...prev].slice(0, 50));
        };
        window.addEventListener('terminal_alert' as any, handleAlert);
        return () => window.removeEventListener('terminal_alert' as any, handleAlert);
    }, []);

    const alerts = useMemo(() => {
        const combined = [...storeAlerts, ...localAlerts];
        const seen = new Set<string>();
        return combined
            .filter(a => {
                const id = a.id || (a.time + a.type);
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            })
            .sort((a, b) => b.time - a.time)
            .slice(0, 50);
    }, [storeAlerts, localAlerts]);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.8)', padding: 40,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-surface)', width: 600, height: 500,
                border: '1px solid var(--border-medium)', borderRadius: 'var(--r-lg)',
                display: 'flex', flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>

                <div style={{ padding: 16, borderBottom: '1px solid var(--border-medium)', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--text-primary)' }}>Terminal Alerts</div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {alerts.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>No recent alerts</div>
                    ) : (
                        alerts.map((a, i) => (
                            <div key={i} style={{
                                padding: 12, border: '1px solid var(--border-medium)',
                                borderRadius: 'var(--r-md)', background: 'rgba(255,255,255,0.02)',
                                borderLeft: `3px solid ${a.severity === 'critical' ? 'var(--negative)' : a.severity === 'warn' ? 'var(--warning)' : 'var(--accent)'}`
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-primary)' }}>{a.type}</span>
                                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{new Date(a.time).toLocaleTimeString()}</span>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a.message}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
