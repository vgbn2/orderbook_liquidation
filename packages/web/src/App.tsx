import { useWebSocket } from './hooks/useWebSocket';
import { useMarketStore } from './stores/marketStore';
import { Chart } from './components/Chart';

import { OptionsPanel } from './components/OptionsPanel';
import { LiquidationPanel } from './components/LiquidationPanel';
import { VWAFPanel } from './components/VWAFPanel';
import { ConfluencePanel } from './components/ConfluencePanel';
import { ReplayPanel } from './components/ReplayPanel';
import { QuantPanel } from './components/QuantPanel';
import { BacktestPanel } from './components/BacktestPanel';
import { useEffect, useState, useCallback } from 'react';

const TIMEZONES = [
    { label: 'UTC+7', offset: 7 },
    { label: 'UTC+0', offset: 0 },
    { label: 'UTC+1', offset: 1 },
    { label: 'UTC+8', offset: 8 },
    { label: 'UTC+9', offset: 9 },
    { label: 'UTC-5', offset: -5 },
    { label: 'UTC-8', offset: -8 },
];

const TIMEFRAMES = ['1m', '2m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'] as const;

export function App() {
    const { send } = useWebSocket();
    const { connected, lastPrice, priceDirection, setCandles, symbol } = useMarketStore();
    const [loading, setLoading] = useState(true);
    const candles = useMarketStore((s) => s.candles);
    const [timeframe, setTimeframe] = useState('1h');
    const [timezone, setTimezone] = useState(7); // UTC+7 default
    const [sidebarTab, setSidebarTab] = useState<'quant' | 'backtest'>('quant');

    // Fetch historical candles from backend
    const fetchHistorical = useCallback(async (tf: string, sym: string) => {
        try {
            const res = await fetch(`/api/ohlcv?symbol=${sym}&interval=${tf}&limit=1500`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.length > 0) {
                setCandles(data);
                setLoading(false);
            }
        } catch (err) {
            console.error('Failed to fetch OHLCV:', err);
            // Retry after 3s
            setTimeout(() => fetchHistorical(tf, sym), 3000);
        }
    }, [setCandles]);

    // Fetch on mount and when timeframe changes
    useEffect(() => {
        setLoading(true);
        fetchHistorical(timeframe, symbol);
    }, [timeframe, symbol, fetchHistorical]);

    // Timeout fallback for loading
    useEffect(() => {
        if (candles.length > 0) setLoading(false);
        const t = setTimeout(() => setLoading(false), 8000);
        return () => clearTimeout(t);
    }, [candles.length]);

    const formatPrice = (p: number) =>
        p > 0 ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

    return (
        <div className="app-layout">
            {/* ── Header ────────────────────────────────── */}
            <header className="header">
                <div className="header-logo">
                    <h1>TERMINUS</h1>
                    <span className="status-badge">
                        <span className={`status-dot ${connected ? '' : 'disconnected'}`} />
                        {connected ? 'LIVE' : 'OFFLINE'}
                    </span>
                </div>

                {/* Symbol selector */}
                <div className="symbol-selector" style={{ display: 'flex', alignItems: 'center' }}>
                    <select
                        value={symbol}
                        onChange={(e) => send({ action: 'switch_symbol', symbol: e.target.value })}
                        className="tz-select"
                        style={{ marginRight: '1rem', fontWeight: 'bold' }}
                    >
                        {['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT'].map((sym) => (
                            <option key={sym} value={sym}>{sym}</option>
                        ))}
                    </select>
                </div>

                {/* Timeframe selector */}
                <div className="tf-group">
                    {TIMEFRAMES.map((tf) => (
                        <button
                            key={tf}
                            className={`tf-btn ${tf === timeframe ? 'active' : ''}`}
                            onClick={() => setTimeframe(tf)}
                        >
                            {tf}
                        </button>
                    ))}
                </div>

                {/* Timezone selector */}
                <div className="tz-selector">
                    <select
                        value={timezone}
                        onChange={(e) => setTimezone(Number(e.target.value))}
                        className="tz-select"
                    >
                        {TIMEZONES.map((tz) => (
                            <option key={tz.offset} value={tz.offset}>{tz.label}</option>
                        ))}
                    </select>
                </div>

                <div className="header-status">
                    <span className="status-badge">BTC/USDT</span>
                    <span className="status-badge perp-badge">PERP</span>
                    <span className={`price-display ${priceDirection}`}>
                        ${formatPrice(lastPrice)}
                    </span>
                </div>
            </header>

            {/* ── Main Content ──────────────────────────── */}
            <main className="main-content">
                <div className="chart-area">
                    {loading && (
                        <div className="loading-overlay">
                            <div className="loading-spinner" />
                            <span className="loading-text">
                                {connected ? 'LOADING MARKET DATA...' : 'CONNECTING TO SERVER...'}
                            </span>
                        </div>
                    )}
                    <Chart timezoneOffset={timezone} timeframe={timeframe} />
                </div>

                <aside className="sidebar">
                    {/* Market Replay Controls */}
                    <ReplayPanel />

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexShrink: 0 }}>
                        <button
                            className={`tool-btn ${sidebarTab === 'quant' ? 'active' : ''}`}
                            onClick={() => setSidebarTab('quant')}
                            style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                        >
                            LIVE DATA
                        </button>
                        <button
                            className={`tool-btn ${sidebarTab === 'backtest' ? 'active' : ''}`}
                            onClick={() => setSidebarTab('backtest')}
                            style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                        >
                            BACKTEST
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {sidebarTab === 'quant' ? (
                            <>
                                <QuantPanel />
                                <OptionsPanel />
                                <LiquidationPanel />
                                <VWAFPanel />
                                <ConfluencePanel />
                            </>
                        ) : (
                            <BacktestPanel />
                        )}
                    </div>
                </aside>
            </main>
        </div>
    );
}
