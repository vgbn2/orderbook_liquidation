import React, { useState, useMemo } from 'react';
import { useDraggable } from '../../hooks/useDraggable';
import { useCandleStore } from '../../stores/candleStore';
import { useMarketDataStore } from '../../stores/marketDataStore';

export type PanelMode = 'DOCKED_BOTTOM' | 'FLOATING' | 'COLLAPSED';

export function FloatingReplayPanel() {
    const {
        isReplayMode, setReplayMode, replayTimestamp, replayConfig, setReplayConfig,
        setReplayTimestamp, lastPrice, send
    } = useMarketDataStore();

    const timeframe = useCandleStore(s => s.timeframe);

    const [mode, setMode] = useState<'DOCKED_BOTTOM' | 'FLOATING' | 'COLLAPSED'>('DOCKED_BOTTOM');
    const [panelWidth] = useState(800);

    // Form states
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [speed, setSpeed] = useState(1);
    const [error, setError] = useState<string | null>(null);

    const { elementRef, handleMouseDown, isDragging } = useDraggable({
        initialPosition: { x: window.innerWidth - 500, y: window.innerHeight - 450 }
    });

    const tfToMs = (tf: string): number => {
        const num = parseInt(tf);
        if (tf.endsWith('m')) return num * 60 * 1000;
        if (tf.endsWith('h')) return num * 60 * 60 * 1000;
        if (tf.endsWith('d')) return num * 24 * 60 * 60 * 1000;
        if (tf.endsWith('w')) return num * 7 * 24 * 60 * 60 * 1000;
        return 60 * 1000;
    };

    const validateRange = () => {
        if (!start || !end) return false;
        const s = new Date(start).getTime();
        const e = new Date(end).getTime();
        if (s >= e) {
            setError('Start must be before End');
            return false;
        }

        const ms = tfToMs(timeframe);
        const candleCount = (e - s) / ms;
        if (candleCount > 1500) {
            setError(`Range too large (${Math.round(candleCount)} candles). Max 1500.`);
            return false;
        }

        setError(null);
        return true;
    };

    const handleStart = () => {
        if (!validateRange()) return;
        const config = {
            startTime: new Date(start).getTime(),
            endTime: new Date(end).getTime(),
            speed: Number(speed),
            timeframe
        };
        setReplayConfig(config);
        setReplayMode(true);
        send({ action: 'start_replay', config });
    };

    const stopReplay = () => {
        send({ action: 'stop_replay' });
        setReplayMode(false);
        setReplayTimestamp(null);
    };

    const formatTime = (ts: number | null) => {
        if (!ts) return '—';
        return new Date(ts).toLocaleString();
    };

    // Scrubber Logic
    const progress = useMemo(() => {
        if (!replayTimestamp || !replayConfig.startTime || !replayConfig.endTime) return 0;
        const total = replayConfig.endTime - replayConfig.startTime;
        const current = replayTimestamp - replayConfig.startTime;
        return Math.max(0, Math.min(100, (current / total) * 100));
    }, [replayTimestamp, replayConfig]);

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!replayConfig.startTime || !replayConfig.endTime) return;
        const val = parseFloat(e.target.value);
        const total = replayConfig.endTime - replayConfig.startTime;
        const targetTs = replayConfig.startTime + (total * (val / 100));
        setReplayTimestamp(targetTs);
        send({ action: 'seek_replay', timestamp: targetTs });
    };

    // Container Styles (simplified version of FloatingBacktestPanel)
    const getContainerStyles = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            position: 'fixed',
            zIndex: 9998,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            color: 'var(--text-main)',
            fontFamily: "'JetBrains Mono', monospace",
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '12px',
            userSelect: 'none'
        };

        if (mode === 'DOCKED_BOTTOM') {
            return {
                ...base,
                bottom: 0,
                left: 0,
                width: '100vw',
                height: 'auto',
                borderRadius: '12px 12px 0 0',
                borderBottom: 'none',
                transform: 'none'
            };
        }

        if (mode === 'COLLAPSED') {
            return {
                ...base,
                bottom: 20,
                right: 20,
                width: '200px',
                height: '40px',
                borderRadius: '8px',
                transform: 'none'
            };
        }

        return {
            ...base,
            width: `${panelWidth}px`,
            minHeight: '200px'
        };
    };

    return (
        <div ref={elementRef as any} style={getContainerStyles()}>
            {/* Header / Drag Handle */}
            <div
                onMouseDown={mode === 'FLOATING' ? handleMouseDown : undefined}
                style={{
                    padding: '8px 16px',
                    background: 'rgba(0,0,0,0.2)',
                    borderBottom: '1px solid var(--border-medium)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: mode === 'FLOATING' ? (isDragging ? 'grabbing' : 'grab') : 'default'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent)', letterSpacing: '1px' }}>
                        ◈ TERM_REPLAY
                    </span>
                    {isReplayMode && <span className="badge-live" style={{ fontSize: '9px' }}>ACTIVE</span>}
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => setMode('FLOATING')} className={`btn-icon-sm ${mode === 'FLOATING' ? 'active' : ''}`}>◱</button>
                    <button onClick={() => setMode('DOCKED_BOTTOM')} className={`btn-icon-sm ${mode === 'DOCKED_BOTTOM' ? 'active' : ''}`}>↓</button>
                    <button onClick={() => setMode('COLLAPSED')} className={`btn-icon-sm ${mode === 'COLLAPSED' ? 'active' : ''}`}>—</button>
                    <button onClick={() => isReplayMode ? stopReplay() : undefined} style={{ color: 'var(--negative)', marginLeft: '4px' }} className="btn-icon-sm">×</button>
                </div>
            </div>

            {/* Body */}
            {mode !== 'COLLAPSED' && (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {!isReplayMode ? (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="input-group">
                                    <label style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>START TIME</label>
                                    <input type="datetime-local" className="inp" value={start} onChange={e => setStart(e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>END TIME</label>
                                    <input type="datetime-local" className="inp" value={end} onChange={e => setEnd(e.target.value)} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>PLAYBACK SPEED</label>
                                    <select className="inp" value={speed} onChange={e => setSpeed(Number(e.target.value))}>
                                        <option value={1}>1x (Live)</option>
                                        <option value={10}>10x</option>
                                        <option value={100}>100x</option>
                                        <option value={1000}>1000x</option>
                                    </select>
                                </div>
                                <button className="btn btn-primary" onClick={handleStart} style={{ height: '36px', marginTop: '16px', flex: 1.5 }}>
                                    START SESSION
                                </button>
                            </div>

                            {error && (
                                <div style={{ color: 'var(--negative)', fontSize: '11px', background: 'rgba(255,45,78,0.05)', padding: '8px', borderRadius: '4px' }}>
                                    ⚠ {error}
                                </div>
                            )}

                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                Supported range: Up to 1500 candles of <b>{timeframe}</b>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-medium)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>CURRENT TIMESTAMP</div>
                                        <div style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 700 }}>{formatTime(replayTimestamp)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>PRICE</div>
                                        <div style={{ fontSize: '14px', fontWeight: 700 }}>${lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                    </div>
                                </div>

                                {/* Scrubber slider */}
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={progress}
                                    onChange={handleScrub}
                                    style={{
                                        width: '100%',
                                        cursor: 'pointer',
                                        accentColor: 'var(--accent)'
                                    }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    <span>{new Date(replayConfig.startTime || 0).toLocaleDateString()}</span>
                                    <span>{new Date(replayConfig.endTime || 0).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn" style={{ flex: 1, background: 'var(--bg-raised)' }}>PAUSE</button>
                                <button className="btn" onClick={stopReplay} style={{ flex: 1, color: 'var(--negative)', borderColor: 'var(--negative)' }}>EXIT</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {mode === 'COLLAPSED' && (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 12px', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '10px', color: 'var(--accent)' }}>◈ REPLAY {isReplayMode ? '(ACTIVE)' : ''}</span>
                    <button onClick={() => setMode('FLOATING')} style={{ color: 'var(--text-muted)' }}>◱ Maximize</button>
                </div>
            )}

            <style>{`
                .btn-icon-sm {
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    width: 24px;
                    height: 24px;
                    display: flex;
                    alignItems: center;
                    justifyContent: center;
                    cursor: pointer;
                    borderRadius: 4px;
                    fontSize: 12px;
                }
                .btn-icon-sm:hover {
                    background: rgba(255,255,255,0.05);
                    color: var(--text-primary);
                }
                .btn-icon-sm.active {
                    color: var(--accent);
                    background: rgba(0, 255, 200, 0.1);
                }
                .input-group label {
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }
                input[type="range"] {
                    -webkit-appearance: none;
                    height: 4px;
                    background: var(--bg-raised);
                    border-radius: 2px;
                }
            `}</style>
        </div>
    );
}
