import { useMarketStore } from './stores/marketStore';
import { Chart } from './components/Chart';
import { TerminusNav } from './components/TerminusNav';
import { FloatingBacktestPanel } from './components/FloatingBacktestPanel';

import { OptionsPanel } from './components/OptionsPanel';
import { LiquidationPanel } from './components/LiquidationPanel';
import { VWAFPanel } from './components/VWAFPanel';
import { ConfluencePanel } from './components/ConfluencePanel';
import { ReplayPanel } from './components/ReplayPanel';
import { QuantPanel } from './components/QuantPanel';
import { Orderbook } from './components/Orderbook';
import { AlertManager } from './components/AlertManager';
import { Toolbar } from './components/Toolbar';
import { IndicatorKey, DrawingTool } from './components/Chart';
import { ToastContainer } from './components/Toast';
import { useEffect, useState, useCallback } from 'react';

export function App() {
    const { connected, setCandles, symbol, timeframe } = useMarketStore();
    const [loading, setLoading] = useState(true);
    const candles = useMarketStore((s) => s.candles);
    const timezone = 7; // UTC+7 default
    const [sidebarTab, setSidebarTab] = useState<'macro' | 'options'>('macro');
    const [showBacktestPanel, setShowBacktestPanel] = useState(false);
    const [showAlertPanel, setShowAlertPanel] = useState(false);

    // Chart Toolbar states
    const [activeTool, setActiveTool] = useState<DrawingTool>('none');
    const [drawings, setDrawings] = useState<any[]>([]);
    const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorKey>>(new Set(['volume']));
    const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);

    const toggleIndicator = useCallback((key: IndicatorKey) => {
        setActiveIndicators((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

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

    return (
        <div className="app-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
            {/* ── TOP NAV ────────────────────────────────────────── */}
            <TerminusNav />

            {/* ── WATCHLIST TICKER (Placeholder for now) ─────────── */}
            <div id="ticker" style={{ height: 'var(--h-ticker)', borderBottom: '1px solid var(--border-medium)', background: 'var(--bg-surface)' }}>
                {/*  We will implement Watchlist contents here later */}
            </div>

            {/* ── TOOLBAR ──────────────────── */}
            <Toolbar
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                drawingsCount={drawings.length}
                clearDrawings={() => { setDrawings([]); setSelectedDrawing(null); }}
                activeIndicators={activeIndicators as Set<string>}
                toggleIndicator={(key) => toggleIndicator(key as IndicatorKey)}
            />

            {/* ── MAIN ───────────────────────────────────────────── */}
            <div id="main" style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

                {/* ── CHART AREA ─────────────────────────────────── */}
                <div id="chart-wrap" style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div id="chart-container" style={{ flex: 1, position: 'relative' }}>
                        {loading && (
                            <div className="loading-overlay" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 50, background: 'var(--bg-base)' }}>
                                <div className="loading-spinner" style={{ width: 32, height: 32, border: '3px solid var(--border-medium)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                <span style={{ fontFamily: 'var(--font)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '16px', letterSpacing: '1px' }}>
                                    {connected ? 'LOADING MARKET DATA...' : 'CONNECTING TO SERVER...'}
                                </span>
                            </div>
                        )}
                        <Chart
                            timezoneOffset={timezone}
                            activeTool={activeTool}
                            drawings={drawings}
                            setDrawings={setDrawings}
                            activeIndicators={activeIndicators}
                            onSelectDrawing={setSelectedDrawing}
                            selectedDrawing={selectedDrawing}
                            onToolEnd={() => setActiveTool('none')}
                        />
                    </div>
                </div>

                {/* ── RIGHT PANEL ────────────────────────────────── */}
                <aside id="right-panel" style={{ width: 'var(--right-w)', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-strong)', display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0, zIndex: 10 }}>

                    {/* Market Replay Controls */}
                    <ReplayPanel />

                    {/* Tabs area */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-medium)', background: 'var(--bg-surface)' }}>
                        <div
                            onClick={() => setSidebarTab('macro')}
                            style={{ flex: 1, padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: sidebarTab === 'macro' ? 700 : 500, color: sidebarTab === 'macro' ? 'var(--accent)' : 'var(--text-muted)', borderBottom: sidebarTab === 'macro' ? '2px solid var(--accent)' : 'none', cursor: 'pointer' }}
                        >
                            MACRO · QUANT
                        </div>
                        <div
                            onClick={() => setSidebarTab('options')}
                            style={{ flex: 1, padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: sidebarTab === 'options' ? 700 : 500, color: sidebarTab === 'options' ? 'var(--accent)' : 'var(--text-muted)', borderBottom: sidebarTab === 'options' ? '2px solid var(--accent)' : 'none', cursor: 'pointer' }}
                        >
                            OPTIONS · GEX
                        </div>
                        {/* Adding a small backtest icon tab just so it's accessible */}
                        <div
                            onClick={() => setShowBacktestPanel(true)}
                            title="Open Backtest Panel"
                            style={{ padding: '12px 16px', borderLeft: '1px solid var(--border-medium)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                            ▶
                        </div>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {sidebarTab === 'macro' ? (
                            <>
                                <Orderbook />
                                <QuantPanel />
                                <LiquidationPanel />
                                <VWAFPanel />
                                <ConfluencePanel />
                            </>
                        ) : (
                            <OptionsPanel />
                        )}
                    </div>
                </aside>
            </div>

            {showBacktestPanel && (
                <FloatingBacktestPanel onClose={() => setShowBacktestPanel(false)} />
            )}

            {showAlertPanel && (
                <AlertManager onClose={() => setShowAlertPanel(false)} />
            )}

            <ToastContainer />
        </div>
    );
}
