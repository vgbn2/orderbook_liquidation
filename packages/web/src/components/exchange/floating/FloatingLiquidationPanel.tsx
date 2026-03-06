import { useState } from 'react';
import { ErrorBoundary } from '../../shared/ErrorBoundary.tsx';
import { LiquidationPanel } from '../panels/LiquidationPanel.tsx';
import { ConfluencePanel } from '../panels/ConfluencePanel.tsx';
import { FloatingPanelWrapper } from '../../shared/FloatingPanelWrapper.tsx';

interface Props { onClose: () => void; }

export function FloatingLiquidationPanel({ onClose }: Props) {
    const [tab, setTab] = useState<'liquidation' | 'confluence'>('liquidation');

    const headerTabs = (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-medium)', background: 'var(--bg-surface)' }}>
            {(['liquidation', 'confluence'] as const).map((t: any) => (
                <div key={t} onClick={() => setTab(t)} style={{
                    flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: '10px',
                    fontWeight: tab === t ? 700 : 500, letterSpacing: '0.3px', cursor: 'pointer',
                    color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                }}>
                    {t === 'liquidation' ? 'LIQ CLUSTERS' : 'CONFLUENCE ZONES'}
                </div>
            ))}
        </div>
    );

    return (
        <FloatingPanelWrapper
            title="◈ LIQUIDATION · CONFLUENCE"
            titleColor="#ff3b5c"
            initialPosition={{ x: Math.max(60, window.innerWidth / 2 - 280), y: 100 }}
            defaultHeight={480}
            collapsedRight={260}
            onClose={onClose}
            headerExtra={headerTabs}
        >
            <ErrorBoundary name={tab === 'liquidation' ? 'LiquidationPanel' : 'ConfluencePanel'}>
                {tab === 'liquidation' ? <LiquidationPanel /> : <ConfluencePanel />}
            </ErrorBoundary>
        </FloatingPanelWrapper>
    );
}
