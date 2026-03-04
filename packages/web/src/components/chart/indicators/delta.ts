import { Time } from 'lightweight-charts';
import { IndicatorModule } from './vwap';

/**
 * Delta Histogram
 */
export const deltaIndicator: IndicatorModule<'Histogram'> = {
    key: 'delta',
    create: (chart) => {
        const s = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: 'delta',
            visible: false,
            title: 'Delta'
        });
        chart.priceScale('delta').applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });
        return s;
    },
    update: (series, candles) => {
        const data = candles.map(c => ({
            time: c.time as Time,
            value: (c as any).delta || 0,
            color: ((c as any).delta || 0) >= 0 ? 'rgba(0, 232, 122, 0.5)' : 'rgba(255, 45, 78, 0.5)'
        }));
        series.setData(data);
    }
};
