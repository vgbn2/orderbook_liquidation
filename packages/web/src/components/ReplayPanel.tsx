import { useState } from 'react';
import { useMarketStore } from '../stores/marketStore';

interface PaperPosition {
    side: 'long' | 'short';
    entryPrice: number;
    qty: number;
    entryTime: number;
}

interface PaperTrade {
    side: 'long' | 'short';
    entry: number;
    exit: number;
    qty: number;
    pnl: number;
    ts: number;
}

export function ReplayPanel() {
    const {
        isReplayMode, setReplayMode, replayTimestamp, setReplayTimestamp,
        lastPrice, send
    } = useMarketStore();

    const startReplay = (config: { startTime: number; endTime: number; speed: number }) => {
        setReplayMode(true);
        send({ action: 'start_replay', config });
    };

    const stopReplay = () => {
        send({ action: 'stop_replay' });
        setReplayMode(false);
        setReplayTimestamp(null);
    };

    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [speed, setSpeed] = useState(1);

    // Paper Trading State
    const [paperMode, setPaperMode] = useState(false);
    const [position, setPosition] = useState<PaperPosition | null>(null);
    const [trades, setTrades] = useState<PaperTrade[]>([]);
    const [paperQty, setPaperQty] = useState(0.01);

    const handleStart = () => {
        if (!start || !end) return;
        startReplay({
            startTime: new Date(start).getTime(),
            endTime: new Date(end).getTime(),
            speed: Number(speed)
        });
    };

    const formatTime = (ts: number | null) => {
        if (!ts) return '—';
        return new Date(ts).toLocaleString();
    };

    const openPosition = (side: 'long' | 'short') => {
        if (position) return; // already in a trade
        setPosition({
            side,
            entryPrice: lastPrice,
            qty: paperQty,
            entryTime: Date.now(),
        });
    };

    const closePosition = () => {
        if (!position) return;
        const pnl = position.side === 'long'
            ? (lastPrice - position.entryPrice) * position.qty
            : (position.entryPrice - lastPrice) * position.qty;
        setTrades(prev => [{
            side: position.side,
            entry: position.entryPrice,
            exit: lastPrice,
            qty: position.qty,
            pnl,
            ts: Date.now()
        }, ...prev].slice(0, 30));
        setPosition(null);
    };

    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const unrealizedPnl = position
        ? (position.side === 'long'
            ? (lastPrice - position.entryPrice) * position.qty
            : (position.entryPrice - lastPrice) * position.qty)
        : 0;

    return (
        <div className="panel-section">
            <div className="p-head">
                <span>MARKET REPLAY</span>
                {isReplayMode && <span className="badge-live" style={{ fontSize: '10px' }}>REPLAYING</span>}
            </div>
            <div className="p-body">
                {!isReplayMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>START TIME</span>
                            <input
                                type="datetime-local"
                                className="inp"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>END TIME</span>
                            <input
                                type="datetime-local"
                                className="inp"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginTop: '4px' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>SPEED</span>
                                <select
                                    className="inp"
                                    value={speed}
                                    onChange={(e) => setSpeed(Number(e.target.value))}
                                    style={{ WebkitAppearance: 'none' }}
                                >
                                    <option value={1}>1x (Live)</option>
                                    <option value={2}>2x</option>
                                    <option value={5}>5x</option>
                                    <option value={10}>10x</option>
                                    <option value={50}>50x</option>
                                </select>
                            </div>
                            <button className="btn btn-primary" onClick={handleStart} disabled={!start || !end} style={{ height: '24px' }}>
                                START REPLAY
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button className="toggle" onClick={() => setPaperMode(!paperMode)} style={{ background: paperMode ? 'var(--accent)' : 'var(--bg-overlay)', color: paperMode ? 'var(--bg-base)' : 'var(--text-muted)' }}>
                                {paperMode ? 'PAPER ON' : 'PAPER OFF'}
                            </button>
                        </div>

                        <div style={{ background: 'var(--bg-raised)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-medium)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>PLAYBACK</span>
                                <span style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>{formatTime(replayTimestamp)}</span>
                            </div>
                            <div style={{ height: '4px', background: 'var(--bg-overlay)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: '50%', height: '100%', background: 'var(--accent)' }} />
                            </div>
                        </div>

                        {paperMode && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px', border: '1px dashed var(--border-strong)', borderRadius: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>SIZE (BTC)</span>
                                    <input
                                        type="number"
                                        className="inp"
                                        step="0.01"
                                        min="0.001"
                                        value={paperQty}
                                        onChange={(e) => setPaperQty(Number(e.target.value))}
                                        style={{ width: '80px', height: '24px', textAlign: 'right' }}
                                    />
                                </div>

                                {!position ? (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn" style={{ flex: 1, borderColor: 'var(--positive)', color: 'var(--positive)' }} onClick={() => openPosition('long')}>
                                            LONG ▲
                                        </button>
                                        <button className="btn" style={{ flex: 1, borderColor: 'var(--negative)', color: 'var(--negative)' }} onClick={() => openPosition('short')}>
                                            SHORT ▼
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                                            <span style={{ color: position.side === 'long' ? 'var(--positive)' : 'var(--negative)', fontWeight: 'bold' }}>
                                                {position.side.toUpperCase()} {position.qty} BTC
                                            </span>
                                            <span style={{ color: 'var(--text-secondary)' }}>@ ${position.entryPrice.toLocaleString()}</span>
                                        </div>
                                        <div style={{ color: unrealizedPnl >= 0 ? 'var(--positive)' : 'var(--negative)', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', fontFamily: 'JetBrains Mono, monospace' }}>
                                            {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)} USD
                                        </div>
                                        <button className="btn" onClick={closePosition} style={{ borderColor: 'var(--negative)', color: 'var(--negative)', width: '100%' }}>
                                            CLOSE @ ${lastPrice.toLocaleString()}
                                        </button>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>REALIZED</span>
                                    <span style={{ color: totalPnl >= 0 ? 'var(--positive)' : 'var(--negative)', fontWeight: 'bold', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USD
                                    </span>
                                </div>

                                {trades.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {trades.slice(0, 3).map((t, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
                                                <span>{t.side === 'long' ? '▲' : '▼'} ${t.entry.toFixed(0)} → ${t.exit.toFixed(0)}</span>
                                                <span style={{ color: t.pnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                                    {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(1)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <button className="btn" onClick={stopReplay} style={{ width: '100%' }}>
                            STOP & RETURN TO LIVE
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
