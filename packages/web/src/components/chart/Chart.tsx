import { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';

// Stores
import { useCandleStore } from '../../stores/candleStore';
import { useMarketDataStore } from '../../stores/marketDataStore';

// Hooks & Plugins
import { useDrawings as useDrawingsHook, DrawingTool, Drawing } from './hooks/useDrawings';
import { runOverlays } from './overlays';
import './overlays'; // Auto-registers plugins

// Components
import { ErrorBoundary } from '../shared/ErrorBoundary.tsx';
import { PerfStats } from '../shared/PerfStats.tsx';

import { createIndicators, updateIndicators } from './indicators';

export type { DrawingTool, Drawing };

export type IndicatorKey =
    | 'volume' | 'cvd' | 'cvd_htf' | 'delta' | 'vwap' | 'liq_overlay'
    | 'rsi' | 'macd' | 'resting_liq' | 'liq_clusters' | 'funding_rate'
    | 'open_interest' | 'session_boxes' | 'log_scale' | 'vol_profile'
    | 'line_chart' | 'ict_fvg' | 'ict_ob' | 'ict_sweeps';

export interface ChartProps {
    timezoneOffset?: number;
    activeTool?: DrawingTool;
    drawings?: Drawing[];
    setDrawings?: React.Dispatch<React.SetStateAction<Drawing[]>>;
    activeIndicators?: Set<IndicatorKey>;
    onSelectDrawing?: (id: string | null) => void;
    selectedDrawing?: string | null;
    onToolEnd?: () => void;
}

export function Chart(props: ChartProps) {
    return (
        <ErrorBoundary name="Chart">
            <ChartInner {...props} />
        </ErrorBoundary>
    );
}

const DEFAULT_INDICATORS = new Set<IndicatorKey>(['volume']);

function ChartInner({
    activeIndicators = DEFAULT_INDICATORS,
    drawings: propsDrawings,
    setDrawings: propsSetDrawings,
    onSelectDrawing: propsOnSelectDrawing,
    selectedDrawing: propsSelectedDrawing,
}: ChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [chart, setChart] = useState<IChartApi | null>(null);
    const [candleSeries, setCandleSeries] = useState<ISeriesApi<'Candlestick'> | null>(null);
    const [lineSeries, setLineSeries] = useState<ISeriesApi<'Line'> | null>(null);
    const [indicatorInstances, setIndicatorInstances] = useState<Record<string, any>>({});

    // Internal Drawing Hook (fallback if App doesn't provide)
    const {
        drawings: intD,
        setDrawings: intSD,
        selectedDrawingId: intSI,
        setSelectedDrawingId: intSSI
    } = useDrawingsHook();

    const drawings = propsDrawings ?? intD;
    const setDrawings = propsSetDrawings ?? intSD;
    const selectedDrawingId = propsSelectedDrawing ?? intSI;
    const setSelectedDrawingId = propsOnSelectDrawing ?? intSSI;

    const candles = useCandleStore((s) => s.candles);
    const timeframe = useCandleStore((s) => s.timeframe);
    const { orderbook, liquidations, liqClusters } = useMarketDataStore();

    const dirtyRef = useRef(true);

    // Mark dirty whenever data changes
    useEffect(() => { dirtyRef.current = true; }, [candles, orderbook, liquidations, liqClusters, activeIndicators]);

    // ── 1. Create Chart Instance ─────────────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const instance = createChart(container, {
            layout: {
                background: { type: ColorType.Solid, color: '#0a0e17' },
                textColor: '#6b6b80',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
            },
            grid: { vertLines: { color: '#1c1c2e' }, horzLines: { color: '#1c1c2e' } },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { labelBackgroundColor: '#2962FF', color: '#758696', style: 2 as any },
                horzLine: { labelBackgroundColor: '#2962FF', color: '#758696', style: 2 as any },
            },
            timeScale: { borderColor: '#1c1c2e', timeVisible: true, secondsVisible: false, rightOffset: 12 },
        });

        // Core Series
        const cs = instance.addCandlestickSeries({
            upColor: '#00e87a', downColor: '#ff2d4e',
            borderUpColor: '#00e87a', borderDownColor: '#ff2d4e',
            wickUpColor: '#00b85e', wickDownColor: '#cc1c39',
        });
        const ls = instance.addLineSeries({ color: '#2962FF', lineWidth: 2, visible: false });

        // Modular Indicators
        const instances = createIndicators(instance);

        setChart(instance);
        setCandleSeries(cs);
        setLineSeries(ls);
        setIndicatorInstances(instances);
        dirtyRef.current = true;

        const handleResize = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            instance.applyOptions({ width: w, height: h });
            const dpr = window.devicePixelRatio || 1;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            dirtyRef.current = true;
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
            instance.remove();
            setChart(null);
            setCandleSeries(null);
            setLineSeries(null);
            setIndicatorInstances({});
        };
    }, []);

    // Deduplicate and sort candles
    const unique = useMemo(() => {
        const filtered = candles.filter(c => c != null && typeof c.time === 'number' && isFinite(c.time) && c.time > 0);
        if (filtered.length === 0) return [];
        return Array.from(new Map(filtered.map(c => [c.time, c])).values())
            .sort((a, b) => a.time - b.time)
            .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);
    }, [candles]);

    // ── 2. Data Synchronization ──────────────────────────────────────────────
    useEffect(() => {
        if (!chart || !candleSeries || !lineSeries) return;
        if (unique.length === 0) return;

        // Core Candle/Line Data
        const lineOn = activeIndicators.has('line_chart');
        candleSeries.applyOptions({ visible: !lineOn });
        lineSeries.applyOptions({ visible: lineOn });

        if (lineOn) {
            lineSeries.setData(unique.map(c => ({ time: c.time as Time, value: c.close })));
        } else {
            candleSeries.setData(unique.map(c => ({
                time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close
            })));
        }

        // Modular Indicators Data
        updateIndicators(indicatorInstances, unique, activeIndicators as Set<string>);

        dirtyRef.current = true;
    }, [unique, chart, candleSeries, lineSeries, indicatorInstances, activeIndicators]);

    // ── 3. Overlay Rendering (Canvas) ─────────────────────────────────────────
    useEffect(() => {
        if (!chart || !candleSeries) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let rafId: number;
        let running = true;

        const render = () => {
            if (!running) return;

            if (dirtyRef.current) {
                dirtyRef.current = false;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const dpr = window.devicePixelRatio || 1;
                const cw = canvas.width / dpr;
                const ch = canvas.height / dpr;

                runOverlays({
                    ctx, cw, ch, chart,
                    candleSeries,
                    candles, timeframe,
                    indicators: Array.from(activeIndicators),
                    toX: (time) => {
                        if (!time || !isFinite(time) || time <= 0) return null;
                        return chart.timeScale().timeToCoordinate(time as any);
                    },
                    toY: (price) => {
                        if (price == null || isNaN(price)) return null;
                        return candleSeries.priceToCoordinate(price);
                    },
                    getState: () => ({
                        orderbook,
                        deepOrderbook: useMarketDataStore.getState().deepOrderbook,
                        liquidations,
                        liqClusters,
                    }),
                });
            }

            rafId = requestAnimationFrame(render);
        };

        render();

        const handleVisibleRangeChange = () => { dirtyRef.current = true; };
        chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

        return () => {
            running = false;
            cancelAnimationFrame(rafId);
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
        };
    }, [chart, candleSeries, activeIndicators, candles, orderbook, liquidations, liqClusters]);

    useEffect(() => {
        void { drawings, setDrawings, selectedDrawingId, setSelectedDrawingId };
    }, [drawings, setDrawings, selectedDrawingId, setSelectedDrawingId]);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute', top: 0, left: 0,
                    width: '100%', height: '100%',
                    pointerEvents: 'none', zIndex: 10,
                }}
            />
            <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 20, pointerEvents: 'none' }}>
                <PerfStats />
            </div>
        </div>
    );
}