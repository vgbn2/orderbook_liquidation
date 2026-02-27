import { useState, useEffect } from 'react';

export type ToastType = 'info' | 'success' | 'warn' | 'error';

interface ToastMessage {
    id: number;
    message: string;
    type: ToastType;
}

// Global emitter for simple integration
export const showToast = (message: string, type: ToastType = 'info') => {
    const event = new CustomEvent('terminus_toast', { detail: { message, type } });
    window.dispatchEvent(event);
};

export function ToastContainer() {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    useEffect(() => {
        const handleToast = (e: any) => {
            const { message, type } = e.detail;
            const id = Date.now();
            setToasts(prev => [...prev, { id, message, type }]);

            // Auto-remove after 3 seconds
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 3000);
        };

        window.addEventListener('terminus_toast', handleToast);
        return () => window.removeEventListener('terminus_toast', handleToast);
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            zIndex: 10000,
            pointerEvents: 'none'
        }}>
            {toasts.map(toast => {
                const colors = {
                    info: 'var(--accent)',
                    success: 'var(--positive)',
                    warn: 'var(--warning)',
                    error: 'var(--negative)'
                };
                const color = colors[toast.type];

                return (
                    <div
                        key={toast.id}
                        style={{
                            background: 'var(--bg-surface)',
                            border: `1px solid ${color}`,
                            borderLeft: `3px solid ${color}`,
                            padding: '12px 16px',
                            minWidth: 240,
                            borderRadius: 'var(--r-md)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            pointerEvents: 'auto',
                            animation: 'slide-in-right 0.2s ease-out'
                        }}
                    >
                        <span style={{ color, fontSize: 16 }}>
                            {toast.type === 'info' ? 'ℹ' :
                                toast.type === 'success' ? '✓' :
                                    toast.type === 'warn' ? '⚠' : '✕'}
                        </span>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'var(--font)' }}>
                            {toast.message}
                        </span>
                    </div>
                );
            })}
            <style>{`
                @keyframes slide-in-right {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
