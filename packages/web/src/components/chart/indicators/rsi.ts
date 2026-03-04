import { Time } from 'lightweight-charts';
import { IndicatorModule } from './vwap';
import { calculateRSI } from '../../../lib/indicators';

/**
 * RSI Indicator
 */
export const rsiIndicator: IndicatorModule<'Line'> = {
    key: 'rsi',
    create: (chart) => {
        const s = chart.addLineSeries({
            color: '#f59e0b',
            lineWidth: 1,
            priceScaleId: 'rsi',
            visible: false,
            title: 'RSI'
        });
        chart.priceScale('rsi').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
            borderVisible: false,
        });
        return s;
    },
    update: (series, candles) => {
        if (candles.length < 14) return;
        const closes = candles.map(c => c.close);
        const rsiValues = calculateRSI(closes, 14);

        const data = candles.map((c, i) => ({
            time: c.time as Time,
            value: rsiValues[i]
        }));

        series.setData(data);
    }
};
