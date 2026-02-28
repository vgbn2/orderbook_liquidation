import { useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle, PriceScaleMode } from 'lightweight-charts';
import type {
    IChartApi,
    ISeriesApi,
    CandlestickData,
    HistogramData,
    LineData,
    Time,
    MouseEventParams,
} from 'lightweight-charts';
import { useMarketStore } from '../stores/marketStore';
import { PerfStats } from './PerfStats';


// ═══════════════════════════════════════════════════
//  Drawing Types
// ═══════════════════════════════════════════════════

export type DrawingTool = 'none' | 'line' | 'hline' | 'box' | 'fib' | 'ray';

interface LineDrawing {
    type: 'line';
    id: string;
    p1: { time: number; price: number };
    p2: { time: number; price: number };
    color: string;
}

interface HLineDrawing {
    type: 'hline';
    id: string;
    price: number;
    color: string;
}

interface BoxDrawing {
    type: 'box';
    id: string;
    p1: { time: number; price: number };
    p2: { time: number; price: number };
    color: string;
}

interface FibDrawing {
    type: 'fib';
    id: string;
    p1: { time: number; price: number };
    p2: { time: number; price: number };
    color: string;
}

interface RayDrawing {
    type: 'ray';
    id: string;
    p1: { time: number; price: number };
    p2: { time: number; price: number };
    color: string;
}

type Drawing = LineDrawing | HLineDrawing | BoxDrawing | FibDrawing | RayDrawing;

// ═══════════════════════════════════════════════════
//  Indicator Types
// ═══════════════════════════════════════════════════

export type IndicatorKey = 'volume' | 'cvd' | 'cvd_htf' | 'delta' | 'vwap' | 'liq_overlay' | 'rsi' | 'macd' | 'resting_liq' | 'liq_clusters' | 'funding_rate' | 'open_interest' | 'session_boxes' | 'log_scale' | 'vol_profile';

// ═══════════════════════════════════════════════════
//  TF-Relevance Gating
// ═══════════════════════════════════════════════════

export const ALL_TFS = ['1m', '2m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];
export const INDICATOR_RELEVANCE: Record<IndicatorKey, string[]> = {
    volume: ALL_TFS,
    cvd: ALL_TFS,
    cvd_htf: ['1m', '2m', '3m', '5m', '15m'],
    delta: ALL_TFS,
    vwap: ['1m', '2m', '3m', '5m', '15m', '30m', '1h', '1d', '1w', '1M'],
    liq_overlay: ALL_TFS,
    rsi: ALL_TFS,
    macd: ['15m', '30m', '1h', '4h', '1d', '1w', '1M'],
    resting_liq: ['5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'],
    liq_clusters: ALL_TFS,
    funding_rate: ALL_TFS,
    open_interest: ALL_TFS,
    session_boxes: ['1m', '2m', '3m', '5m', '15m', '30m', '1h', '4h'],
    log_scale: ALL_TFS,
    vol_profile: ALL_TFS,
};

interface ChartProps {
    timezoneOffset?: number;

    activeTool?: DrawingTool;
    drawings?: Drawing[];
    setDrawings?: React.Dispatch<React.SetStateAction<Drawing[]>>;
    activeIndicators?: Set<IndicatorKey>;
    onSelectDrawing?: (id: string | null) => void;
    selectedDrawing?: string | null;
    onToolEnd?: () => void;
}

// ═══════════════════════════════════════════════════
//  Chart Component
// ═══════════════════════════════════════════════════

export function Chart({
    timezoneOffset = 7,
    activeTool = 'none', drawings = [], setDrawings = (() => { }) as React.Dispatch<React.SetStateAction<Drawing[]>>,
    activeIndicators = new Set(['volume']) as Set<IndicatorKey>,
    onSelectDrawing = (_id: string | null) => { }, selectedDrawing = null,
    onToolEnd = () => { }
}: ChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const cvdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const cvdHTFSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const deltaSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const liqSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
    const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null);
    const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const fundingSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const oiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const candles = useMarketStore((s) => s.candles);
    const liquidations = useMarketStore((s) => s.liquidations);
    const fundingRates = useMarketStore((s) => s.fundingRates);
    const openInterest = useMarketStore((s) => s.openInterest);
    const timeframe = useMarketStore((s) => s.timeframe);

    const drawingState = useRef<{
        started: boolean;
        p1?: { time: number; price: number };
    }>({ started: false });
    const initialLoadRef = useRef(false);
    const cachedWallsRef = useRef<any[]>([]);
    const lastWallUpdateRef = useRef<number>(0);

    const rafRef = useRef<number | null>(null);
    const needsRedrawRef = useRef(false);
    const drawCanvasRef = useRef<(() => void) | undefined>(undefined);

    // ── Persistence: Load ──
    useEffect(() => {
        const savedDrawings = localStorage.getItem('terminus_drawings');
        if (savedDrawings) {
            try {
                setDrawings(JSON.parse(savedDrawings));
            } catch (e) {
                console.error('Failed to load drawings', e);
            }
        }
        initialLoadRef.current = true;
    }, []);

    // ── Persistence: Save ──
    useEffect(() => {
        if (!initialLoadRef.current) return;
        localStorage.setItem('terminus_drawings', JSON.stringify(drawings));
    }, [drawings]);

    // ── Initialize chart ──────────────────────────
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
                vertLine: { color: '#3a3a5044', labelBackgroundColor: '#1c1c2e' },
                horzLine: { color: '#3a3a5044', labelBackgroundColor: '#1c1c2e' },
            },
            timeScale: {
                borderColor: '#1c1c2e',
                timeVisible: true,
                secondsVisible: true,
            },
            rightPriceScale: {
                borderColor: '#1c1c2e',
                scaleMargins: { top: 0.05, bottom: 0.3 },
            },
            handleScroll: { vertTouchDrag: false },
        });

        const candleSeries = chart.addCandlestickSeries({
            upColor: '#00e87a',
            downColor: '#ff2d4e',
            borderUpColor: '#00e87a',
            borderDownColor: '#ff2d4e',
            wickUpColor: '#00b85e',
            wickDownColor: '#cc1c39',
        });

        const volumeSeries = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });
        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });

        // CVD Line
        const cvdSeries = chart.addLineSeries({
            color: '#00b4ff',
            lineWidth: 1,
            priceScaleId: 'cvd',
            visible: false,
        });
        const cvdHTFSeries = chart.addLineSeries({
            color: '#00f2ff',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            priceScaleId: 'cvd',
            visible: false,
        });
        chart.priceScale('cvd').applyOptions({
            scaleMargins: { top: 0.7, bottom: 0.05 },
        });

        // Delta Histogram
        const deltaSeries = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: 'delta',
            visible: false,
        });
        chart.priceScale('delta').applyOptions({
            scaleMargins: { top: 0.75, bottom: 0 },
        });

        // VWAP Line
        const vwapSeries = chart.addLineSeries({
            color: '#a855f7',
            lineWidth: 2,
            lineStyle: LineStyle.Dotted,
            visible: false,
        });

        // Liquidation overlay
        const liqSeries = chart.addLineSeries({
            color: '#ff8c1a',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            priceScaleId: 'liq',
            visible: false,
        });
        chart.priceScale('liq').applyOptions({
            scaleMargins: { top: 0.6, bottom: 0.2 },
        });

        // RSI Line
        const rsiSeries = chart.addLineSeries({
            color: '#f59e0b',
            lineWidth: 1,
            priceScaleId: 'rsi',
            visible: false,
        });
        chart.priceScale('rsi').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        // MACD Lines
        const macdLine = chart.addLineSeries({
            color: '#3b82f6',
            lineWidth: 1,
            priceScaleId: 'macd',
            visible: false,
        });
        const macdSignal = chart.addLineSeries({
            color: '#ef4444',
            lineWidth: 1,
            priceScaleId: 'macd',
            visible: false,
        });
        const macdHist = chart.addHistogramSeries({
            priceScaleId: 'macd',
            visible: false,
        });
        chart.priceScale('macd').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });

        // Funding Rate Histogram
        const fundingSeries = chart.addHistogramSeries({
            priceScaleId: 'funding',
            visible: false,
        });
        chart.priceScale('funding').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });

        // Open Interest Line
        const oiSeries = chart.addLineSeries({
            color: '#8b5cf6', // purple
            lineWidth: 2,
            priceScaleId: 'oi',
            visible: false,
        });
        chart.priceScale('oi').applyOptions({
            scaleMargins: { top: 0.75, bottom: 0.1 },
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;
        cvdSeriesRef.current = cvdSeries;
        cvdHTFSeriesRef.current = cvdHTFSeries;
        deltaSeriesRef.current = deltaSeries;
        vwapSeriesRef.current = vwapSeries;
        liqSeriesRef.current = liqSeries;
        rsiSeriesRef.current = rsiSeries;
        macdLineRef.current = macdLine;
        macdSignalRef.current = macdSignal;
        macdHistRef.current = macdHist;
        fundingSeriesRef.current = fundingSeries;
        oiSeriesRef.current = oiSeries;

        // Resize
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                chart.applyOptions({ width, height });
                if (canvasRef.current) {
                    canvasRef.current.width = width * window.devicePixelRatio;
                    canvasRef.current.height = height * window.devicePixelRatio;
                    canvasRef.current.style.width = `${width}px`;
                    canvasRef.current.style.height = `${height}px`;
                }
            }
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            candleSeriesRef.current = null;
            volumeSeriesRef.current = null;
            cvdSeriesRef.current = null;
            deltaSeriesRef.current = null;
            vwapSeriesRef.current = null;
            liqSeriesRef.current = null;
            rsiSeriesRef.current = null;
            macdLineRef.current = null;
            macdSignalRef.current = null;
            macdHistRef.current = null;
            fundingSeriesRef.current = null;
            oiSeriesRef.current = null;
        };
    }, []);

    // ── Timezone + TradingView-style time labels ──
    useEffect(() => {
        if (!chartRef.current) return;
        const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        chartRef.current.applyOptions({
            localization: {
                timeFormatter: (time: number) => {
                    const d = new Date((time + timezoneOffset * 3600) * 1000);
                    const day = DAYS[d.getUTCDay()];
                    const dd = d.getUTCDate();
                    const mon = MONTHS[d.getUTCMonth()];
                    const yyyy = d.getUTCFullYear();
                    const hh = String(d.getUTCHours()).padStart(2, '0');
                    const mm = String(d.getUTCMinutes()).padStart(2, '0');
                    return `${day} ${dd} ${mon} ${yyyy} ${hh}:${mm} `;
                },
            },
        });
    }, [timezoneOffset]);

    // ── Toggle indicator visibility ────────────
    useEffect(() => {
        if (chartRef.current) {
            chartRef.current.priceScale('right').applyOptions({
                mode: activeIndicators.has('log_scale') ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
            });
        }

        const isVisible = (key: IndicatorKey) => activeIndicators.has(key) && INDICATOR_RELEVANCE[key].includes(timeframe);

        volumeSeriesRef.current?.applyOptions({ visible: isVisible('volume') });
        cvdSeriesRef.current?.applyOptions({ visible: isVisible('cvd') });
        cvdHTFSeriesRef.current?.applyOptions({ visible: isVisible('cvd_htf') });
        deltaSeriesRef.current?.applyOptions({ visible: isVisible('delta') });
        vwapSeriesRef.current?.applyOptions({ visible: isVisible('vwap') });
        liqSeriesRef.current?.applyOptions({ visible: isVisible('liq_overlay') });
        rsiSeriesRef.current?.applyOptions({ visible: isVisible('rsi') });
        macdLineRef.current?.applyOptions({ visible: isVisible('macd') });
        macdSignalRef.current?.applyOptions({ visible: isVisible('macd') });
        macdHistRef.current?.applyOptions({ visible: isVisible('macd') });
    }, [activeIndicators, timeframe]);

    // ── Update data ────────────────────────────
    useEffect(() => {
        if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0)
            return;

        const candleData: CandlestickData<Time>[] = candles.map((c) => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));

        const volumeData: HistogramData<Time>[] = candles.map((c) => ({
            time: c.time as Time,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(0,232,122,0.25)' : 'rgba(255,45,78,0.2)',
        }));

        candleSeriesRef.current.setData(candleData);
        volumeSeriesRef.current.setData(volumeData);

        // ── Compute CVD (Cumulative Volume Delta) ──
        if (cvdSeriesRef.current) {
            let runningCvd = 0;
            const cvdData: LineData<Time>[] = candles.map((c: any) => {
                if (c.cvd !== undefined) {
                    runningCvd = c.cvd;
                } else {
                    const delta = c.close >= c.open ? c.volume : -c.volume;
                    runningCvd += delta;
                }
                return { time: c.time as Time, value: runningCvd };
            });
            cvdSeriesRef.current.setData(cvdData);
        }

        // ── Sync HTF CVD ──
        if (cvdHTFSeriesRef.current && activeIndicators.has('cvd_htf') && INDICATOR_RELEVANCE['cvd_htf'].includes(timeframe)) {
            const htfData = useMarketStore.getState().multiTfCvd['15m'] || [];
            if (htfData.length > 0) {
                const formatted = htfData.map(d => ({
                    time: d.time as Time,
                    value: d.value
                })).filter(d => candles.some(c => c.time === d.time)); // Only show data that matches current chart range
                cvdHTFSeriesRef.current.setData(formatted);
            }
        }

        // ── Compute Delta (per-bar volume delta) ──
        if (deltaSeriesRef.current) {
            const deltaData: HistogramData<Time>[] = candles.map((c) => {
                const d = c.close >= c.open ? c.volume : -c.volume;
                return {
                    time: c.time as Time,
                    value: d,
                    color: d >= 0 ? 'rgba(0,232,122,0.5)' : 'rgba(255,45,78,0.4)',
                };
            });
            deltaSeriesRef.current.setData(deltaData);
        }

        // ── Compute VWAP ──
        if (vwapSeriesRef.current) {
            let cumPV = 0;
            let cumV = 0;
            const vwapData: LineData<Time>[] = candles.map((c) => {
                const tp = (c.high + c.low + c.close) / 3;
                cumPV += tp * c.volume;
                cumV += c.volume;
                return { time: c.time as Time, value: cumV > 0 ? cumPV / cumV : tp };
            });
            vwapSeriesRef.current.setData(vwapData);
        }

        // Auto-scroll
        if (chartRef.current) {
            chartRef.current.timeScale().scrollToPosition(2, false);
        }

        // ── Compute RSI ──
        if (rsiSeriesRef.current && candles.length > 14) {
            const rsiData: LineData<Time>[] = [];

            // Seed with simple average of first 14 changes
            let gains = 0, losses = 0;
            for (let i = 1; i <= 14; i++) {
                const diff = candles[i].close - candles[i - 1].close;
                if (diff > 0) gains += diff;
                else losses += Math.abs(diff);
            }

            let avgGain = gains / 14;
            let avgLoss = losses / 14;

            for (let i = 15; i < candles.length; i++) {
                const diff = candles[i].close - candles[i - 1].close;
                const gain = Math.max(diff, 0);
                const loss = Math.max(-diff, 0);

                // Wilder's smoothing
                avgGain = (avgGain * 13 + gain) / 14;
                avgLoss = (avgLoss * 13 + loss) / 14;

                const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
                const rsi = 100 - (100 / (1 + rs));
                rsiData.push({ time: candles[i].time as Time, value: rsi });
            }
            rsiSeriesRef.current.setData(rsiData);
        }

        // ── Compute MACD ──
        if (macdLineRef.current && macdSignalRef.current && macdHistRef.current && candles.length > 26) {
            const closePrices = candles.map(c => c.close);
            const ema = (data: number[], period: number) => {
                const k = 2 / (period + 1);
                const result = [data[0]];
                for (let i = 1; i < data.length; i++) {
                    result.push(data[i] * k + result[i - 1] * (1 - k));
                }
                return result;
            };
            const ema12 = ema(closePrices, 12);
            const ema26 = ema(closePrices, 26);
            const macdValues = ema12.map((v, i) => v - ema26[i]);
            const signalValues = ema(macdValues, 9);

            const macdData: LineData<Time>[] = [];
            const signalData: LineData<Time>[] = [];
            const histData: HistogramData<Time>[] = [];

            for (let i = 26; i < candles.length; i++) {
                const t = candles[i].time as Time;
                const m = macdValues[i];
                const s = signalValues[i];
                macdData.push({ time: t, value: m });
                signalData.push({ time: t, value: s });
                histData.push({
                    time: t,
                    value: m - s,
                    color: m - s >= 0 ? 'rgba(0,232,122,0.5)' : 'rgba(255,45,78,0.4)',
                });
            }
            macdLineRef.current.setData(macdData);
            macdSignalRef.current.setData(signalData);
            macdHistRef.current.setData(histData);
        }
    }, [candles, activeIndicators]);

    // ── Backtest Markers ──
    useEffect(() => {
        const handleBacktest = (e: any) => {
            const res = e.detail;
            if (!candleSeriesRef.current || !res || !res.trades) return;

            const markers: any[] = [];
            res.trades.forEach((t: any) => {
                markers.push({
                    time: t.entryTime,
                    position: t.type === 'LONG' ? 'belowBar' : 'aboveBar',
                    color: t.type === 'LONG' ? '#2196F3' : '#FF9800',
                    shape: t.type === 'LONG' ? 'arrowUp' : 'arrowDown',
                    text: `Enter ${t.type} `,
                });
                markers.push({
                    time: t.exitTime,
                    position: t.type === 'LONG' ? 'aboveBar' : 'belowBar',
                    color: t.pnl >= 0 ? '#4CAF50' : '#F44336',
                    shape: t.type === 'LONG' ? 'arrowDown' : 'arrowUp',
                    text: `Exit\n${t.pnlPct.toFixed(2)}% `,
                });
            });

            markers.sort((a, b) => a.time - b.time);
            candleSeriesRef.current.setMarkers(markers);
        };

        window.addEventListener('backtest_results', handleBacktest);
        return () => window.removeEventListener('backtest_results', handleBacktest);
    }, []);

    // ── Jump to Trade (from Floating Panel) ──
    useEffect(() => {
        const handleJump = (e: any) => {
            const trade = e.detail;
            if (!chartRef.current || !trade) return;

            const ts = chartRef.current.timeScale();
            // Calculate a reasonable range to view the trade
            const duration = trade.exitTime - trade.entryTime;
            const padding = Math.max(duration * 0.5, 3600); // at least 1h padding

            ts.setVisibleRange({
                from: (trade.entryTime - padding) as Time,
                to: (trade.exitTime + padding) as Time,
            });
        };

        window.addEventListener('jump_to_trade', handleJump);
        return () => window.removeEventListener('jump_to_trade', handleJump);
    }, []);

    // ── Data sync for Funding & OI ──
    useEffect(() => {
        if (!fundingSeriesRef.current) return;
        const visible = activeIndicators.has('funding_rate') && INDICATOR_RELEVANCE['funding_rate'].includes(timeframe);
        fundingSeriesRef.current.applyOptions({ visible });
        if (visible && fundingRates.length > 0) {
            const data = fundingRates.map(f => ({
                time: (Math.floor(f.time / 1000)) as Time,
                value: f.rate * 100, // percentage for better visibility
                color: f.rate > 0 ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 45, 78, 0.4)'
            })).sort((a, b) => a.time as number - (b.time as number));

            const unique = [];
            for (const d of data) {
                if (unique.length === 0 || unique[unique.length - 1].time !== d.time) unique.push(d);
            }
            if (unique.length > 0) fundingSeriesRef.current.setData(unique);
        }
    }, [fundingRates, activeIndicators]);

    useEffect(() => {
        if (!oiSeriesRef.current) return;
        const visible = activeIndicators.has('open_interest') && INDICATOR_RELEVANCE['open_interest'].includes(timeframe);
        oiSeriesRef.current.applyOptions({ visible });
        if (visible && openInterest.length > 0) {
            const data = openInterest.map(o => ({
                time: (Math.floor(o.time / 1000)) as Time,
                value: o.oi
            })).sort((a, b) => a.time as number - (b.time as number));

            const unique = [];
            for (const d of data) {
                if (unique.length === 0 || unique[unique.length - 1].time !== d.time) unique.push(d);
            }
            if (unique.length > 0) oiSeriesRef.current.setData(unique);
        }
    }, [openInterest, activeIndicators]);

    // ── Liquidation overlay on chart (price lines) ──
    useEffect(() => {
        if (!candleSeriesRef.current || !liquidations || !candles.length) return;
        if (!activeIndicators.has('liq_overlay') || !INDICATOR_RELEVANCE['liq_overlay'].includes(timeframe)) return;

        // Remove existing liquidation price lines
        const series = candleSeriesRef.current;

        // Build hot zones from heatmap
        const maxLiq = Math.max(...liquidations.heatmap.map((b: { total: number }) => b.total), 1);
        const hotZones = liquidations.heatmap.filter(
            (b: { total: number }) => b.total > maxLiq * 0.3
        );

        // Create price lines for each hot zone
        const lines: any[] = [];
        for (const zone of hotZones) {
            const intensity = zone.total / maxLiq;
            const isLong = zone.long_liq_usd > zone.short_liq_usd;
            const color = isLong
                ? `rgba(255, 45, 78, ${0.3 + intensity * 0.5})`   // Red for long liquidations (below)
                : `rgba(0, 232, 122, ${0.3 + intensity * 0.5})`;   // Green for short liquidations (above)

            const line = series.createPriceLine({
                price: zone.price,
                color,
                lineWidth: 1,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: `LIQ $${(zone.total / 1e6).toFixed(1)} M`,
            });
            lines.push(line);
        }

        return () => {
            // Cleanup: remove price lines on unmount/re-render
            for (const line of lines) {
                try { series.removePriceLine(line); } catch (_) { /* ignore */ }
            }
        };
    }, [liquidations, candles, activeIndicators]);

    // ── Drawing tools: click handling ────────────
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || activeTool === 'none') return;

        const handler = (param: MouseEventParams<Time>) => {
            if (!param.time || !param.point) return;
            const price = candleSeriesRef.current?.coordinateToPrice(param.point.y);
            if (price == null) return;

            const timeVal = param.time as number;

            if (activeTool === 'hline') {
                const d: HLineDrawing = {
                    type: 'hline',
                    id: `h-${Date.now()}`,
                    price: price as number,
                    color: '#00b4ff',
                };
                setDrawings((prev) => [...prev, d]);
                onToolEnd();
                return;
            }

            if (!drawingState.current.started) {
                drawingState.current = { started: true, p1: { time: timeVal, price: price as number } };
            } else {
                const p1 = drawingState.current.p1!;
                const p2 = { time: timeVal, price: price as number };

                if (activeTool === 'line') {
                    const d: LineDrawing = {
                        type: 'line',
                        id: `l-${Date.now()}`,
                        p1,
                        p2,
                        color: '#00b4ff',
                    };
                    setDrawings((prev) => [...prev, d]);
                } else if (activeTool === 'box') {
                    const d: BoxDrawing = {
                        type: 'box',
                        id: `b-${Date.now()}`,
                        p1,
                        p2,
                        color: 'rgba(0,180,255,0.15)',
                    };
                    setDrawings((prev) => [...prev, d]);
                } else if (activeTool === 'fib') {
                    const d: FibDrawing = {
                        type: 'fib',
                        id: `f-${Date.now()}`,
                        p1,
                        p2,
                        color: 'rgba(0,255,150,0.8)',
                    };
                    setDrawings((prev) => [...prev, d]);
                } else if (activeTool === 'ray') {
                    const d: RayDrawing = {
                        type: 'ray',
                        id: `r-${Date.now()}`,
                        p1,
                        p2,
                        color: 'rgba(255,140,0,0.8)',
                    };
                    setDrawings((prev) => [...prev, d]);
                }
                drawingState.current = { started: false };
                onToolEnd();
            }
        };

        chart.subscribeClick(handler);
        return () => chart.unsubscribeClick(handler);
    }, [activeTool]);

    // ── Render drawings on canvas overlay (TV-like) ────────
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const chart = chartRef.current;
        if (!canvas || !chart) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(dpr, dpr);

        const ts = chart.timeScale();
        const cw = canvas.width / dpr;

        for (const d of drawings) {
            const isSelected = d.id === selectedDrawing;

            if (d.type === 'hline') {
                const y = candleSeriesRef.current?.priceToCoordinate(d.price);
                if (y == null) continue;
                const yy = y as number;

                // Main line — full width, dashed
                ctx.strokeStyle = d.color;
                ctx.lineWidth = isSelected ? 2 : 1;
                ctx.setLineDash(isSelected ? [] : [6, 4]);
                ctx.beginPath();
                ctx.moveTo(0, yy);
                ctx.lineTo(cw, yy);
                ctx.stroke();
                ctx.setLineDash([]);

                // Price label on right edge (TV-style tag)
                const labelText = `$${(d.price as number).toLocaleString(undefined, { minimumFractionDigits: 1 })} `;
                ctx.font = '10px JetBrains Mono, monospace';
                const tw = ctx.measureText(labelText).width;
                const lx = cw - tw - 12;
                const ly = yy;

                // Tag background
                ctx.fillStyle = d.color;
                ctx.beginPath();
                ctx.moveTo(lx - 6, ly - 8);
                ctx.lineTo(lx + tw + 8, ly - 8);
                ctx.lineTo(lx + tw + 8, ly + 8);
                ctx.lineTo(lx - 6, ly + 8);
                ctx.lineTo(lx - 12, ly);
                ctx.closePath();
                ctx.fill();

                // Tag text
                ctx.fillStyle = '#0a0e17';
                ctx.fillText(labelText, lx, ly + 3);

            } else if (d.type === 'line') {
                const x1 = ts.timeToCoordinate(d.p1.time as Time);
                const y1 = candleSeriesRef.current?.priceToCoordinate(d.p1.price);
                const x2 = ts.timeToCoordinate(d.p2.time as Time);
                const y2 = candleSeriesRef.current?.priceToCoordinate(d.p2.price);
                if (x1 == null || y1 == null || x2 == null || y2 == null) continue;

                const xx1 = x1 as number, yy1 = y1 as number;
                const xx2 = x2 as number, yy2 = y2 as number;

                // Extend line beyond endpoints (ray style)
                const dx = xx2 - xx1;
                const dy = yy2 - yy1;
                const len = Math.sqrt(dx * dx + dy * dy);
                const extFactor = Math.max(cw, 2000) / (len || 1);
                const ex1 = xx1 - dx * extFactor;
                const ey1 = yy1 - dy * extFactor;
                const ex2 = xx2 + dx * extFactor;
                const ey2 = yy2 + dy * extFactor;

                // Line
                ctx.strokeStyle = d.color;
                ctx.lineWidth = isSelected ? 2.5 : 1.5;
                ctx.beginPath();
                ctx.moveTo(ex1, ey1);
                ctx.lineTo(ex2, ey2);
                ctx.stroke();

                // Anchor dots (TV-style)
                for (const [ax, ay] of [[xx1, yy1], [xx2, yy2]]) {
                    ctx.beginPath();
                    ctx.arc(ax, ay, isSelected ? 5 : 3, 0, Math.PI * 2);
                    ctx.fillStyle = d.color;
                    ctx.fill();
                    ctx.strokeStyle = '#0a0e17';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

            } else if (d.type === 'box') {
                const x1 = ts.timeToCoordinate(d.p1.time as Time);
                const y1 = candleSeriesRef.current?.priceToCoordinate(d.p1.price);
                const x2 = ts.timeToCoordinate(d.p2.time as Time);
                const y2 = candleSeriesRef.current?.priceToCoordinate(d.p2.price);
                if (x1 == null || y1 == null || x2 == null || y2 == null) continue;

                const bx = Math.min(x1 as number, x2 as number);
                const by = Math.min(y1 as number, y2 as number);
                const bw = Math.abs((x2 as number) - (x1 as number));
                const bh = Math.abs((y2 as number) - (y1 as number));

                // Semi-transparent fill using the drawing color
                ctx.fillStyle = d.color.startsWith('rgba')
                    ? d.color
                    : d.color + '22';
                ctx.fillRect(bx, by, bw, bh);

                // Border
                ctx.strokeStyle = d.color.startsWith('rgba')
                    ? 'rgba(0,180,255,0.5)'
                    : d.color;
                ctx.lineWidth = isSelected ? 2 : 1;
                ctx.strokeRect(bx, by, bw, bh);

                // Price labels at top and bottom edges
                const topPrice = Math.max(d.p1.price, d.p2.price);
                const botPrice = Math.min(d.p1.price, d.p2.price);
                ctx.font = '9px JetBrains Mono, monospace';
                ctx.fillStyle = d.color.startsWith('rgba') ? '#00b4ff' : d.color;
                ctx.fillText(`$${topPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })} `, bx + 4, by + 10);
                ctx.fillText(`$${botPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })} `, bx + 4, by + bh - 3);

            } else if (d.type === 'fib') {
                const x1 = ts.timeToCoordinate(d.p1.time as Time);
                const y1 = candleSeriesRef.current?.priceToCoordinate(d.p1.price);
                const x2 = ts.timeToCoordinate(d.p2.time as Time);
                const y2 = candleSeriesRef.current?.priceToCoordinate(d.p2.price);
                if (x1 == null || y1 == null || x2 == null || y2 == null) continue;

                const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
                const diff = d.p2.price - d.p1.price;
                const startX = x1 as number;
                const endX = x2 as number;
                const minX = Math.min(startX, endX);
                const maxX = Math.max(startX, endX);

                ctx.font = '9px JetBrains Mono, monospace';

                for (const level of levels) {
                    const price = d.p1.price + diff * level;
                    const y = candleSeriesRef.current?.priceToCoordinate(price);
                    if (y == null) continue;
                    const yy = y as number;

                    // Level line
                    ctx.strokeStyle = level === 0 || level === 1 ? d.color : `${d.color} 66`;
                    ctx.lineWidth = level === 0 || level === 1 ? 1.5 : 1;
                    ctx.setLineDash(level === 0 || level === 1 ? [] : [4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(minX, yy);
                    ctx.lineTo(maxX, yy);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Label
                    const label = `${(level * 100).toFixed(1)}% ($${price.toLocaleString(undefined, { minimumFractionDigits: 1 })})`;
                    ctx.fillStyle = d.color;
                    ctx.fillText(label, maxX + 4, yy + 3);
                }

                // Connect diagonal
                ctx.strokeStyle = `${d.color} 44`;
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 4]);
                ctx.beginPath();
                ctx.moveTo(startX, y1 as number);
                ctx.lineTo(endX, y2 as number);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (d.type === 'ray') {
                const x1 = ts.timeToCoordinate(d.p1.time as Time);
                const y1 = candleSeriesRef.current?.priceToCoordinate(d.p1.price);
                const x2 = ts.timeToCoordinate(d.p2.time as Time);
                const y2 = candleSeriesRef.current?.priceToCoordinate(d.p2.price);
                if (x1 == null || y1 == null || x2 == null || y2 == null) continue;

                ctx.strokeStyle = d.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x1 as number, y1 as number);

                // Calculate ray intersection with chart edge
                const dx = (x2 as number) - (x1 as number);
                const dy = (y2 as number) - (y1 as number);
                if (dx !== 0) {
                    const edgeX = chartRef.current?.timeScale().width() || 2000;
                    const t = (edgeX - (x1 as number)) / dx;
                    if (t > 0) {
                        ctx.lineTo(edgeX, (y1 as number) + dy * t);
                    } else {
                        ctx.lineTo(x2 as number, y2 as number);
                    }
                } else {
                    ctx.lineTo(x2 as number, y2 as number);
                }
                ctx.stroke();
            }
        }

        // ── Resting Liquidity overlay ──────────────────
        if (activeIndicators.has('resting_liq') && INDICATOR_RELEVANCE['resting_liq'].includes(timeframe) && candleSeriesRef.current) {
            // Retrieve latest orderbook on demand to decouple React renders
            const currentOrderbook = useMarketStore.getState().orderbook;
            const currentCandleTime = candles[candles.length - 1]?.time || 0;

            // Fix: Only recalculate on candle_close (or if empty)
            if ((currentCandleTime !== lastWallUpdateRef.current || cachedWallsRef.current.length === 0) && currentOrderbook) {
                lastWallUpdateRef.current = currentCandleTime as number;
                cachedWallsRef.current = [
                    ...(currentOrderbook.walls?.bid_walls ?? []).map((w: any) => ({ ...w, side: 'bid' as const })),
                    ...(currentOrderbook.walls?.ask_walls ?? []).map((w: any) => ({ ...w, side: 'ask' as const })),
                ];
            }

            const MIN_THICKNESS = 1;
            const MAX_THICKNESS = 6;
            const allWalls = cachedWallsRef.current;
            const maxWallQty = Math.max(...allWalls.map((w: any) => w.qty), 1);
            const currentPrice = candles[candles.length - 1]?.close || 0;

            for (const wall of allWalls) {
                // Invalidate level if price closed through it
                if (wall.side === 'bid' && currentPrice < wall.price) continue;
                if (wall.side === 'ask' && currentPrice > wall.price) continue;

                const y = candleSeriesRef.current.priceToCoordinate(wall.price);
                if (y == null) continue;
                const yy = y as number;

                const thickness = Math.min(Math.max(
                    (wall.qty / maxWallQty) * MAX_THICKNESS,
                    MIN_THICKNESS
                ), MAX_THICKNESS);

                // Pulse major walls
                const isMajor = (wall.qty / maxWallQty) > 0.8;
                const pulse = isMajor ? Math.sin(Date.now() / 200) * 0.2 : 0;

                const color = wall.side === 'bid'
                    ? `rgba(0, 230, 118, ${0.3 + (wall.qty / maxWallQty) * 0.5 + pulse})`
                    : `rgba(255, 45, 78, ${0.3 + (wall.qty / maxWallQty) * 0.5 + pulse})`;

                ctx.strokeStyle = color;
                ctx.lineWidth = thickness;
                ctx.setLineDash([3, 2]);
                ctx.beginPath();
                ctx.moveTo(0, yy);
                ctx.lineTo(cw, yy);
                ctx.stroke();
                ctx.setLineDash([]);

                // Label updates on tick
                const distPct = Math.abs((wall.price - currentPrice) / currentPrice * 100);

                ctx.font = '8px JetBrains Mono, monospace';
                ctx.fillStyle = color;
                ctx.fillText(
                    `${wall.qty.toFixed(2)} BTC(${distPct.toFixed(2)} %)`,
                    cw - 90, yy - 3
                );
            }
        }

        // ── Liq Clusters overlay ──────────────────
        if (activeIndicators.has('liq_clusters') && INDICATOR_RELEVANCE['liq_clusters'].includes(timeframe) && candleSeriesRef.current) {
            // Retrieve latest liability clusters on demand
            const { liqClusters } = useMarketStore.getState();

            for (const cluster of liqClusters) {
                const y = candleSeriesRef.current.priceToCoordinate(cluster.price);
                if (y == null) continue;

                // Width proportional to size
                const thickness = Math.max(2, Math.min(20, cluster.intensity * 20));

                // RED for long liquidations (they sell), GREEN for short liquidations (they buy)
                const color = cluster.side === 'long'
                    ? `rgba(255, 45, 78, ${0.2 + cluster.ageFactor * 0.6})`
                    : `rgba(0, 230, 118, ${0.2 + cluster.ageFactor * 0.6})`;

                ctx.strokeStyle = color;
                ctx.lineWidth = thickness;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(cw, y);
                ctx.stroke();

                // Label
                ctx.font = '9px JetBrains Mono, monospace';
                ctx.fillStyle = color;
                ctx.fillText(`$${(cluster.totalSize / 1e6).toFixed(1)} M`, cw - 50, y - Math.max(4, thickness / 2 + 2));
            }
        }

        // ── Session Boxes overlay ──────────────────
        if (activeIndicators.has('session_boxes') && INDICATOR_RELEVANCE['session_boxes'].includes(timeframe) && candleSeriesRef.current) {
            const range = ts.getVisibleLogicalRange();
            if (range && candles.length > 0) {
                const fromIdx = Math.max(0, Math.floor(range.from));
                const toIdx = Math.min(candles.length - 1, Math.ceil(range.to));

                const sessions: Record<string, { high: number, low: number, startIdx: number, endIdx: number, color: string, name: string }> = {};

                for (let i = fromIdx; i <= toIdx; i++) {
                    const c = candles[i];
                    const d = new Date(c.time * 1000);
                    const h = d.getUTCHours();
                    const dayKey = `${d.getUTCFullYear()} -${d.getUTCMonth()} -${d.getUTCDate()} `;

                    const updateSession = (name: string, color: string) => {
                        const key = `${dayKey}_${name} `;
                        if (!sessions[key]) {
                            sessions[key] = { high: c.high, low: c.low, startIdx: i, endIdx: i, color, name };
                        } else {
                            sessions[key].high = Math.max(sessions[key].high, c.high);
                            sessions[key].low = Math.min(sessions[key].low, c.low);
                            sessions[key].endIdx = i;
                        }
                    };

                    if (h >= 0 && h < 8) updateSession('ASIA', 'rgba(255, 193, 7, 0.1)'); // yellow
                    if (h >= 7 && h < 16) updateSession('LONDON', 'rgba(33, 150, 243, 0.1)'); // blue
                    if (h >= 13 && h < 22) updateSession('NY', 'rgba(244, 67, 54, 0.1)'); // red
                }

                // Draw boxes
                for (const s of Object.values(sessions)) {
                    const x1 = ts.timeToCoordinate(candles[s.startIdx].time as Time);
                    let x2 = ts.timeToCoordinate(candles[s.endIdx].time as Time);

                    const y1 = candleSeriesRef.current.priceToCoordinate(s.high);
                    const y2 = candleSeriesRef.current.priceToCoordinate(s.low);

                    if (x1 == null || y1 == null || y2 == null) continue;
                    if (x2 == null) x2 = (cw as any); // extends to edge if not closed

                    const bx = Math.min((x1 as unknown as number), (x2 as unknown as number));
                    const bw = Math.abs((x2 as unknown as number) - (x1 as unknown as number)) || (cw / 100);
                    const by = Math.min((y1 as unknown as number), (y2 as unknown as number));
                    const bh = Math.abs((y2 as unknown as number) - (y1 as unknown as number));

                    // Box Fill
                    ctx.fillStyle = s.color;
                    ctx.fillRect(bx, by, bw, Math.max(bh, 1));

                    // Box Border
                    const borderColor = s.color.replace('0.1', '0.4');
                    ctx.strokeStyle = borderColor;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(bx, by, bw, Math.max(bh, 1));

                    // High/Low Ray Extensions
                    ctx.beginPath();
                    ctx.setLineDash([4, 4]);
                    ctx.moveTo(bx + bw, by);
                    ctx.lineTo(cw, by); // High ray
                    ctx.moveTo(bx + bw, by + bh);
                    ctx.lineTo(cw, by + bh); // Low ray
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Session Label
                    ctx.font = '10px sans-serif';
                    ctx.fillStyle = borderColor;
                    ctx.fillText(s.name, bx + 5, by + 12);
                }
            }
        }

        ctx.restore();
    }, [drawings, candles, selectedDrawing, activeIndicators, timeframe, liquidations]);

    useEffect(() => {
        drawCanvasRef.current = drawCanvas;
        needsRedrawRef.current = true;
    }, [drawCanvas]);

    useEffect(() => {
        const loop = () => {
            const hasAnim = activeIndicators.has('resting_liq') && INDICATOR_RELEVANCE['resting_liq'].includes(timeframe);
            if (hasAnim) needsRedrawRef.current = true;

            if (needsRedrawRef.current && drawCanvasRef.current) {
                needsRedrawRef.current = false;
                drawCanvasRef.current();
            }
            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [activeIndicators, timeframe]);

    // ─ Redraw on scroll/zoom
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        const redraw = () => {
            needsRedrawRef.current = true;
        };

        chart.timeScale().subscribeVisibleTimeRangeChange(redraw);
        return () => chart.timeScale().unsubscribeVisibleTimeRangeChange(redraw);
    }, []);

    // Find selected drawing object
    const selectedDraw = drawings.find(d => d.id === selectedDrawing);

    return (
        <div className="chart-wrapper" style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>

            {/* ── Chart + Canvas Overlay ────────────── */}
            <div className="chart-container-wrap">
                <PerfStats />
                <div ref={containerRef} className="chart-container" />
                <canvas
                    ref={canvasRef}
                    className="chart-canvas-overlay"
                    style={{
                        pointerEvents: 'none',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        zIndex: 10
                    }}
                />

                {/* ── Drawing Settings Modal ──────────── */}
                {selectedDraw && (
                    <div className="drawing-settings-modal">
                        <div className="drawing-settings-header">
                            <span>{selectedDraw.type === 'line' ? 'Trend Line' : selectedDraw.type === 'hline' ? 'Horizontal Line' : 'Box'}</span>
                            <button className="drawing-settings-close" onClick={() => onSelectDrawing(null)}>✕</button>
                        </div>
                        <div className="drawing-settings-row">
                            <label>Color</label>
                            <input
                                type="color"
                                value={selectedDraw.color.startsWith('#') ? selectedDraw.color : '#00b4ff'}
                                onChange={(e) => {
                                    setDrawings(prev => prev.map(d => d.id === selectedDraw.id ? { ...d, color: e.target.value } : d));
                                }}
                            />
                        </div>
                        {'price' in selectedDraw && (
                            <div className="drawing-settings-row">
                                <label>Price</label>
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                                    ${(selectedDraw as HLineDrawing).price.toLocaleString()}
                                </span>
                            </div>
                        )}
                        <div className="drawing-settings-actions">
                            <button onClick={() => onSelectDrawing(null)}>OK</button>
                            <button className="btn-delete" onClick={() => {
                                setDrawings(prev => prev.filter(d => d.id !== selectedDraw.id));
                                onSelectDrawing(null);
                            }}>Delete</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
