import { Time } from 'lightweight-charts';
import { IndicatorModule } from './vwap';

/**
 * Volume Indicator (Native Histogram)
 */
export const volumeIndicator: IndicatorModule<'Histogram'> = {
    key: 'volume',
    create: (chart) => {
        const s = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
            title: 'Volume'
        });
        chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
        return s;
    },
    update: (series, candles) => {
        const data = candles.map(c => ({
            time: c.time as Time,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(0, 232, 122, 0.25)' : 'rgba(255, 45, 78, 0.2)'
        }));
        series.setData(data);
    }
};
