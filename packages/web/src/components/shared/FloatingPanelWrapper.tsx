import React, { useState, useEffect } from 'react';
import { useDraggable } from '../../hooks/useDraggable';

export type PanelMode = 'DOCKED_BOTTOM' | 'FLOATING' | 'COLLAPSED';

interface Props {
    title: string;
    titleColor?: string;
    initialPosition: { x: number; y: number };
    defaultHeight?: number;
    collapsedRight?: number;
    collapsedBottom?: number;
    panelWidth?: number;
    onClose?: () => void;
    headerExtra?: React.ReactNode;
    children: React.ReactNode;
    defaultMode?: PanelMode;
}

export function FloatingPanelWrapper({
    title,
    titleColor = 'var(--accent)',
    initialPosition,
    defaultHeight = 480,
    collapsedRight = 20,
    collapsedBottom = 20,
    panelWidth = 560,
    onClose,
    headerExtra,
    children,
    defaultMode = 'FLOATING',
}: Props) {
    const [mode, setMode] = useState<PanelMode>(defaultMode);
    const [panelHeight, setPanelHeight] = useState(defaultHeight);
    const [isResizing, setIsResizing] = useState(false);

    const { elementRef, handleMouseDown, isDragging } = useDraggable({
        initialPosition
    });

    useEffect(() => {
        if (!isResizing) return;
        const move = (e: MouseEvent) => {
            const el = (elementRef as any).current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const next = e.clientY - rect.top;
            if (next > 200 && next < window.innerHeight - 80) setPanelHeight(next);
        };
        const up = () => setIsResizing(false);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    }, [isResizing]);

    const getStyles = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            position: 'fixed', zIndex: 9998,
            background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            color: 'var(--text-main)', fontFamily: "'JetBrains Mono', monospace",
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            borderRadius: '12px', userSelect: 'none',
        };
        if (mode === 'DOCKED_BOTTOM') return { ...base, bottom: 0, left: 0, width: '100vw', height: `${panelHeight}px`, borderRadius: '12px 12px 0 0', borderBottom: 'none', transform: 'none' };
        if (mode === 'COLLAPSED') return { ...base, bottom: collapsedBottom, right: collapsedRight, width: '220px', height: '40px', borderRadius: '8px', transform: 'none' };
        return { ...base, width: `${panelWidth}px`, height: `${panelHeight}px` };
    };

    return (
        <div ref={elementRef as any} style={getStyles()}>
            {/* Header */}
            <div
                onMouseDown={mode === 'FLOATING' ? handleMouseDown : undefined}
                style={{
                    padding: '8px 16px', background: 'rgba(0,0,0,0.25)',
                    borderBottom: '1px solid var(--border-medium)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: mode === 'FLOATING' ? (isDragging ? 'grabbing' : 'grab') : 'default',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: titleColor, letterSpacing: '1px' }}>{title}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <Btn active={mode === 'FLOATING'} onClick={() => setMode('FLOATING')}>◱</Btn>
                    <Btn active={mode === 'DOCKED_BOTTOM'} onClick={() => setMode('DOCKED_BOTTOM')}>↓</Btn>
                    <Btn active={mode === 'COLLAPSED'} onClick={() => setMode('COLLAPSED')}>—</Btn>
                    {onClose && <Btn onClick={onClose} style={{ color: 'var(--negative)', marginLeft: '4px' }}>×</Btn>}
                </div>
            </div>

            {mode !== 'COLLAPSED' && (
                <>
                    {headerExtra}

                    {/* Resize handle */}
                    <div onMouseDown={(e) => { setIsResizing(true); e.preventDefault(); }}
                        style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '5px', cursor: 'row-resize', zIndex: 10 }} />

                    {/* Body */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {children}
                    </div>
                </>
            )}

            {mode === 'COLLAPSED' && (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 12px', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '10px', color: titleColor }}>{title}</span>
                    <button onClick={() => setMode('FLOATING')} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}>◱ Expand</button>
                </div>
            )}
        </div>
    );
}

function Btn({ children, active, onClick, style }: { children: React.ReactNode; active?: boolean; onClick: () => void; style?: React.CSSProperties }) {
    return (
        <button onClick={onClick} style={{
            background: active ? 'rgba(0,255,200,0.1)' : 'transparent',
            border: 'none', color: active ? 'var(--accent)' : 'var(--text-muted)',
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', borderRadius: 4, fontSize: 12, ...style,
        }}>{children}</button>
    );
}
