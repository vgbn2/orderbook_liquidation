import { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import type { IChartApi, Time } from 'lightweight-charts';

// Stores
import { useCandleStore } from '../stores/candleStore';
import { useMarketDataStore } from '../stores/marketDataStore';

// Hooks & Plugins
import { useChartSeries } from './chart/hooks/useChartSeries';
import { useDrawings as useDrawingsHook, DrawingTool, Drawing } from './chart/hooks/useDrawings';
import { runOverlays } from './chart/overlays';
import './chart/overlays'; // Auto-registers plugins

// Components
import { ErrorBoundary } from './shared/ErrorBoundary';
import { PerfStats } from './PerfStats';

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

function ChartInner({
    activeIndicators = new Set(['volume']),
    drawings: propsDrawings,
    setDrawings: propsSetDrawings,
    onSelectDrawing: propsOnSelectDrawing,
    selectedDrawing: propsSelectedDrawing
}: ChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    // Core Series Logic
    const seriesRef = useChartSeries(chartRef);

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

    const candles = useCandleStore(s => s.candles);
    const timeframe = useCandleStore(s => s.timeframe);
    const { orderbook, liquidations, liqClusters } = useMarketDataStore();

    // ── 1. Create Chart Instance ─────────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#0a0e17' },
                textColor: '#6b6b80',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
            },
            grid: {
                vertLines: { color: '#1c1c2e' },
                horzLines: { color: '#1c1c2e' },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { labelBackgroundColor: '#2962FF', color: '#758696', style: 2 },
                horzLine: { labelBackgroundColor: '#2962FF', color: '#758696', style: 2 },
            },
            timeScale: {
                borderColor: '#1c1c2e',
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 12,
            },
        });

        chartRef.current = chart;

        const handleResize = () => {
            if (containerRef.current && canvasRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                chart.applyOptions({ width: clientWidth, height: clientHeight });

                const dpr = window.devicePixelRatio || 1;
                canvasRef.current.width = clientWidth * dpr;
                canvasRef.current.height = clientHeight * dpr;
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            chartRef.current = null;
        };
    }, []);

    // ── 2. Data Synchronization ──────────────────────────────────────────────
    useEffect(() => {
        const s = seriesRef.current;
        const filteredCandles = candles.filter(
            c => c != null &&
                typeof c.time === 'number' &&
                isFinite(c.time) &&
                c.time > 0
        );
        if (filteredCandles.length === 0 || !s.candle) return;

        const uniqueCandles = Array.from(
            new Map(filteredCandles.map(c => [c.time, c])).values()
        ).sort((a, b) => a.time - b.time)
            .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);

        s.candle.setData(uniqueCandles.map(c => ({
            time: c.time as Time,
            open: c.open, high: c.high, low: c.low, close: c.close
        })));

        if (activeIndicators.has('volume') && s.volume) {
            s.volume.setData(uniqueCandles.map(c => ({
                time: c.time as Time,
                value: c.volume,
                color: c.close >= c.open ? 'rgba(0,232,122,0.25)' : 'rgba(255,45,78,0.2)',
            })));
        }

        if (activeIndicators.has('line_chart') && s.line) {
            s.line.setData(uniqueCandles.map(c => ({
                time: c.time as Time,
                value: c.close
            })));
        }
    }, [candles, activeIndicators, seriesRef]);

    // ── 3. Overlay Rendering (Canvas) ─────────────────────────────────────────
    useEffect(() => {
        const chart = chartRef.current;
        const canvas = canvasRef.current;
        const s = seriesRef.current;
        if (!chart || !canvas || !s.candle) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let rafId: number;

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const ts = chart.timeScale();
            const width = canvas.width / (window.devicePixelRatio || 1);
            const height = canvas.height / (window.devicePixelRatio || 1);

            runOverlays({
                ctx,
                cw: width,
                ch: height,
                chart,
                candleSeries: s.candle!,
                candles,
                timeframe,
                indicators: Array.from(activeIndicators),
                toX: (time: number) => {
                    if (time == null || !isFinite(time) || time <= 0) return null;
                    return ts.timeToCoordinate(time as any);
                },
                toY: (price: number) => {
                    if (price == null || isNaN(price) || !s.candle) return null;
                    return s.candle.priceToCoordinate(price);
                },
                getState: () => ({
                    orderbook,
                    deepOrderbook: useMarketDataStore.getState().deepOrderbook,
                    liquidations,
                    liqClusters
                })
            });

            rafId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(rafId);
    }, [candles, timeframe, orderbook, liquidations, liqClusters, activeIndicators, seriesRef]);

    // Suppression for unused variables until drawing handlers are restored
    useEffect(() => {
        const _ = { drawings, setDrawings, selectedDrawingId, setSelectedDrawingId };
        void _;
    }, [drawings, setDrawings, selectedDrawingId, setSelectedDrawingId]);

    return (
        <div className="relative w-full h-full group" ref={containerRef}>
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
                style={{ width: '100%', height: '100%' }}
            />
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <PerfStats />
            </div>
        </div>
    );
}
