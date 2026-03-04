import { IChartApi, Time } from 'lightweight-charts';
import { CandleData } from '../../../types';
import { calculateMACD } from '../../../lib/indicators';

/**
 * MACD Indicator (Line + Signal + Histogram)
 */
export const macdIndicator = {
    key: 'macd',
    create: (chart: IChartApi) => {
        const line = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceScaleId: 'macd', visible: false, title: 'MACD' });
        const signal = chart.addLineSeries({ color: '#ef4444', lineWidth: 1, priceScaleId: 'macd', visible: false, title: 'Signal' });
        const hist = chart.addHistogramSeries({ priceScaleId: 'macd', visible: false, title: 'MACD Hist' });
        chart.priceScale('macd').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
            borderVisible: false,
        });
        return { line, signal, hist };
    },
    update: (series: any, candles: CandleData[]) => {
        if (candles.length < 26) return;
        const closes = candles.map(c => c.close);
        const { macdLine, signalLine, histogram } = calculateMACD(closes);

        const macdData = candles.map((c, i) => ({ time: c.time as Time, value: macdLine[i] }));
        const signalData = candles.map((c, i) => ({ time: c.time as Time, value: signalLine[i] }));
        const histData = candles.map((c, i) => ({
            time: c.time as Time,
            value: histogram[i],
            color: histogram[i] >= 0 ? 'rgba(0, 232, 122, 0.5)' : 'rgba(255, 45, 78, 0.5)'
        }));

        series.line.setData(macdData);
        series.signal.setData(signalData);
        series.hist.setData(histData);
    }
};
