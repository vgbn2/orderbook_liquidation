import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export type ToastType = 'info' | 'success' | 'warn' | 'error';
export type ToastTier = 'system' | 'alert';

interface ToastMessage {
    id: string;          // string for dedup key
    message: string;
    type: ToastType;
    tier: ToastTier;
    count: number;
    expiresAt: number;
}


const MAX_TOASTS = 4;
const DURATIONS: Record<ToastTier, number> = {
    system: 3000,
    alert: 6000,
};

// Global emitter for simple integration
export const showToast = (
    message: string,
    type: ToastType = 'info',
    tier: ToastTier = 'system',
    bypassGate = false
) => {
    const event = new CustomEvent('terminus_toast', { detail: { message, type, tier, bypassGate } });
    window.dispatchEvent(event);
};

export const showAlert = (message: string, type: ToastType = 'warn') => showToast(message, type, 'alert');

export function ToastContainer() {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const notificationLevel = useSettingsStore(s => s.notificationLevel);

    useEffect(() => {
        const handleToast = (e: any) => {
            const { message, type, tier = 'system', bypassGate } = e.detail;

            if (notificationLevel === 'off' && !bypassGate) return;
            if (notificationLevel === 'critical_only' && type !== 'error' && !bypassGate) return;

            const now = Date.now();
            const dedupKey = message.slice(0, 60);

            setToasts(prev => {
                const existing = prev.find(t => t.id === dedupKey && t.expiresAt > now);

                if (existing) {
                    return prev.map(t =>
                        t.id === dedupKey
                            ? { ...t, count: t.count + 1, expiresAt: now + DURATIONS[tier as ToastTier] }
                            : t
                    );
                }

                const capped = prev.length >= MAX_TOASTS ? prev.slice(-(MAX_TOASTS - 1)) : prev;

                return [
                    ...capped,
                    {
                        id: dedupKey,
                        message,
                        type,
                        tier,
                        count: 1,
                        expiresAt: now + DURATIONS[tier as ToastTier],
                    }
                ];
            });

            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== dedupKey));
            }, DURATIONS[tier as ToastTier]);
        };

        window.addEventListener('terminus_toast', handleToast);
        return () => window.removeEventListener('terminus_toast', handleToast);
    }, [notificationLevel]);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 32,
            right: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            zIndex: 10000,
            pointerEvents: 'none',
            maxWidth: 320,
        }}>
            {toasts.map(toast =>
                toast.tier === 'alert'
                    ? <AlertToast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
                    : <SystemToast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
            )}
            <style>{`
                @keyframes toast-in {
                    from { transform: translateX(110%); opacity: 0; }
                    to   { transform: translateX(0);    opacity: 1; }
                }
                @keyframes toast-out {
                    from { opacity: 1; transform: translateX(0); }
                    to   { opacity: 0; transform: translateX(110%); }
                }
            `}</style>
        </div>
    );
}

const ACCENT: Record<ToastType, string> = {
    info: 'var(--accent)',
    success: 'var(--positive)',
    warn: 'var(--warning)',
    error: 'var(--negative)',
};

function AlertToast({ toast, onDismiss }: { toast: ToastMessage, onDismiss: () => void }) {
    const color = ACCENT[toast.type];
    const now = Date.now();
    const remaining = Math.max(0, toast.expiresAt - now);
    const pct = (remaining / 6000) * 100;

    return (
        <div style={{
            background: 'rgba(12, 12, 20, 0.92)',
            border: `1px solid ${color}44`,
            borderLeft: `2px solid ${color}`,
            borderRadius: 3,
            padding: '5px 8px 5px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'auto',
            animation: 'toast-in 0.15s ease-out',
            backdropFilter: 'blur(8px)',
            position: 'relative',
            overflow: 'hidden',
            maxWidth: 300,
        }}>
            <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: color, flexShrink: 0,
                boxShadow: `0 0 6px ${color}`,
            }} />
            <span style={{
                fontSize: 10,
                fontFamily: 'var(--font)',
                color: 'var(--text-secondary)',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '0.02em',
            }}>
                {toast.message}
            </span>
            {toast.count > 1 && (
                <span style={{
                    fontSize: 9,
                    padding: '1px 5px',
                    borderRadius: 10,
                    background: `${color}22`,
                    color: color,
                    fontFamily: 'var(--font)',
                    fontWeight: 'bold',
                    flexShrink: 0,
                }}>
                    ×{toast.count}
                </span>
            )}
            <button
                onClick={onDismiss}
                style={{
                    background: 'transparent', border: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    fontSize: 10, padding: '0 2px', lineHeight: 1,
                    flexShrink: 0, opacity: 0.6,
                }}
            >
                ✕
            </button>
            <div style={{
                position: 'absolute', bottom: 0, left: 0,
                height: 1,
                width: `${pct}%`,
                background: color,
                opacity: 0.5,
                transition: 'width 0.1s linear',
            }} />
        </div>
    );
}

const ICONS: Record<ToastType, string> = {
    info: 'ℹ', success: '✓', warn: '⚠', error: '✕'
};

function SystemToast({ toast, onDismiss }: { toast: ToastMessage, onDismiss: () => void }) {
    const color = ACCENT[toast.type];

    return (
        <div style={{
            background: 'rgba(16, 16, 26, 0.95)',
            border: `1px solid ${color}55`,
            borderLeft: `3px solid ${color}`,
            borderRadius: 4,
            padding: '8px 10px',
            minWidth: 180,
            maxWidth: 280,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'auto',
            animation: 'toast-in 0.2s ease-out',
            backdropFilter: 'blur(8px)',
        }}>
            <span style={{ color, fontSize: 12, flexShrink: 0 }}>
                {ICONS[toast.type]}
            </span>
            <span style={{
                fontSize: 11,
                fontFamily: 'var(--font)',
                color: 'var(--text-primary)',
                flex: 1,
            }}>
                {toast.message}
            </span>
            <button
                onClick={onDismiss}
                style={{
                    background: 'transparent', border: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    fontSize: 11, padding: '0 2px',
                }}
            >
                ✕
            </button>
        </div>
    );
}

export function NotifMutedBadge() {
    const level = useSettingsStore(s => s.notificationLevel);
    const setLevel = useSettingsStore(s => s.setNotificationLevel);

    if (level === 'all') return null;

    return (
        <div
            onClick={() => setLevel('all')}
            title="Notifications muted — click to re-enable"
            style={{
                position: 'fixed',
                bottom: 8,
                right: 8,
                padding: '3px 8px',
                background: 'rgba(12,12,20,0.9)',
                border: '1px solid var(--border-medium)',
                borderRadius: 3,
                fontSize: 9,
                fontFamily: 'var(--font)',
                color: level === 'off' ? 'var(--text-muted)' : 'var(--warning)',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
            }}
        >
            <span>{level === 'off' ? '🔇' : '🔕'}</span>
            <span>{level === 'off' ? 'ALERTS MUTED' : 'CRITICAL ONLY'}</span>
        </div>
    );
}
