import { useRef, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { showToast } from './Toast';

interface SettingsPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    anchorEl: HTMLElement | null;
}

export function SettingsPopover({ isOpen, onClose, anchorEl }: SettingsPopoverProps) {
    const popoverRef = useRef<HTMLDivElement>(null);
    const {
        tradingConfirmations, setTradingConfirmations,
        theme, setTheme,
        chartLayout, setChartLayout
    } = useSettingsStore();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node) &&
                anchorEl &&
                !anchorEl.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, anchorEl]);

    if (!isOpen || !anchorEl) return null;

    const rect = anchorEl.getBoundingClientRect();

    return (
        <div
            ref={popoverRef}
            style={{
                position: 'fixed',
                top: rect.bottom + 8,
                left: Math.max(10, rect.right - 280), // Align right edge if possible
                width: 280,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--r-md)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                zIndex: 9999,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 16
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'bold', color: 'var(--text-primary)' }}>Preferences</span>
                <button
                    onClick={onClose}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                    ✕
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Trading Confirmations</span>
                    <button
                        className={`toggle ${tradingConfirmations ? 'active' : ''}`}
                        onClick={() => {
                            setTradingConfirmations(!tradingConfirmations);
                            showToast(`Trading confirmations ${!tradingConfirmations ? 'enabled' : 'disabled'}`, 'info');
                        }}
                    >
                        {tradingConfirmations ? 'ON' : 'OFF'}
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Theme</span>
                    <select
                        className="inp inp-select"
                        style={{ width: 100, height: 28, fontSize: 'var(--text-xs)' }}
                        value={theme}
                        onChange={(e) => {
                            setTheme(e.target.value as any);
                            showToast(`Theme changed to ${e.target.value}`, 'info');
                        }}
                    >
                        <option value="Dark">Dark (Default)</option>
                        <option value="Light">Light</option>
                    </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Chart Layout</span>
                    <select
                        className="inp inp-select"
                        style={{ width: 100, height: 28, fontSize: 'var(--text-xs)' }}
                        value={chartLayout}
                        onChange={(e) => {
                            setChartLayout(e.target.value as any);
                            showToast(`Chart layout changed to ${e.target.value}`, 'info');
                        }}
                    >
                        <option value="Advanced">Advanced</option>
                        <option value="Simple">Simple</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
