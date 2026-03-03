// ─────────────────────────────────────────────────────────────────────────────
// components/chart/hooks/useChartSeries.ts
//
// Creates and owns all lightweight-charts series instances.
// Returns refs that other hooks and overlays can use.
// Separated from Chart.tsx so adding a new series doesn't touch rendering logic.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useEffect } from 'react';
import { LineStyle } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

export interface ChartSeries {
    candle: ISeriesApi<'Candlestick'> | null;
    line: ISeriesApi<'Line'> | null;
    volume: ISeriesApi<'Histogram'> | null;
    cvd: ISeriesApi<'Line'> | null;
    cvdHTF: ISeriesApi<'Line'> | null;
    delta: ISeriesApi<'Histogram'> | null;
    vwap: ISeriesApi<'Line'> | null;
    liq: ISeriesApi<'Line'> | null;
    rsi: ISeriesApi<'Line'> | null;
    macdLine: ISeriesApi<'Line'> | null;
    macdSignal: ISeriesApi<'Line'> | null;
    macdHist: ISeriesApi<'Histogram'> | null;
    funding: ISeriesApi<'Histogram'> | null;
    oi: ISeriesApi<'Line'> | null;
}

export function useChartSeries(chartRef: React.MutableRefObject<IChartApi | null>) {
    const seriesRef = useRef<ChartSeries>({
        candle: null, line: null, volume: null,
        cvd: null, cvdHTF: null, delta: null, vwap: null, liq: null,
        rsi: null, macdLine: null, macdSignal: null, macdHist: null,
        funding: null, oi: null,
    });

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        const s = seriesRef.current;

        s.candle = chart.addCandlestickSeries({
            upColor: '#00e87a', downColor: '#ff2d4e',
            borderUpColor: '#00e87a', borderDownColor: '#ff2d4e',
            wickUpColor: '#00b85e', wickDownColor: '#cc1c39',
        });

        s.line = chart.addLineSeries({ color: '#2962FF', lineWidth: 2, visible: false });

        s.volume = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'volume' });
        chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

        s.cvd = chart.addLineSeries({ color: '#00b4ff', lineWidth: 1, priceScaleId: 'cvd', visible: false });
        s.cvdHTF = chart.addLineSeries({ color: '#00f2ff', lineWidth: 2, lineStyle: LineStyle.Solid, priceScaleId: 'cvd', visible: false });
        chart.priceScale('cvd').applyOptions({ scaleMargins: { top: 0.7, bottom: 0.05 } });

        s.delta = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'delta', visible: false });
        chart.priceScale('delta').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });

        s.vwap = chart.addLineSeries({ color: '#a855f7', lineWidth: 2, lineStyle: LineStyle.Dotted, visible: false });

        s.liq = chart.addLineSeries({ color: '#ff8c1a', lineWidth: 1, lineStyle: LineStyle.Dashed, priceScaleId: 'liq', visible: false });
        chart.priceScale('liq').applyOptions({ scaleMargins: { top: 0.6, bottom: 0.2 } });

        s.rsi = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceScaleId: 'rsi', visible: false });
        chart.priceScale('rsi').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

        s.macdLine = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceScaleId: 'macd', visible: false });
        s.macdSignal = chart.addLineSeries({ color: '#ef4444', lineWidth: 1, priceScaleId: 'macd', visible: false });
        s.macdHist = chart.addHistogramSeries({ priceScaleId: 'macd', visible: false });
        chart.priceScale('macd').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

        s.funding = chart.addHistogramSeries({ priceScaleId: 'funding', visible: false });
        chart.priceScale('funding').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

        s.oi = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 2, priceScaleId: 'oi', visible: false });
        chart.priceScale('oi').applyOptions({ scaleMargins: { top: 0.75, bottom: 0.1 } });

        // Cleanup when chart is destroyed
        return () => {
            Object.keys(s).forEach(k => { (s as any)[k] = null; });
        };
    }, [chartRef.current]); // Re-run if chart instance is replaced

    return seriesRef;
}
