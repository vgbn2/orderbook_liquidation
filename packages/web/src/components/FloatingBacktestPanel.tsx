import { useState } from 'react';
import { useDraggable } from '../hooks/useDraggable';
import { useMarketStore } from '../stores/marketStore';
import { runBacktest, BacktestResult } from '../lib/backtester';
import { EquityChart } from './EquityChart';
import { Button } from './UI';

export type PanelMode = 'DOCKED_TOP' | 'DOCKED_BOTTOM' | 'FLOATING' | 'COLLAPSED';

const DEFAULT_STRATEGY = `{
  "name": "SMA Crossover",
  "buyCondition": "close > SMA20",
  "sellCondition": "close < SMA20",
  "takeProfitPct": 3.0,
  "stopLossPct": 1.5,
  "initialBalance": 10000,
  "indicators": [
    { "name": "SMA20", "type": "SMA", "period": 20 }
  ]
}`;

interface Props {
    onClose: () => void;
}

export function FloatingBacktestPanel({ onClose }: Props) {
    const [mode, setMode] = useState<PanelMode>('FLOATING');
    const [jsonInput, setJsonInput] = useState(DEFAULT_STRATEGY);
    const [configOpen, setConfigOpen] = useState(false);
    const [result, setResult] = useState<BacktestResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const candles = useMarketStore(s => s.candles);

    const { elementRef, handleMouseDown, isDragging } = useDraggable({
        initialPosition: { x: window.innerWidth / 2 - 400, y: window.innerHeight - 300 }
    });

    const handleRun = () => {
        try {
            setError(null);
            const res = runBacktest(candles, jsonInput);
            setResult(res);
            setConfigOpen(false);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const jumpToTrade = (tradeIndex: number) => {
        if (!result) return;
        const trade = result.trades[tradeIndex];
        window.dispatchEvent(new CustomEvent('jump_to_trade', { detail: trade }));
    };

    // Calculate dynamic styles based on mode
    const getContainerStyles = (): React.CSSProperties => {
        const baseStyles: React.CSSProperties = {
            position: 'fixed',
            zIndex: 9999,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            transition: isDragging ? 'none' : 'all 0.2s ease',
            color: 'var(--text-main)',
            fontFamily: "'JetBrains Mono', monospace",
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        };

        switch (mode) {
            case 'DOCKED_TOP':
                return {
                    ...baseStyles,
                    top: 48, // header height
                    left: 0,
                    width: '100%',
                    height: 'auto',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderRadius: 0,
                };
            case 'DOCKED_BOTTOM':
                return {
                    ...baseStyles,
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: 'auto',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: 'none',
                    borderRadius: 0,
                };
            case 'COLLAPSED':
                return {
                    ...baseStyles,
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '40px',
                    borderRadius: 0,
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: 'none',
                };
            case 'FLOATING':
            default:
                return {
                    ...baseStyles,
                    width: '800px',
                    borderRadius: '8px',
                };
        }
    };

    return (
        <div ref={elementRef as any} style={getContainerStyles()}>
            {/* ── DRAG HANDLE & HDR ── */}
            <div
                onMouseDown={mode === 'FLOATING' ? handleMouseDown : undefined}
                style={{
                    padding: 'var(--space-2) var(--space-4)',
                    background: 'rgba(0,0,0,0.3)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: mode === 'FLOATING' ? (isDragging ? 'grabbing' : 'grab') : 'default',
                    userSelect: 'none'
                }}
            >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-primary)', letterSpacing: '0.05em' }}>
                        ⚡ TERM_BACKTEST
                    </span>
                    <Button
                        variant="secondary"
                        size="sm"
                        isActive={configOpen}
                        onClick={() => setConfigOpen(!configOpen)}
                        style={{ fontSize: '10px', height: '24px' }}
                    >
                        CONFIG
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleRun}
                        style={{ fontSize: '10px', height: '24px' }}
                    >
                        RUN
                    </Button>
                    {error && <span style={{ color: 'var(--negative)', fontSize: '10px' }}>ERR: {error}</span>}
                </div>

                {/* Window Controls */}
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <Button variant="ghost" size="sm" onClick={() => setMode('DOCKED_TOP')} title="Dock Top" isActive={mode === 'DOCKED_TOP'} style={ctrlBtnStyle}>↑</Button>
                    <Button variant="ghost" size="sm" onClick={() => setMode('DOCKED_BOTTOM')} title="Dock Bottom" isActive={mode === 'DOCKED_BOTTOM'} style={ctrlBtnStyle}>↓</Button>
                    <Button variant="ghost" size="sm" onClick={() => setMode('FLOATING')} title="Float" isActive={mode === 'FLOATING'} style={ctrlBtnStyle}>◱</Button>
                    <Button variant="ghost" size="sm" onClick={() => setMode('COLLAPSED')} title="Collapse" isActive={mode === 'COLLAPSED'} style={ctrlBtnStyle}>_</Button>
                    <Button variant="ghost" size="sm" onClick={onClose} title="Close" style={{ ...ctrlBtnStyle, color: 'var(--negative)' }}>×</Button>
                </div>
            </div>

            {/* ── SETTINGS PANE ── */}
            {configOpen && mode !== 'COLLAPSED' && (
                <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel-dark, #07090d)' }}>
                    <textarea
                        value={jsonInput}
                        onChange={e => setJsonInput(e.target.value)}
                        className="terminus-input"
                        style={{
                            width: '100%', height: '120px',
                            fontFamily: "'JetBrains Mono', monospace",
                            resize: 'vertical', fontSize: '11px'
                        }}
                    />
                </div>
            )}

            {/* ── RESULTS (Only if not collapsed) ── */}
            {mode !== 'COLLAPSED' && result && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Row 1: Ticker Strip of Trades */}
                    <div style={{
                        display: 'flex',
                        overflowX: 'auto',
                        padding: 'var(--space-2)',
                        gap: 'var(--space-2)',
                        background: 'rgba(0,0,0,0.1)',
                        borderBottom: '1px solid var(--border-color)',
                        scrollbarWidth: 'none'
                    }}>
                        {result.trades.map((t, i) => (
                            <button
                                key={i}
                                onClick={() => jumpToTrade(i)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: '4px 8px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${t.pnl >= 0 ? 'var(--up-alpha)' : 'var(--down-alpha)'}`,
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    minWidth: '80px',
                                    transition: 'background 0.2s',
                                    textAlign: 'left'
                                }}
                            >
                                <span className="terminus-label" style={{ fontSize: '9px' }}>#{i + 1} {t.type}</span>
                                <span className="terminus-value" style={{ fontSize: '11px', color: t.pnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                    {t.pnl >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Row 2: Stats Summary */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: 'var(--space-3) var(--space-4)',
                        gap: 'var(--space-4)',
                        borderBottom: '1px solid var(--border-color)'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="terminus-label" style={{ fontSize: '9px' }}>NET RETURN</span>
                            <span className="terminus-value" style={{ fontSize: '13px', color: result.netReturnPct >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                {result.netReturnPct >= 0 ? '+' : ''}{result.netReturnPct.toFixed(2)}%
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="terminus-label" style={{ fontSize: '9px' }}>VS B&H</span>
                            <span className="terminus-value" style={{ fontSize: '13px', color: (result.netReturnPct - result.bahReturnPct) >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                {(result.netReturnPct - result.bahReturnPct) >= 0 ? '+' : ''}{(result.netReturnPct - result.bahReturnPct).toFixed(2)}%
                            </span>
                        </div>
                        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="terminus-label" style={{ fontSize: '9px' }}>SHARPE</span>
                            <span className="terminus-value" style={{ fontSize: '13px' }}>{result.sharpeRatio.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="terminus-label" style={{ fontSize: '9px' }}>MAX DD</span>
                            <span className="terminus-value" style={{ fontSize: '13px', color: 'var(--negative)' }}>{result.maxDrawdown.toFixed(2)}%</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="terminus-label" style={{ fontSize: '9px' }}>TRADES</span>
                            <span className="terminus-value" style={{ fontSize: '13px' }}>{result.totalTrades}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="terminus-label" style={{ fontSize: '9px' }}>WIN RATE</span>
                            <span className="terminus-value" style={{ fontSize: '13px' }}>{result.winRate.toFixed(1)}%</span>
                        </div>
                    </div>

                    {/* Analytics Row: Heatmap & Drawdown */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel-dark)' }}>
                        <div style={{ flex: 1, padding: 'var(--space-4)', borderRight: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>MONTHLY RETURNS</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                {result.monthlyReturns.map((m, i) => {
                                    const isPos = m.returnPct >= 0;
                                    const intensity = Math.min(Math.abs(m.returnPct) / 10, 1) * 0.8 + 0.2;
                                    return (
                                        <div key={i} title={`${m.year}-${m.month + 1}: ${m.returnPct.toFixed(2)}%`} style={{
                                            width: '24px', height: '24px',
                                            background: isPos ? `rgba(0, 255, 200, ${intensity})` : `rgba(255, 59, 92, ${intensity})`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '8px', color: '#fff', borderRadius: '2px'
                                        }}>
                                            {m.returnPct.toFixed(0)}%
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ flex: 1, padding: 'var(--space-4)' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>DRAWDOWN PROFILE</div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', height: '32px', gap: '1px' }}>
                                {result.drawdownCurve.filter((_, i) => i % Math.max(1, Math.floor(result.drawdownCurve.length / 100)) === 0).map((d, i) => (
                                    <div key={i} style={{
                                        flex: 1, background: 'var(--negative)',
                                        height: `${Math.min((d.value / Math.max(1, result.maxDrawdown)) * 100, 100)}%`,
                                        opacity: 0.8
                                    }} />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Equity Curve Overlay */}
                    <div style={{ padding: 'var(--space-4)' }}>
                        <EquityChart result={result} height={140} />
                    </div>
                </div>
            )}
        </div>
    );
}

const ctrlBtnStyle: React.CSSProperties = {
    padding: '2px 0',
    minWidth: '24px',
    height: '24px',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

