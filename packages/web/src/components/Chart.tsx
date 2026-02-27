import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';
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

type DrawingTool = 'none' | 'line' | 'hline' | 'box';

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

type Drawing = LineDrawing | HLineDrawing | BoxDrawing;

// ═══════════════════════════════════════════════════
//  Indicator Types
// ═══════════════════════════════════════════════════

type IndicatorKey = 'volume' | 'cvd' | 'delta' | 'vwap' | 'liq_overlay' | 'rsi' | 'macd' | 'resting_liq';

interface ChartProps {
    timezoneOffset?: number;
}

// ═══════════════════════════════════════════════════
//  Chart Component
// ═══════════════════════════════════════════════════

export function Chart({ timezoneOffset = 7 }: ChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const cvdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const deltaSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const liqSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
    const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null);
    const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);

    const candles = useMarketStore((s) => s.candles);
    const liquidations = useMarketStore((s) => s.liquidations);
    const orderbook = useMarketStore((s) => s.orderbook);

    const [activeTool, setActiveTool] = useState<DrawingTool>('none');
    const [drawings, setDrawings] = useState<Drawing[]>([]);
    const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);
    const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorKey>>(
        new Set(['volume'])
    );
    const drawingState = useRef<{
        started: boolean;
        p1?: { time: number; price: number };
    }>({ started: false });

    const toggleIndicator = useCallback((key: IndicatorKey) => {
        setActiveIndicators((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

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

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;
        cvdSeriesRef.current = cvdSeries;
        deltaSeriesRef.current = deltaSeries;
        vwapSeriesRef.current = vwapSeries;
        liqSeriesRef.current = liqSeries;
        rsiSeriesRef.current = rsiSeries;
        macdLineRef.current = macdLine;
        macdSignalRef.current = macdSignal;
        macdHistRef.current = macdHist;

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
                    return `${day} ${dd} ${mon} ${yyyy} ${hh}:${mm}`;
                },
            },
        });
    }, [timezoneOffset]);

    // ── Toggle indicator visibility ────────────
    useEffect(() => {
        volumeSeriesRef.current?.applyOptions({ visible: activeIndicators.has('volume') });
        cvdSeriesRef.current?.applyOptions({ visible: activeIndicators.has('cvd') });
        deltaSeriesRef.current?.applyOptions({ visible: activeIndicators.has('delta') });
        vwapSeriesRef.current?.applyOptions({ visible: activeIndicators.has('vwap') });
        liqSeriesRef.current?.applyOptions({ visible: activeIndicators.has('liq_overlay') });
        rsiSeriesRef.current?.applyOptions({ visible: activeIndicators.has('rsi') });
        macdLineRef.current?.applyOptions({ visible: activeIndicators.has('macd') });
        macdSignalRef.current?.applyOptions({ visible: activeIndicators.has('macd') });
        macdHistRef.current?.applyOptions({ visible: activeIndicators.has('macd') });
    }, [activeIndicators]);

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
            let cumulativeDelta = 0;
            const cvdData: LineData<Time>[] = candles.map((c) => {
                const delta = c.close >= c.open ? c.volume : -c.volume;
                cumulativeDelta += delta;
                return { time: c.time as Time, value: cumulativeDelta };
            });
            cvdSeriesRef.current.setData(cvdData);
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
            for (let i = 1; i < candles.length; i++) {
                if (i < 14) continue;
                const window = candles.slice(i - 14, i);
                let gains = 0, losses = 0;
                for (let j = 1; j < window.length; j++) {
                    const diff = window[j].close - window[j - 1].close;
                    if (diff > 0) gains += diff;
                    else losses += Math.abs(diff);
                }
                const avgGain = gains / 14;
                const avgLoss = losses / 14;
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
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

    // ── Liquidation overlay on chart (price lines) ──
    useEffect(() => {
        if (!candleSeriesRef.current || !liquidations || !candles.length) return;
        if (!activeIndicators.has('liq_overlay')) return;

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
                ? `rgba(255,45,78,${0.3 + intensity * 0.5})`   // Red for long liquidations (below)
                : `rgba(0,232,122,${0.3 + intensity * 0.5})`;   // Green for short liquidations (above)

            const line = series.createPriceLine({
                price: zone.price,
                color,
                lineWidth: 1,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: `LIQ $${(zone.total / 1e6).toFixed(1)}M`,
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
                setActiveTool('none');
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
                }
                drawingState.current = { started: false };
                setActiveTool('none');
            }
        };

        chart.subscribeClick(handler);
        return () => chart.unsubscribeClick(handler);
    }, [activeTool]);

    // ── Render drawings on canvas overlay (TV-like) ────────
    useEffect(() => {
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
                const labelText = `$${(d.price as number).toLocaleString(undefined, { minimumFractionDigits: 1 })}`;
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
                ctx.fillText(`$${topPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}`, bx + 4, by + 10);
                ctx.fillText(`$${botPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}`, bx + 4, by + bh - 3);
            }
        }

        // ── Resting Liquidity overlay ──────────────────
        if (activeIndicators.has('resting_liq') && orderbook && candleSeriesRef.current) {
            const MIN_THICKNESS = 1;
            const MAX_THICKNESS = 6;
            const allWalls = [
                ...(orderbook.walls?.bid_walls ?? []).map((w: any) => ({ ...w, side: 'bid' as const })),
                ...(orderbook.walls?.ask_walls ?? []).map((w: any) => ({ ...w, side: 'ask' as const })),
            ];

            const maxWallQty = Math.max(...allWalls.map((w: any) => w.qty), 1);

            for (const wall of allWalls) {
                const y = candleSeriesRef.current.priceToCoordinate(wall.price);
                if (y == null) continue;
                const yy = y as number;

                const thickness = Math.min(Math.max(
                    (wall.qty / maxWallQty) * MAX_THICKNESS,
                    MIN_THICKNESS
                ), MAX_THICKNESS);

                const color = wall.side === 'bid'
                    ? `rgba(0,230,118,${0.3 + (wall.qty / maxWallQty) * 0.5})`
                    : `rgba(255,45,78,${0.3 + (wall.qty / maxWallQty) * 0.5})`;

                ctx.strokeStyle = color;
                ctx.lineWidth = thickness;
                ctx.setLineDash([3, 2]);
                ctx.beginPath();
                ctx.moveTo(0, yy);
                ctx.lineTo(cw, yy);
                ctx.stroke();
                ctx.setLineDash([]);

                // Label
                ctx.font = '8px JetBrains Mono, monospace';
                ctx.fillStyle = color;
                ctx.fillText(
                    `${wall.qty.toFixed(2)} BTC`,
                    cw - 70, yy - 2
                );
            }
        }

        ctx.restore();
    }, [drawings, candles, selectedDrawing, activeIndicators, orderbook]);

    // ─ Redraw on scroll/zoom
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        const redraw = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            // Trigger effect by forcing re-render
            setDrawings((d) => [...d]);
        };

        chart.timeScale().subscribeVisibleTimeRangeChange(redraw);
        return () => chart.timeScale().unsubscribeVisibleTimeRangeChange(redraw);
    }, []);

    const clearDrawings = useCallback(() => { setDrawings([]); setSelectedDrawing(null); }, []);

    const updateDrawingColor = useCallback((id: string, color: string) => {
        setDrawings(prev => prev.map(d => d.id === id ? { ...d, color } : d));
    }, []);

    const deleteDrawing = useCallback((id: string) => {
        setDrawings(prev => prev.filter(d => d.id !== id));
        setSelectedDrawing(null);
    }, []);

    // Find selected drawing object
    const selectedDraw = drawings.find(d => d.id === selectedDrawing);

    return (
        <div className="chart-wrapper">
            {/* ── Drawing Toolbar ──────────────────── */}
            <div className="chart-toolbar">
                <div className="toolbar-group">
                    <span className="toolbar-label">DRAW</span>
                    <button
                        className={`tool-btn ${activeTool === 'line' ? 'active' : ''}`}
                        onClick={() => setActiveTool(activeTool === 'line' ? 'none' : 'line')}
                        title="Trend Line (click two points)"
                    >
                        ╲
                    </button>
                    <button
                        className={`tool-btn ${activeTool === 'hline' ? 'active' : ''}`}
                        onClick={() => setActiveTool(activeTool === 'hline' ? 'none' : 'hline')}
                        title="Horizontal Line (click one point)"
                    >
                        ─
                    </button>
                    <button
                        className={`tool-btn ${activeTool === 'box' ? 'active' : ''}`}
                        onClick={() => setActiveTool(activeTool === 'box' ? 'none' : 'box')}
                        title="Box / Zone (click two corners)"
                    >
                        ☐
                    </button>
                    {drawings.length > 0 && (
                        <button className="tool-btn tool-clear" onClick={clearDrawings} title="Clear All">
                            ✕
                        </button>
                    )}
                </div>

                <div className="toolbar-sep" />

                {/* Drawing list — click to select */}
                {drawings.length > 0 && (
                    <div className="toolbar-group">
                        <span className="toolbar-label">LINES</span>
                        {drawings.map(d => (
                            <button
                                key={d.id}
                                className={`tool-btn ${selectedDrawing === d.id ? 'active' : ''}`}
                                onClick={() => setSelectedDrawing(selectedDrawing === d.id ? null : d.id)}
                                style={{ borderBottom: `2px solid ${d.color}` }}
                                title={`${d.type} — click to edit`}
                            >
                                {d.type === 'hline' ? '─' : d.type === 'line' ? '╲' : '☐'}
                            </button>
                        ))}
                    </div>
                )}

                <div className="toolbar-sep" />

                <div className="toolbar-group">
                    <span className="toolbar-label">INDICATORS</span>
                    {(
                        [
                            ['volume', 'VOL'],
                            ['cvd', 'CVD'],
                            ['delta', 'Δ'],
                            ['vwap', 'VWAP'],
                            ['liq_overlay', 'LIQ'],
                            ['rsi', 'RSI'],
                            ['macd', 'MACD'],
                            ['resting_liq', 'RESTING'],
                        ] as [IndicatorKey, string][]
                    ).map(([key, label]) => (
                        <button
                            key={key}
                            className={`tool-btn ${activeIndicators.has(key) ? 'active' : ''}`}
                            onClick={() => toggleIndicator(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Chart + Canvas Overlay ────────────── */}
            <div className="chart-container-wrap">
                <PerfStats />
                <div ref={containerRef} className="chart-container" />
                <canvas
                    ref={canvasRef}
                    className="chart-canvas-overlay"
                    style={{ pointerEvents: activeTool !== 'none' ? 'none' : 'none' }}
                />

                {/* ── Drawing Settings Modal ──────────── */}
                {selectedDraw && (
                    <div className="drawing-settings-modal">
                        <div className="drawing-settings-header">
                            <span>{selectedDraw.type === 'line' ? 'Trend Line' : selectedDraw.type === 'hline' ? 'Horizontal Line' : 'Box'}</span>
                            <button className="drawing-settings-close" onClick={() => setSelectedDrawing(null)}>✕</button>
                        </div>
                        <div className="drawing-settings-row">
                            <label>Color</label>
                            <input
                                type="color"
                                value={selectedDraw.color.startsWith('#') ? selectedDraw.color : '#00b4ff'}
                                onChange={(e) => updateDrawingColor(selectedDraw.id, e.target.value)}
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
                            <button onClick={() => setSelectedDrawing(null)}>OK</button>
                            <button className="btn-delete" onClick={() => deleteDrawing(selectedDraw.id)}>Delete</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
