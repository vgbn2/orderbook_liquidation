import { useState } from 'react';
import { useMarketStore } from '../stores/marketStore';
import { useWebSocket } from '../hooks/useWebSocket';

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
    const { isReplayMode, replayTimestamp, lastPrice } = useMarketStore();
    const { startReplay, stopReplay } = useWebSocket();

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
        <div className={`panel replay-panel ${isReplayMode ? 'active-replay' : ''}`}>
            <div className="panel-header">
                <span className="panel-title">MARKET REPLAY</span>
                <span className={`panel-badge ${isReplayMode ? 'live' : ''}`}>
                    {isReplayMode ? 'REPLAYING' : 'OFF'}
                </span>
            </div>

            {!isReplayMode ? (
                <div className="replay-controls">
                    <div className="control-group">
                        <label>START TIME</label>
                        <input
                            type="datetime-local"
                            value={start}
                            onChange={(e) => setStart(e.target.value)}
                        />
                    </div>
                    <div className="control-group">
                        <label>END TIME</label>
                        <input
                            type="datetime-local"
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                        />
                    </div>
                    <div className="control-row">
                        <div className="control-group">
                            <label>SPEED</label>
                            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                                <option value={1}>1x (Live)</option>
                                <option value={2}>2x</option>
                                <option value={5}>5x</option>
                                <option value={10}>10x</option>
                                <option value={50}>50x</option>
                            </select>
                        </div>
                        <button className="start-replay-btn" onClick={handleStart} disabled={!start || !end}>
                            START REPLAY
                        </button>
                    </div>
                </div>
            ) : (
                <div className="replay-active-info">
                    <div className="replay-meta">
                        <span className="replay-time-label">PLAYBACK TIME:</span>
                        <span className="replay-time-value">{formatTime(replayTimestamp)}</span>
                    </div>
                    <div className="replay-progress-bar">
                        <div className="replay-progress-fill" style={{ width: '50%' }} />
                    </div>

                    {/* Paper Trade Toggle */}
                    <div className="paper-toggle-row">
                        <button
                            className={`tool-btn ${paperMode ? 'active' : ''}`}
                            onClick={() => setPaperMode(!paperMode)}
                        >
                            {paperMode ? '📊 PAPER ON' : '📄 PAPER OFF'}
                        </button>
                    </div>

                    {/* Paper Trade Controls */}
                    {paperMode && (
                        <div className="paper-trade-section">
                            <div className="paper-qty-row">
                                <label>SIZE (BTC)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.001"
                                    value={paperQty}
                                    onChange={(e) => setPaperQty(Number(e.target.value))}
                                    className="paper-qty-input"
                                />
                            </div>

                            {!position ? (
                                <div className="paper-buttons">
                                    <button className="paper-btn paper-long" onClick={() => openPosition('long')}>
                                        LONG ▲
                                    </button>
                                    <button className="paper-btn paper-short" onClick={() => openPosition('short')}>
                                        SHORT ▼
                                    </button>
                                </div>
                            ) : (
                                <div className="paper-position">
                                    <div className="paper-pos-info">
                                        <span className={position.side === 'long' ? 'text-bull' : 'text-bear'}>
                                            {position.side.toUpperCase()} {position.qty} BTC
                                        </span>
                                        <span className="paper-entry">@ ${position.entryPrice.toLocaleString()}</span>
                                    </div>
                                    <div className={`paper-unrealized ${unrealizedPnl >= 0 ? 'text-bull' : 'text-bear'}`}>
                                        UNREALIZED: {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)} USD
                                    </div>
                                    <button className="paper-btn paper-close" onClick={closePosition}>
                                        CLOSE @ ${lastPrice.toLocaleString()}
                                    </button>
                                </div>
                            )}

                            {/* PnL Summary */}
                            <div className="paper-pnl-summary">
                                <span>REALIZED</span>
                                <span className={totalPnl >= 0 ? 'text-bull' : 'text-bear'}>
                                    {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USD
                                </span>
                            </div>

                            {/* Trade History (compact) */}
                            {trades.length > 0 && (
                                <div className="paper-history">
                                    {trades.slice(0, 5).map((t, i) => (
                                        <div key={i} className="paper-history-row">
                                            <span className={t.side === 'long' ? 'text-bull' : 'text-bear'}>
                                                {t.side === 'long' ? '▲' : '▼'}
                                            </span>
                                            <span>${t.entry.toFixed(0)} → ${t.exit.toFixed(0)}</span>
                                            <span className={t.pnl >= 0 ? 'text-bull' : 'text-bear'}>
                                                {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <button className="stop-replay-btn" onClick={stopReplay}>
                        STOP & RETURN TO LIVE
                    </button>
                    <p className="replay-hint">Live data is paused. Viewing historical flow.</p>
                </div>
            )}
        </div>
    );
}
