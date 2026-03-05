import { useEffect, useRef, useState, lazy, Suspense, useCallback } from 'react';
import { useCandleStore } from './stores/candleStore';
import { useMarketDataStore } from './stores/marketDataStore';
import { Chart, IndicatorKey, DrawingTool } from './components/chart/Chart.tsx';
import { TerminusNav } from './components/shared/TerminusNav.tsx';
import { ErrorBoundary } from './components/shared/ErrorBoundary.tsx';
import { OptionsPanel } from './components/exchange/OptionsPanel.tsx';
import { LiquidationPanel } from './components/exchange/LiquidationPanel.tsx';
import { VWAFPanel } from './components/exchange/VWAFPanel.tsx';
import { ConfluencePanel } from './components/exchange/ConfluencePanel.tsx';
import { useLayoutResizer } from './hooks/useLayoutResizer';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppEvents } from './hooks/useAppEvents';
import { QuantPanel } from './components/exchange/QuantPanel.tsx';
import { QuantSummary } from './components/exchange/QuantSummary.tsx';
import { Toolbar } from './components/chart/Toolbar.tsx';
import { ToastContainer, NotifMutedBadge } from './components/shared/Toast.tsx';
import { Orderbook } from './components/exchange/Orderbook.tsx';
import { HTFBiasMonitor } from './components/chart/HTFBiasMonitor.tsx';
import { useSettingsStore } from './stores/settingsStore';
import { useWebSocket } from './hooks/useWebSocket';
import { useDrawings } from './components/chart/hooks/useDrawings.ts';
import { FloatingReplayPanel } from './components/exchange/FloatingReplayPanel.tsx';

const FloatingBacktestPanel = lazy(() => import('./components/backtest/FloatingBacktestPanel.tsx').then(m => ({ default: m.FloatingBacktestPanel })));
const AlertManager = lazy(() => import('./components/shared/AlertManager.tsx').then(m => ({ default: m.AlertManager })));
const BacktestPage = lazy(() => import('./components/backtest/BacktestPage.tsx').then(m => ({ default: m.BacktestPage })));
const ExchangePage = lazy(() => import('./components/exchange/ExchangePage.tsx').then(m => ({ default: m.ExchangePage })));

export function App() {
    const connected = useMarketDataStore(s => s.connected);
    const symbol = useCandleStore(s => s.symbol);
    const timeframe = useCandleStore(s => s.timeframe);
    const setCandles = useCandleStore(s => s.setCandles);
    const setAggregatedCandles = useCandleStore(s => s.setAggregatedCandles);
    const showAggregated = useCandleStore(s => s.showAggregated);

    // Initialize Singleton WebSocket connection
    useWebSocket();
    const [loading, setLoading] = useState(true);
    const candles = useCandleStore(s => s.candles);
    const timezone = 7; // UTC+7 default
    const [sidebarTab, setSidebarTab] = useState<'macro' | 'options' | 'analytics'>('macro');
    const [showBacktestPanel, setShowBacktestPanel] = useState(false);
    const [showReplayPanel, setShowReplayPanel] = useState(false);
    const [showAlertPanel, setShowAlertPanel] = useState(false);

    const uiComplexity = useSettingsStore(s => s.uiComplexity);
    const showOrderbook = useSettingsStore(s => s.showOrderbook);
    const currentView = useSettingsStore(s => s.currentView);
    const setView = useSettingsStore(s => s.setView);

    // Replay panel listener
    useEffect(() => {
        const handler = () => setShowReplayPanel(true);
        window.addEventListener('TERMINUS_SHOW_REPLAY', handler);
        return () => window.removeEventListener('TERMINUS_SHOW_REPLAY', handler);
    }, []);

    // Listen for QuantSummary "Open Analytics" button
    useEffect(() => {
        const handler = () => setSidebarTab('analytics');
        window.addEventListener('TERMINUS_OPEN_ANALYTICS', handler);
        return () => window.removeEventListener('TERMINUS_OPEN_ANALYTICS', handler);
    }, []);

    const exchangeView = useSettingsStore(s => s.exchangeView);
    const setExchangeView = useSettingsStore(s => s.setExchangeView);
    const rightPanelWidth = useSettingsStore(s => s.rightPanelWidth);
    const setRightPanelWidth = useSettingsStore(s => s.setRightPanelWidth);
    const orderbookHeight = useSettingsStore(s => s.orderbookHeight);
    const setOrderbookHeight = useSettingsStore(s => s.setOrderbookHeight);

    // Track if views were ever opened to preserve their state when hidden
    const backtestEverOpened = useRef(false);
    const exchangeEverOpened = useRef(false);

    if (currentView === 'backtest') backtestEverOpened.current = true;
    if (currentView === 'exchange') exchangeEverOpened.current = true;

    // Chart Toolbar states
    const [activeTool, setActiveTool] = useState<DrawingTool>('none');
    const {
        drawings,
        setDrawings,
        selectedDrawingId: selectedDrawing,
        setSelectedDrawingId: setSelectedDrawing
    } = useDrawings(symbol);
    const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorKey>>(new Set(['volume']));

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
            const endpoint = showAggregated ? '/api/ohlcv/aggregated' : '/api/ohlcv';
            const res = await fetch(`${endpoint}?symbol=${sym}&interval=${tf}&limit=5000`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.length > 0) {
                if (showAggregated) setAggregatedCandles(data);
                else setCandles(data);
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
    }, [timeframe, symbol, showAggregated, fetchHistorical]);

    // ── Keyboard Shortcuts (Decentralized) ──
    useKeyboardShortcuts({
        currentView,
        setView,
        exchangeView,
        setExchangeView
    });

    // ── App Event Listeners (Decentralized) ──
    useAppEvents({
        setShowAlertPanel,
        fetchHistorical,
        timeframe
    });

    // Timeout fallback for loading
    useEffect(() => {
        if (candles.length > 0) setLoading(false);
        const t = setTimeout(() => setLoading(false), 8000);
        return () => clearTimeout(t);
    }, [candles.length]);

    // ── Resizer Logic (Decentralized) ──
    const {
        isResizing,
        isVResizing,
        handleMouseDown,
        handleVMouseDown
    } = useLayoutResizer({
        setRightPanelWidth,
        setOrderbookHeight
    });

    return (
        <div className="app-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
            {/* ── TOP NAV ────────────────────────────────────────── */}
            <TerminusNav />

            {/* ── TOOLBAR ──────────────────── */}
            {currentView === 'chart' && (
                <Toolbar
                    activeTool={activeTool}
                    setActiveTool={setActiveTool}
                    drawingsCount={drawings.length}
                    clearDrawings={() => { setDrawings([]); setSelectedDrawing(null); }}
                    activeIndicators={activeIndicators as Set<string>}
                    toggleIndicator={(key) => toggleIndicator(key as IndicatorKey)}
                />
            )}

            {/* ── MAIN VIEW SWITCHER ───────────────────────────────── */}
            <main id="main" style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

                {/* ── CHART VIEW ─────────────────────────────────── */}
                <div style={{
                    display: currentView === 'chart' ? 'flex' : 'none',
                    flex: 1, overflow: 'hidden'
                }}>
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
                            <ErrorBoundary name="Chart">
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
                            </ErrorBoundary>
                        </div>
                    </div>

                    {/* ── VERTICAL RESIZER (Sidebar Width) ── */}
                    <div
                        onMouseDown={handleMouseDown}
                        style={{
                            width: '6px',
                            cursor: 'col-resize',
                            background: isResizing ? 'var(--accent)' : 'transparent',
                            zIndex: 1000,
                            height: '100%',
                            transition: 'background 0.2s',
                            borderLeft: '1px solid var(--border-medium)',
                            marginLeft: '-3px',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => { if (!isResizing) e.currentTarget.style.background = 'rgba(0, 255, 200, 0.15)'; }}
                        onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = 'transparent'; }}
                    >
                        {/* Grab Handle */}
                        <div style={{
                            width: '2px',
                            height: '30px',
                            background: isResizing ? '#fff' : 'var(--border-strong)',
                            borderRadius: '1px',
                            opacity: 0.5
                        }} />
                    </div>

                    {/* ── RIGHT PANEL ────────────────────────────────── */}
                    <aside id="right-panel" aria-label="Market data sidebar" style={{
                        width: rightPanelWidth,
                        background: 'var(--bg-surface)',
                        borderLeft: '1px solid var(--border-strong)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflowY: 'auto',
                        flexShrink: 0,
                        zIndex: 10,
                        transition: isResizing ? 'none' : 'width 0.2s ease',
                    }}>

                        <div style={{
                            borderBottom: showOrderbook ? '1px solid var(--border-medium)' : 'none',
                            flexShrink: 0,
                            overflow: 'hidden',
                            height: showOrderbook ? orderbookHeight : 0,
                            transition: isVResizing ? 'none' : 'height 0.2s ease',
                        }}>
                            <ErrorBoundary name="Orderbook">
                                <Orderbook />
                            </ErrorBoundary>
                        </div>

                        {/* ── HORIZONTAL RESIZER (Orderbook Height) ── */}
                        {showOrderbook && uiComplexity === 'Advanced' && (
                            <div
                                onMouseDown={handleVMouseDown}
                                style={{
                                    height: '6px',
                                    cursor: 'row-resize',
                                    background: isVResizing ? 'var(--accent)' : 'transparent',
                                    zIndex: 1000,
                                    width: '100%',
                                    transition: 'background 0.2s',
                                    borderBottom: '1px solid var(--border-medium)',
                                    marginTop: '-3px',
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                onMouseEnter={(e) => { if (!isVResizing) e.currentTarget.style.background = 'rgba(0, 255, 200, 0.15)'; }}
                                onMouseLeave={(e) => { if (!isVResizing) e.currentTarget.style.background = 'transparent'; }}
                            >
                                {/* Grab Handle */}
                                <div style={{
                                    width: '30px',
                                    height: '2px',
                                    background: isVResizing ? '#fff' : 'var(--border-strong)',
                                    borderRadius: '1px',
                                    opacity: 0.5
                                }} />
                            </div>
                        )}

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {/* ── QuantSummary — Always Visible ── */}
                            <ErrorBoundary name="QuantSummary"><QuantSummary /></ErrorBoundary>

                            {uiComplexity === 'Advanced' ? (
                                <>
                                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-medium)', background: 'var(--bg-surface)' }}>
                                        {(['macro', 'options', 'analytics'] as const).map((tab) => {
                                            const labels = { macro: 'MACRO · QUANT', options: 'OPTIONS · GEX', analytics: 'ANALYTICS' };
                                            return (
                                                <div
                                                    key={tab}
                                                    onClick={() => setSidebarTab(tab)}
                                                    style={{
                                                        flex: 1, padding: '10px 4px', textAlign: 'center',
                                                        fontSize: '10px', fontWeight: sidebarTab === tab ? 700 : 500,
                                                        color: sidebarTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                                                        borderBottom: sidebarTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                                                        cursor: 'pointer', transition: 'all 0.15s',
                                                        letterSpacing: '0.3px',
                                                    }}
                                                >
                                                    {labels[tab]}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {sidebarTab === 'macro' && (
                                        <>
                                            <ErrorBoundary name="HTFBiasMonitor"><HTFBiasMonitor /></ErrorBoundary>
                                            <ErrorBoundary name="LiquidationPanel"><LiquidationPanel /></ErrorBoundary>
                                            <ErrorBoundary name="VWAFPanel"><VWAFPanel /></ErrorBoundary>
                                            <ErrorBoundary name="ConfluencePanel"><ConfluencePanel /></ErrorBoundary>
                                        </>
                                    )}
                                    {sidebarTab === 'options' && (
                                        <ErrorBoundary name="OptionsPanel"><OptionsPanel /></ErrorBoundary>
                                    )}
                                    {sidebarTab === 'analytics' && (
                                        <ErrorBoundary name="QuantPanel"><QuantPanel /></ErrorBoundary>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Simple Mode: Only core summary */}
                                    <div style={{ padding: '12px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border-medium)' }}>
                                        ADVANCED PANELS HIDDEN (SIMPLE MODE)
                                    </div>
                                </>
                            )}
                        </div>
                    </aside>
                </div>

                {/* ── BACKTEST VIEW ──────────────────────────────── */}
                {(currentView === 'backtest' || backtestEverOpened.current) && (
                    <div style={{
                        display: currentView === 'backtest' ? 'flex' : 'none',
                        flex: 1, overflow: 'hidden'
                    }}>
                        <ErrorBoundary name="BacktestPage">
                            <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11 }}>Loading Backtest...</div>}>
                                <BacktestPage />
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                )}

                {/* ── EXCHANGE VIEW ──────────────────────────────── */}
                {(currentView === 'exchange' || exchangeEverOpened.current) && (
                    <div style={{
                        display: currentView === 'exchange' ? 'flex' : 'none',
                        flex: 1, overflow: 'hidden'
                    }}>
                        <ErrorBoundary name="ExchangePage">
                            <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11 }}>Loading Exchange...</div>}>
                                <ExchangePage exchange={exchangeView} />
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                )}

            </main>

            {showReplayPanel && (
                <FloatingReplayPanel />
            )}

            {showBacktestPanel && (
                <Suspense fallback={null}>
                    <FloatingBacktestPanel onClose={() => setShowBacktestPanel(false)} />
                </Suspense>
            )}

            {showAlertPanel && (
                <Suspense fallback={null}>
                    <AlertManager onClose={() => setShowAlertPanel(false)} />
                </Suspense>
            )}

            <ToastContainer />
            <NotifMutedBadge />
        </div>
    );
}
